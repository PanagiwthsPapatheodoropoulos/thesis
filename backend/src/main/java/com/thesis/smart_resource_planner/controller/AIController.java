// src/main/java/com/thesis/smart_resource_planner/controller/AIController.java
package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.entity.Skill;
import com.thesis.smart_resource_planner.repository.SkillRepository;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.AIService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Controller responsible for handling AI-related requests.
 * Acts as a bridge between the frontend and the AI microservice, managing
 * task assignments, duration predictions, anomaly detection, and analytics.
 */
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class AIController {

    private final AIService aiServiceClient;
    private final RestTemplate restTemplate;
    private final SkillRepository skillRepository;

    @Value("${ai.service.url}")
    private String aiServiceUrl;

    /**
     * Retrieves AI-suggested employee assignments for a specific task.
     *
     * @param request     Map containing task details like ID, title, and skills.
     * @param currentUser Authenticated user principal.
     * @param authHeader  HTTP Authorization header containing Bearer token.
     * @return ResponseEntity containing a list of suggested assignments.
     */
    @PostMapping("/assignments/suggest")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> getAssignmentSuggestions(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestHeader("Authorization") String authHeader) {
        try {
            // Ensure company isolation by fetching ID from the current security context
            UUID requestedCompany = currentUser.getCompanyId();
            if (requestedCompany == null) {
                return ResponseEntity.badRequest().body(
                        Map.of("error", "Company ID missing from user context"));
            }

            // Clean authentication token for downstream service calls
            String token = authHeader.replace("Bearer ", "");
            String taskIdStr = (String) request.get("taskId");
            UUID taskId;

            // Handle potential UUID parsing failures gracefully
            try {
                taskId = UUID.fromString(taskIdStr);
            } catch (IllegalArgumentException e) {
                taskId = UUID.randomUUID();
            }

            // Convert skill UUIDs to names since the AI service processes textual skill
            // data
            @SuppressWarnings("unchecked")
            List<String> skillIdsOrNames = (List<String>) request.get("requiredSkillIds");
            List<String> skillNames = new ArrayList<>();

            if (skillIdsOrNames != null && !skillIdsOrNames.isEmpty()) {
                for (String skillIdOrName : skillIdsOrNames) {
                    try {
                        UUID skillId = UUID.fromString(skillIdOrName);
                        Optional<Skill> skillOpt = skillRepository.findById(skillId);
                        if (skillOpt.isPresent()) {
                            skillNames.add(skillOpt.get().getName());
                            log.debug("Converted skill ID {} to name: {}", skillId, skillOpt.get().getName());
                        } else {
                            log.warn("Skill ID {} not found in database", skillId);
                        }
                    } catch (IllegalArgumentException e) {
                        // If not a UUID, treat as literal name
                        skillNames.add(skillIdOrName);
                        log.debug("Using skill name directly: {}", skillIdOrName);
                    }
                }
            }

            log.info("Sending {} skill names to AI service: {}", skillNames.size(), skillNames);

            // Fetch recommendations from the AI microservice
            List<Map<String, Object>> suggestions = aiServiceClient.getAssignmentSuggestions(
                    taskId,
                    (String) request.get("taskTitle"),
                    (String) request.get("description"),
                    (String) request.get("priority"),
                    request.get("estimatedHours") != null ? ((Number) request.get("estimatedHours")).doubleValue()
                            : null,
                    skillNames,
                    request.get("complexityScore") != null ? ((Number) request.get("complexityScore")).doubleValue()
                            : 0.5,
                    token,
                    requestedCompany);

            return ResponseEntity.ok(Map.of(
                    "taskId", taskId.toString(),
                    "suggestions", suggestions,
                    "totalCandidates", suggestions.size(),
                    "companyId", requestedCompany.toString()));

        } catch (Exception e) {
            log.error("Error getting assignment suggestions", e);
            return ResponseEntity.ok(Map.of(
                    "taskId", request.get("taskId"),
                    "suggestions", List.of(),
                    "error", e.getMessage()));
        }
    }

    /**
     * Predicts the duration of a task based on its characteristics.
     *
     * @param request     Map containing task priority, complexity, and skills.
     * @param currentUser Authenticated user principal.
     * @param authHeader  HTTP Authorization header.
     * @return ResponseEntity with the predicted duration and confidence intervals.
     */
    @PostMapping("/prediction/duration")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> predictTaskDuration(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            String taskIdStr = (String) request.get("taskId");
            UUID taskId;

            // Generate temporary ID if none provided to satisfy service contract
            try {
                taskId = UUID.fromString(taskIdStr);
            } catch (IllegalArgumentException e) {
                taskId = UUID.randomUUID();
            }

            // Invoke prediction engine
            Map<String, Object> prediction = aiServiceClient.predictTaskDuration(
                    taskId,
                    (String) request.get("priority"),
                    request.get("complexityScore") != null ? ((Number) request.get("complexityScore")).doubleValue()
                            : 0.5,
                    (List<String>) request.get("requiredSkillIds"),
                    token,
                    currentUser.getCompanyId());

            return ResponseEntity.ok(prediction != null ? prediction : Map.of("error", "Prediction not available"));

        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Detects anomalies in system entities (tasks, workloads, etc.).
     *
     * @param request     Map specifying entity type and ID.
     * @param currentUser Authenticated user principal.
     * @param authHeader  HTTP Authorization header.
     * @return ResponseEntity containing a list of detected anomalies.
     */
    @PostMapping("/anomaly/detect")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> detectAnomalies(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");

            Map<String, Object> results = aiServiceClient.detectAnomalies(
                    (String) request.get("entityType"),
                    (String) request.get("entityId"),
                    token,
                    currentUser.getCompanyId());

            return ResponseEntity.ok(results != null ? results : Map.of("anomalies_found", 0, "results", List.of()));

        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Retrieves high-level productivity analytics for a specific time period.
     *
     * @param request     Optional map containing time period and cache control
     *                    flags.
     * @param currentUser Authenticated user principal.
     * @param authHeader  HTTP Authorization header.
     * @return ResponseEntity containing aggregated productivity metrics.
     */
    @PostMapping("/analytics/productivity")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> getProductivityAnalytics(
            @RequestBody(required = false) Map<String, Object> request,
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");

            // Configure defaults and override from request body if present
            Integer timePeriod = 30;
            Boolean bustCache = false;

            if (request != null) {
                if (request.containsKey("time_period_days")) {
                    timePeriod = ((Number) request.get("time_period_days")).intValue();
                }
                if (request.containsKey("bust_cache")) {
                    bustCache = (Boolean) request.get("bust_cache");
                }
            }

            // Fetch processed analytics data
            Map<String, Object> analytics = aiServiceClient.getProductivityAnalytics(
                    timePeriod,
                    bustCache,
                    token,
                    currentUser.getCompanyId());

            return ResponseEntity.ok(analytics != null ? analytics : Map.of("error", "Analytics not available"));

        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Optimizes assignments for multiple tasks simultaneously.
     *
     * @param request     Map containing list of task IDs and optimization strategy.
     * @param currentUser Authenticated user principal.
     * @param authHeader  HTTP Authorization header.
     * @return ResponseEntity with the optimized assignment set.
     */
    @PostMapping("/assignments/bulk-optimize")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> bulkOptimizeAssignments(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            @SuppressWarnings("unchecked")
            List<String> taskIdStrings = (List<String>) request.get("taskIds");
            List<UUID> taskIds = taskIdStrings.stream().map(UUID::fromString).toList();

            Boolean optimizeWorkload = request.containsKey("optimizeWorkload")
                    ? (Boolean) request.get("optimizeWorkload")
                    : true;

            // Trigger bulk optimization algorithm (Genetic or Greedy)
            List<Map<String, Object>> assignments = aiServiceClient.bulkOptimizeAssignments(
                    taskIds,
                    optimizeWorkload,
                    token,
                    currentUser.getCompanyId());

            return ResponseEntity.ok(Map.of(
                    "totalTasks", taskIds.size(),
                    "assignments", assignments,
                    "optimizationMethod", optimizeWorkload ? "genetic_algorithm" : "greedy"));

        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Triggers the retraining of ML models with current data.
     *
     * @param fullRetrain Boolean flag to indicate whether to perform full or
     *                    incremental retraining.
     * @param currentUser Authenticated user principal.
     * @param authHeader  HTTP Authorization header.
     * @return ResponseEntity with the retraining task status.
     */
    @PostMapping("/feedback/retrain")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map> triggerRetraining(
            @RequestParam(defaultValue = "false") Boolean fullRetrain,
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");

            Map result = aiServiceClient.triggerRetraining(
                    fullRetrain,
                    token,
                    currentUser.getCompanyId());

            return ResponseEntity.ok(result != null ? result : Map.of("error", "Retraining failed"));

        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Retrieves metadata about the current AI models.
     *
     * @param currentUser Authenticated user principal.
     * @return ResponseEntity containing model version and architectural details.
     */
    @GetMapping("/feedback/model-info")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map> getModelInfo(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        UUID companyId = currentUser.getCompanyId();

        // Hardcoded metadata reflecting the current system deployment state
        Map info = Map.of(
                "companyId", companyId.toString(),
                "modelVersion", "v1.0-hybrid-ensemble",
                "components", List.of(
                        "RandomForest (35%)",
                        "GradientBoosting (25%)",
                        "LSTM (30%)",
                        "Historical Baseline (10%)"),
                "status", "active");

        return ResponseEntity.ok(info);
    }

    /**
     * Analyzes task complexity based on its textual description.
     *
     * @param request     Map with task details.
     * @param currentUser Authenticated user principal.
     * @param authHeader  HTTP Authorization header.
     * @return ResponseEntity with the computed complexity score.
     */
    @PostMapping("/task-analysis/analyze")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> analyzeTaskComplexity(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            UUID companyId = currentUser.getCompanyId();

            String url = aiServiceUrl + "/api/ai/task-analysis/analyze";

            // Prepare headers for intra-service communication
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + token);
            headers.set("X-Company-Id", companyId.toString());

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            // Forward request to technical analysis module
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            return ResponseEntity.ok(response.getBody());

        } catch (Exception e) {
            return ResponseEntity.ok(
                    Map.of("error", e.getMessage()));
        }
    }

    /**
     * Extracts skills from the provided text payload.
     *
     * @param request     Map containing the text to extract skills from.
     * @param currentUser Authenticated user principal.
     * @param authHeader  HTTP Authorization header.
     * @return ResponseEntity containing the extracted skills.
     */
    @PostMapping("/skills/extract")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Map<String, Object>> extractSkills(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            UUID companyId = currentUser.getCompanyId();

            String url = aiServiceUrl + "/api/ai/skills/extract";

            // Proxy the request to the AI service
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + token);
            headers.set("X-Company-Id", companyId.toString());

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            return ResponseEntity.ok(response.getBody());

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "error", "Skill extraction failed",
                            "message", e.getMessage()));
        }
    }

    /**
     * Communicates with the AI chatbot for user queries.
     *
     * @param payload     Map containing the user query and optional context.
     * @param currentUser Authenticated user principal.
     * @param authHeader  HTTP Authorization header.
     * @return ResponseEntity with the AI chatbot's response.
     */
    @PostMapping("/chatbot/query")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE', 'USER')")
    public ResponseEntity<Map<String, Object>> chatWithAI(
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String url = aiServiceUrl + "/api/ai/chatbot/query";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Construct role-based context for the LLM
            @SuppressWarnings("unchecked")
            Map<String, Object> context = (Map<String, Object>) payload.get("context");
            if (context == null)
                context = new HashMap<>();

            String role = currentUser.getAuthorities().stream()
                    .findFirst()
                    .map(a -> a.getAuthority().replace("ROLE_", ""))
                    .orElse("USER");
            context.put("role", role);

            Map<String, Object> newPayload = new HashMap<>();
            newPayload.put("query", payload.get("query"));
            newPayload.put("context", context);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(newPayload, headers);

            // Execute exchange with the chatbot backend
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, new ParameterizedTypeReference<>() {
                    });

            return ResponseEntity.ok(response.getBody());

        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("response", "System error: " + e.getMessage()));
        }
    }

    /**
     * Checks the health status of the chatbot service.
     *
     * @param currentUser Authenticated user principal.
     * @param authHeader  HTTP Authorization header.
     * @return ResponseEntity indicating whether the chatbot service is reachable.
     */
    @GetMapping("/chatbot/health")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE', 'USER')")
    public ResponseEntity<Map<String, Object>> chatbotHealth(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        try {
            String url = aiServiceUrl + "/api/ai/chatbot/health";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            return ResponseEntity.ok(response.getBody());

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of(
                            "status", "unhealthy",
                            "error", e.getMessage(),
                            "instructions", "Check if Ollama service is running and model is downloaded"));
        }
    }

    /**
     * Orchestrates pulling a specific AI model from the model registry.
     *
     * @param modelName   Name of the model to download (e.g., phi3).
     * @param currentUser Authenticated user principal.
     * @param authHeader  HTTP Authorization header.
     * @return ResponseEntity with the pull operation status.
     */
    @PostMapping("/chatbot/pull-model")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> pullModel(
            @RequestParam(defaultValue = "phi3") String modelName,
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            String url = aiServiceUrl + "/api/ai/chatbot/pull-model?model_name=" + modelName;

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + token);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(Map.of(), headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            return ResponseEntity.ok(response.getBody());

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "error", "Failed to pull model",
                            "message", e.getMessage()));
        }
    }
}
