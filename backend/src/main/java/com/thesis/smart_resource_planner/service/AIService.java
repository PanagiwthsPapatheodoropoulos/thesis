// src/main/java/com/thesis/smart_resource_planner/service/AIService.java
package com.thesis.smart_resource_planner.service;


import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Service that delegates calls to the external Python-based AI microservice.
 *
 * <p>
 * Provides methods for task assignment suggestions, duration prediction,
 * anomaly detection, productivity analytics, bulk assignment optimisation,
 * model performance reporting, and training triggers. Every method forwards
 * the caller's JWT token and company identifier to the AI service so that
 * it can apply the correct data scope.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AIService {

    @Value("${ai.service.url}")
    private String aiServiceUrl;

    private final RestTemplate restTemplate;

    /**
     * Get AI-powered task assignment suggestions
     */
    public List<Map<String, Object>> getAssignmentSuggestions(
            UUID taskId,
            String taskTitle,
            String description,
            String priority,
            Double estimatedHours,
            List<String> requiredSkillIds,
            Double complexityScore,
            String token,
            UUID companyId) {
        try {
            String url = aiServiceUrl + "/api/ai/assignment/suggest";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + token);
            headers.set("X-Company-Id", companyId.toString());

            Map<String, Object> request = new HashMap<>();
            request.put("task_id", taskId.toString());
            request.put("task_title", taskTitle);
            request.put("description", description);
            request.put("priority", priority);
            request.put("estimated_hours", estimatedHours);
            request.put("required_skill_ids", requiredSkillIds != null ? requiredSkillIds : List.of());
            request.put("complexity_score", complexityScore != null ? complexityScore : 0.5);
            request.put("top_n", 5);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            Map<String, Object> body = response.getBody();
            if (body != null && body.containsKey("suggestions")) {
                // Safe casting with suppression
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> suggestions = (List<Map<String, Object>>) body.get("suggestions");
                return suggestions;
            }

            return List.of();

        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * Predict task duration
     */
    public Map<String, Object> predictTaskDuration(
            UUID taskId,
            String priority,
            Double complexityScore,
            List<String> requiredSkillIds,
            String token,
            UUID companyId) {
        try {
            String url = aiServiceUrl + "/api/ai/prediction/predict";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + token);
            headers.set("X-Company-Id", companyId.toString());

            Map<String, Object> request = new HashMap<>();
            request.put("task_id", taskId.toString());
            request.put("priority", priority);
            request.put("complexity_score", complexityScore != null ? complexityScore : 0.5);
            request.put("required_skill_ids", requiredSkillIds != null ? requiredSkillIds : List.of());

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            return response.getBody();

        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Detect anomalies
     */
    public Map<String, Object> detectAnomalies(
            String entityType,
            String entityId,
            String token,
            UUID companyId) {
        try {
            String url = aiServiceUrl + "/api/ai/anomaly/detect";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + token);
            headers.set("X-Company-Id", companyId.toString());

            Map<String, Object> request = new HashMap<>();
            request.put("entity_type", entityType);
            request.put("entity_id", entityId);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            return response.getBody();

        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Fetches productivity analytics from the AI service for the given period.
     *
     * @param timePeriodDays number of past days to include (default 30)
     * @param bustCache      when {@code true}, forces the AI service to bypass its
     *                       cache
     * @param token          the caller's JWT bearer token for authentication
     * @param companyId      UUID of the company whose data should be analysed
     * @return a map containing productivity metrics, or {@code null} on error
     */
    public Map<String, Object> getProductivityAnalytics(
            Integer timePeriodDays,
            Boolean bustCache,
            String token,
            UUID companyId) {
        try {
            String url = aiServiceUrl + "/api/ai/analytics/productivity";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + token);
            headers.set("X-Company-Id", companyId.toString());

            // Include bust_cache in request body
            Map<String, Object> request = new HashMap<>();
            request.put("time_period_days", timePeriodDays != null ? timePeriodDays : 30);
            request.put("bust_cache", bustCache != null ? bustCache : false);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            Map<String, Object> body = response.getBody();

            return body;

        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Bulk optimize task assignments
     */
    public List<Map<String, Object>> bulkOptimizeAssignments(
            List<UUID> taskIds,
            Boolean optimizeWorkload,
            String token,
            UUID companyId) {
        try {
            String url = aiServiceUrl + "/api/ai/assignment/bulk-optimize";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + token);
            headers.set("X-Company-Id", companyId.toString());

            Map<String, Object> request = new HashMap<>();
            request.put("task_ids", taskIds.stream().map(UUID::toString).toList());
            request.put("optimize_workload", optimizeWorkload != null ? optimizeWorkload : true);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            Map<String, Object> body = response.getBody();
            if (body != null && body.containsKey("assignments")) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> assignments = (List<Map<String, Object>>) body.get("assignments");
                return assignments;
            }

            return List.of();

        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * Retrieves performance metrics for the currently deployed AI model.
     *
     * @param token     the caller's JWT bearer token
     * @param companyId UUID of the company scope
     * @return a map of model performance metrics, or {@code null} on error
     */
    public Map<String, Object> getModelPerformance(String token, UUID companyId) {
        try {
            String url = aiServiceUrl + "/api/ai/feedback/performance";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + token);
            headers.set("X-Company-Id", companyId.toString());

            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            return response.getBody();

        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Triggers an AI model retraining job on the remote service.
     *
     * @param fullRetrain when {@code true}, performs a full retrain from scratch;
     *                    when {@code false}, performs an incremental update
     * @param token       the caller's JWT bearer token
     * @param companyId   UUID of the company scope
     * @return a response map from the AI service, or {@code null} on error
     */
    public Map<String, Object> triggerRetraining(Boolean fullRetrain,
            String token,
            UUID companyId) {
        try {
            String url = aiServiceUrl + "/api/ai/feedback/trigger-training";

            if (fullRetrain != null) {
                url += "?full_retrain=" + fullRetrain;
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + token);
            headers.set("X-Company-Id", companyId.toString());

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(Map.of(), headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            return response.getBody();

        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Extract JWT token from current security context
     */
    private String getJwtToken() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null && authentication.getCredentials() != null) {
            return authentication.getCredentials().toString();
        }

        throw new RuntimeException("No authentication token found");
    }
}