package com.thesis.smart_resource_planner.service.helpers;

import com.thesis.smart_resource_planner.enums.TaskStatus;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.repository.TaskRequiredSkillRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@RequiredArgsConstructor
@Slf4j
public class TaskFeedbackHelper {

    private final RestTemplate restTemplate;
    private final String aiServiceUrl;
    private final TaskRepository taskRepository;
    private final TaskRequiredSkillRepository taskRequiredSkillRepository;

    private static final double MAX_TASK_HOURS = 200.0;
    private static final double MIN_TASK_HOURS = 0.25;
    private static final int MAX_SCOPE_CHANGES = 2;
    private static final int MAX_REASSIGNMENTS = 3;

    private String getJwtToken() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getCredentials() != null) {
            String credentials = authentication.getCredentials().toString();
            if (!credentials.isBlank()) {
                return credentials;
            }
        }
        return null;
    }

    public void submitAIFeedback(Task task) {
        if (task.getStatus() != TaskStatus.COMPLETED) {
            return;
        }

        if (task.getActualHours() == null ||
                task.getActualHours().compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        // Check if already submitted
        if (Boolean.TRUE.equals(task.getFeedbackSubmitted())) {
            return;
        }

        try {
            // Validate feedback quality
            FeedbackValidation validation = validateTaskFeedback(task);

            if (!validation.isValid) {
                task.setFeedbackQualityScore(BigDecimal.valueOf(validation.qualityScore));
                taskRepository.save(task);
                return;
            }

            // Prepare feedback data
            Map<String, Object> feedback = new HashMap<>();
            feedback.put("task_id", task.getId().toString());
            feedback.put("actual_hours", task.getActualHours().doubleValue());
            feedback.put("predicted_hours",
                    task.getPredictedHours() != null ? task.getPredictedHours().doubleValue() : null);
            feedback.put("title", task.getTitle());
            feedback.put("description", task.getDescription());
            feedback.put("priority", task.getPriority().name());
            feedback.put("complexity_score",
                    task.getComplexityScore() != null ? task.getComplexityScore().doubleValue() : 0.5);

            // Get required skill IDs
            List<UUID> skillIds = taskRequiredSkillRepository.findByTaskId(task.getId())
                    .stream()
                    .map(trs -> trs.getSkill().getId())
                    .toList();
            feedback.put("required_skill_ids", skillIds);

            // Include validation metadata
            feedback.put("validation_category", validation.category);
            feedback.put("quality_score", validation.qualityScore);

            String token = getJwtToken();

            // Submit asynchronously
            submitFeedbackAsync(feedback, task.getCompany().getId(), task.getId(), token);

        } catch (Exception e) {
            log.error("Error preparing feedback for task {}: {}",
                    task.getId(), e.getMessage());
        }
    }

    private FeedbackValidation validateTaskFeedback(Task task) {
        FeedbackValidation validation = new FeedbackValidation();
        double actualHours = task.getActualHours().doubleValue();

        // Extreme outliers
        if (actualHours > MAX_TASK_HOURS) {
            validation.reason = "Actual hours > " + MAX_TASK_HOURS + "h (extreme outlier)";
            validation.category = "extreme_outlier";
            validation.qualityScore = 0.0;
            return validation;
        }

        if (actualHours < MIN_TASK_HOURS) {
            validation.reason = "Actual hours < " + 15 + "min (likely error)";
            validation.category = "too_small";
            validation.qualityScore = 0.0;
            return validation;
        }

        // Multiple scope changes
        if (task.getScopeChangeCount() != null && task.getScopeChangeCount() > MAX_SCOPE_CHANGES) {
            validation.reason = "Scope changed >" + MAX_SCOPE_CHANGES + " times";
            validation.category = "scope_changed";
            validation.qualityScore = 0.3;
            return validation;
        }

        // Multiple reassignments
        if (task.getReassignmentCount() != null && task.getReassignmentCount() > MAX_REASSIGNMENTS) {
            validation.reason = "Task reassigned >" + MAX_REASSIGNMENTS + " times";
            validation.category = "reassigned";
            validation.qualityScore = 0.4;
            return validation;
        }

        // Calculate overall quality
        double qualityScore = calculateFeedbackQuality(task);
        if (qualityScore < 0.4) {
            validation.isValid = true;
            validation.reason = "Quality score too low: " + qualityScore;
            validation.category = "low_quality_accepted";
            validation.qualityScore = qualityScore * 0.5;
            return validation;
        }

        validation.isValid = true;
        validation.qualityScore = qualityScore;
        validation.category = "valid";
        return validation;
    }

    private double calculateFeedbackQuality(Task task) {
        double score = 1.0;

        // Deduct if no description
        if (task.getDescription() == null || task.getDescription().isEmpty()) {
            score -= 0.1;
        }

        // Deduct for reassignments
        if (task.getReassignmentCount() != null && task.getReassignmentCount() > 0) {
            score -= task.getReassignmentCount() * 0.15;
        }

        // Deduct if completed way over deadline
        if (task.getDueDate() != null && task.getCompletedDate() != null) {
            long daysLate = ChronoUnit.DAYS.between(
                    task.getDueDate(),
                    task.getCompletedDate());
            if (daysLate > 5) {
                score -= 0.2;
            }
        }

        // Deduct for scope changes
        if (task.getScopeChangeCount() != null && task.getScopeChangeCount() > 0) {
            score -= task.getScopeChangeCount() * 0.1;
        }

        return Math.max(0.0, score);
    }

    private void submitFeedbackAsync(Map<String, Object> feedback,
                                     UUID companyId,
                                     UUID taskId,
                                     String token) {
        CompletableFuture.runAsync(() -> {
            try {
                String url = aiServiceUrl + "/api/ai/feedback/submit";

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("X-Company-Id", companyId.toString());
                if (token != null) {
                    headers.set("Authorization", "Bearer " + token);
                }

                HttpEntity<Map<String, Object>> request = new HttpEntity<>(feedback, headers);

                ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                        url,
                        HttpMethod.POST,
                        request,
                        new ParameterizedTypeReference<Map<String, Object>>() {
                        });

                if (response.getStatusCode().is2xxSuccessful()) {
                    // Mark as submitted in database
                    Task task = taskRepository.findById(taskId).orElse(null);
                    if (task != null) {
                        task.setFeedbackSubmitted(true);
                        task.setFeedbackQualityScore(
                                BigDecimal.valueOf((Double) feedback.get("quality_score")));
                        taskRepository.save(task);
                    }

                    Map<String, Object> body = response.getBody();
                    if (body != null && Boolean.TRUE.equals(body.get("should_retrain"))) {
                        log.info("Model retraining triggered for company: {}", companyId);
                    }
                } else {
                    log.warn("Feedback submission failed: {}", response.getStatusCode());
                }

            } catch (Exception e) {
                log.error("Failed to submit feedback for task {}: {}",
                        taskId, e.getMessage());
            }
        });
    }

    public void trackPrediction(Task task) {
        if (task.getPredictedHours() == null) {
            return;
        }

        String token = getJwtToken();

        CompletableFuture.runAsync(() -> {
            try {
                String url = aiServiceUrl + "/api/ai/feedback/track-prediction";

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("X-Company-Id", task.getCompany().getId().toString());
                if (token != null) {
                    headers.set("Authorization", "Bearer " + token);
                }

                Map<String, Object> data = new HashMap<>();
                data.put("task_id", task.getId().toString());
                data.put("predicted_hours", task.getPredictedHours().doubleValue());
                data.put("title", task.getTitle());
                data.put("priority", task.getPriority().name());

                HttpEntity<Map<String, Object>> request = new HttpEntity<>(data, headers);

                restTemplate.exchange(
                        url,
                        HttpMethod.POST,
                        request,
                        new ParameterizedTypeReference<Map<String, Object>>() {
                        });

            } catch (Exception e) {
                log.warn("Failed to track prediction for task {}: {}",
                        task.getId(), e.getMessage());
            }
        });
    }

    @Data
    private static class FeedbackValidation {
        boolean isValid = false;
        String reason = "";
        String category = "";
        double qualityScore = 0.0;
    }
}
