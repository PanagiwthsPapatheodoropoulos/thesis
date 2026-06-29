package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.TaskPriority;
import com.thesis.smart_resource_planner.enums.TaskStatus;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskRequiredSkill;
import com.thesis.smart_resource_planner.model.entity.Skill;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.repository.TaskRequiredSkillRepository;
import com.thesis.smart_resource_planner.service.helpers.TaskFeedbackHelper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TaskFeedbackHelper Tests")
class TaskFeedbackHelperDedicatedTest {

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private TaskRequiredSkillRepository taskRequiredSkillRepository;

    private TaskFeedbackHelper helper;

    private static final String AI_SERVICE_URL = "http://localhost:5000";

    @BeforeEach
    void setUp() {
        helper = new TaskFeedbackHelper(restTemplate, AI_SERVICE_URL, taskRepository, taskRequiredSkillRepository);
        SecurityContextHolder.clearContext();
    }

    private Task buildTask() {
        Company company = new Company();
        company.setId(UUID.randomUUID());
        company.setName("TestCo");

        Task task = new Task();
        task.setId(UUID.randomUUID());
        task.setTitle("Test Task");
        task.setDescription("Test description");
        task.setStatus(TaskStatus.COMPLETED);
        task.setActualHours(BigDecimal.valueOf(8.0));
        task.setPredictedHours(BigDecimal.valueOf(10.0));
        task.setPriority(TaskPriority.MEDIUM);
        task.setComplexityScore(BigDecimal.valueOf(0.5));
        task.setFeedbackSubmitted(false);
        task.setCompany(company);
        task.setScopeChangeCount(0);
        task.setReassignmentCount(0);
        return task;
    }

    @Test
    @DisplayName("submitAIFeedback skips non-completed tasks")
    void submitAIFeedback_skipsNonCompleted() {
        Task task = buildTask();
        task.setStatus(TaskStatus.IN_PROGRESS);

        helper.submitAIFeedback(task);

        verify(taskRepository, never()).save(any());
    }

    @Test
    @DisplayName("submitAIFeedback skips null actualHours")
    void submitAIFeedback_skipsNullActualHours() {
        Task task = buildTask();
        task.setActualHours(null);

        helper.submitAIFeedback(task);

        verify(taskRepository, never()).save(any());
    }

    @Test
    @DisplayName("submitAIFeedback skips zero actualHours")
    void submitAIFeedback_skipsZeroActualHours() {
        Task task = buildTask();
        task.setActualHours(BigDecimal.ZERO);

        helper.submitAIFeedback(task);

        verify(taskRepository, never()).save(any());
    }

    @Test
    @DisplayName("submitAIFeedback skips already submitted tasks")
    void submitAIFeedback_skipsAlreadySubmitted() {
        Task task = buildTask();
        task.setFeedbackSubmitted(true);

        helper.submitAIFeedback(task);

        verify(taskRepository, never()).save(any());
    }

    @Test
    @DisplayName("submitAIFeedback saves quality score for invalid feedback (extreme outlier)")
    void submitAIFeedback_invalidFeedback_extremeOutlier() {
        Task task = buildTask();
        task.setActualHours(BigDecimal.valueOf(999.0));

        when(taskRepository.save(any(Task.class))).thenReturn(task);

        helper.submitAIFeedback(task);

        verify(taskRepository).save(task);
    }

    @Test
    @DisplayName("submitAIFeedback saves quality score for too-small hours")
    void submitAIFeedback_invalidFeedback_tooSmall() {
        Task task = buildTask();
        task.setActualHours(BigDecimal.valueOf(0.01));

        when(taskRepository.save(any(Task.class))).thenReturn(task);

        helper.submitAIFeedback(task);

        verify(taskRepository).save(task);
    }

    @Test
    @DisplayName("submitAIFeedback saves quality score when scope changed too many times")
    void submitAIFeedback_invalidFeedback_tooManyScopeChanges() {
        Task task = buildTask();
        task.setScopeChangeCount(5);

        when(taskRepository.save(any(Task.class))).thenReturn(task);

        helper.submitAIFeedback(task);

        verify(taskRepository).save(task);
    }

    @Test
    @DisplayName("submitAIFeedback saves quality score when reassigned too many times")
    void submitAIFeedback_invalidFeedback_tooManyReassignments() {
        Task task = buildTask();
        task.setReassignmentCount(5);

        when(taskRepository.save(any(Task.class))).thenReturn(task);

        helper.submitAIFeedback(task);

        verify(taskRepository).save(task);
    }

    @Test
    @DisplayName("submitAIFeedback submits async when feedback is valid with no skills")
    void submitAIFeedback_valid_noSkills() {
        Task task = buildTask();

        when(taskRequiredSkillRepository.findByTaskId(task.getId())).thenReturn(Collections.emptyList());

        helper.submitAIFeedback(task);

        verify(taskRequiredSkillRepository).findByTaskId(task.getId());
    }

    @Test
    @DisplayName("submitAIFeedback submits async when feedback is valid with skills")
    void submitAIFeedback_valid_withSkills() {
        Task task = buildTask();

        Skill skill = new Skill();
        skill.setId(UUID.randomUUID());
        TaskRequiredSkill trs = new TaskRequiredSkill();
        trs.setSkill(skill);

        when(taskRequiredSkillRepository.findByTaskId(task.getId())).thenReturn(List.of(trs));

        helper.submitAIFeedback(task);

        verify(taskRequiredSkillRepository).findByTaskId(task.getId());
    }

    @Test
    @DisplayName("submitAIFeedback uses JWT token from SecurityContext when available")
    void submitAIFeedback_withSecurityContext_usesToken() {
        Task task = buildTask();

        var auth = new UsernamePasswordAuthenticationToken("user", "my-jwt-token");
        SecurityContextHolder.getContext().setAuthentication(auth);

        when(taskRequiredSkillRepository.findByTaskId(task.getId())).thenReturn(Collections.emptyList());

        helper.submitAIFeedback(task);

        verify(taskRequiredSkillRepository).findByTaskId(task.getId());
    }

    @Test
    @DisplayName("submitAIFeedback handles low quality score gracefully")
    void submitAIFeedback_lowQuality_savedWithLowScore() {
        Task task = buildTask();
        task.setDescription(null);
        task.setReassignmentCount(3);
        task.setDueDate(java.time.LocalDateTime.now().minusDays(20));
        task.setCompletedDate(java.time.LocalDateTime.now());
        task.setScopeChangeCount(2);
        task.setActualHours(BigDecimal.valueOf(5.0));

        when(taskRequiredSkillRepository.findByTaskId(task.getId())).thenReturn(Collections.emptyList());

        ResponseEntity<Map<String, Object>> response = ResponseEntity.ok(Map.of("should_retrain", false));
        when(restTemplate.exchange(
                anyString(),
                any(HttpMethod.class),
                any(HttpEntity.class),
                any(org.springframework.core.ParameterizedTypeReference.class)
        )).thenReturn(response);

        when(taskRepository.findById(task.getId())).thenReturn(java.util.Optional.of(task));
        when(taskRepository.save(any(Task.class))).thenReturn(task);

        helper.submitAIFeedback(task);

        // Verify save is eventually called on the async thread
        verify(taskRepository, timeout(2000)).save(task);
    }

    @Test
    @DisplayName("trackPrediction skips task with null predictedHours")
    void trackPrediction_skipsNullPredictedHours() {
        Task task = buildTask();
        task.setPredictedHours(null);

        helper.trackPrediction(task);

        verifyNoInteractions(restTemplate);
    }

    @Test
    @DisplayName("trackPrediction submits async when predictedHours is present")
    void trackPrediction_submitAsync_whenPredictedHoursPresent() {
        Task task = buildTask();
        task.setPredictedHours(BigDecimal.valueOf(10.0));

        helper.trackPrediction(task);

        // async call — just verify no exception thrown
    }

    @Test
    @DisplayName("submitAIFeedback handles exception gracefully")
    void submitAIFeedback_handlesException() {
        Task task = buildTask();

        when(taskRequiredSkillRepository.findByTaskId(any()))
                .thenThrow(new RuntimeException("DB error"));

        // Should not throw
        helper.submitAIFeedback(task);
    }
}
