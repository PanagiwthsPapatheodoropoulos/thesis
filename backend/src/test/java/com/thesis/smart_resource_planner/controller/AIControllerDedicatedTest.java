package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Skill;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.SkillRepository;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.AIService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AIControllerTest {

    private AIService aiService;
    private RestTemplate restTemplate;
    private SkillRepository skillRepository;
    private AIController controller;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        aiService = mock(AIService.class);
        restTemplate = mock(RestTemplate.class);
        skillRepository = mock(SkillRepository.class);
        controller = new AIController(aiService, restTemplate, skillRepository);
        ReflectionTestUtils.setField(controller, "aiServiceUrl", "http://localhost:5000");

        Company c = new Company();
        c.setId(UUID.randomUUID());
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setCompany(c);
        u.setUsername("u");
        u.setEmail("u@x.com");
        u.setPasswordHash("x");
        u.setRole(com.thesis.smart_resource_planner.enums.UserRole.ADMIN);
        principal = UserPrincipal.create(u);
    }

    @Test
    void getProductivityAnalytics_success() {
        when(aiService.getProductivityAnalytics(anyInt(), anyBoolean(), anyString(), any(UUID.class)))
                .thenReturn(Map.of("ok", true));
        var res = controller.getProductivityAnalytics(Map.of("time_period_days", 7, "bust_cache", true), principal,
                "Bearer t");
        assertEquals(200, res.getStatusCode().value());
        assertEquals(true, res.getBody().get("ok"));
    }

    @Test
    void chatbotHealth_error_returns503() {
        when(restTemplate.exchange(contains("/chatbot/health"), eq(HttpMethod.GET), any(HttpEntity.class),
                any(ParameterizedTypeReference.class)))
                .thenThrow(new RuntimeException("down"));
        var res = controller.chatbotHealth(principal, "Bearer t");
        assertEquals(503, res.getStatusCode().value());
    }

    @Test
    void getAssignmentSuggestions_missingCompany_returns400() {
        User noCompany = new User();
        noCompany.setId(UUID.randomUUID());
        noCompany.setUsername("nc");
        noCompany.setEmail("nc@x.com");
        noCompany.setPasswordHash("x");
        noCompany.setRole(com.thesis.smart_resource_planner.enums.UserRole.ADMIN);
        var p = UserPrincipal.create(noCompany);

        var res = controller.getAssignmentSuggestions(Map.of("taskId", UUID.randomUUID().toString()), p, "Bearer t");
        assertEquals(400, res.getStatusCode().value());
        assertTrue(res.getBody().containsKey("error"));
    }

    @Test
    void predictTaskDuration_serviceError_returnsOkWithError() {
        when(aiService.predictTaskDuration(any(UUID.class), anyString(), anyDouble(), anyList(), anyString(), any(UUID.class)))
                .thenThrow(new RuntimeException("prediction down"));
        var res = controller.predictTaskDuration(
                Map.of("taskId", "not-a-uuid", "priority", "HIGH", "requiredSkillIds", List.of("java")),
                principal,
                "Bearer t");
        assertEquals(200, res.getStatusCode().value());
        assertTrue(String.valueOf(res.getBody().get("error")).contains("prediction down"));
    }

    @Test
    void detectAnomalies_nullResult_returnsDefaultPayload() {
        when(aiService.detectAnomalies(anyString(), anyString(), anyString(), any(UUID.class))).thenReturn(null);
        var res = controller.detectAnomalies(Map.of("entityType", "TASK", "entityId", "all"), principal, "Bearer t");
        assertEquals(200, res.getStatusCode().value());
        assertEquals(0, res.getBody().get("anomalies_found"));
    }

    @Test
    void bulkOptimizeAssignments_success_usesGreedyLabelWhenFalse() {
        when(aiService.bulkOptimizeAssignments(anyList(), eq(false), anyString(), any(UUID.class)))
                .thenReturn(List.of(Map.of("taskId", "t1")));
        var id = UUID.randomUUID().toString();
        var res = controller.bulkOptimizeAssignments(
                Map.of("taskIds", List.of(id), "optimizeWorkload", false),
                principal,
                "Bearer t");
        assertEquals(200, res.getStatusCode().value());
        assertEquals("greedy", res.getBody().get("optimizationMethod"));
    }

    @Test
    void getModelInfo_returnsCompanyAndStatus() {
        var res = controller.getModelInfo(principal);
        assertEquals(200, res.getStatusCode().value());
        assertEquals("active", res.getBody().get("status"));
        assertEquals(principal.getCompanyId().toString(), String.valueOf(res.getBody().get("companyId")));
    }

    @Test
    void extractSkills_error_returns500() {
        when(restTemplate.exchange(contains("/skills/extract"), eq(HttpMethod.POST), any(HttpEntity.class),
                any(ParameterizedTypeReference.class)))
                .thenThrow(new RuntimeException("extract failed"));
        var res = controller.extractSkills(Map.of("text", "java spring"), principal, "Bearer t");
        assertEquals(500, res.getStatusCode().value());
        assertEquals("Skill extraction failed", res.getBody().get("error"));
    }

    @Test
    void pullModel_error_returns500() {
        when(restTemplate.exchange(contains("/chatbot/pull-model"), eq(HttpMethod.POST), any(HttpEntity.class),
                any(ParameterizedTypeReference.class)))
                .thenThrow(new RuntimeException("pull failed"));
        var res = controller.pullModel("phi3", principal, "Bearer t");
        assertEquals(500, res.getStatusCode().value());
        assertEquals("Failed to pull model", res.getBody().get("error"));
    }

    @Test
    void getAssignmentSuggestions_convertsSkillIdsAndNames() {
        UUID skillId = UUID.randomUUID();
        Skill skill = new Skill();
        skill.setId(skillId);
        skill.setName("Java");
        when(skillRepository.findById(skillId)).thenReturn(java.util.Optional.of(skill));
        when(aiService.getAssignmentSuggestions(any(UUID.class), anyString(), anyString(), anyString(), any(), anyList(), anyDouble(),
                anyString(), any(UUID.class)))
                .thenReturn(List.of(Map.of("employeeId", UUID.randomUUID().toString())));

        var res = controller.getAssignmentSuggestions(
                Map.of(
                        "taskId", "not-a-uuid",
                        "taskTitle", "Build API",
                        "description", "desc",
                        "priority", "HIGH",
                        "requiredSkillIds", List.of(skillId.toString(), "Spring")),
                principal,
                "Bearer t");

        assertEquals(200, res.getStatusCode().value());
        assertEquals(1, ((List<?>) res.getBody().get("suggestions")).size());
        verify(aiService).getAssignmentSuggestions(any(UUID.class), anyString(), anyString(), anyString(), any(), eq(List.of("Java", "Spring")),
                anyDouble(), eq("t"), eq(principal.getCompanyId()));
    }

    @Test
    void analyzeTaskComplexity_success_returnsForwardedBody() {
        when(restTemplate.exchange(contains("/task-analysis/analyze"), eq(HttpMethod.POST), any(HttpEntity.class),
                any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(Map.of("complexity_score", 0.77)));
        var res = controller.analyzeTaskComplexity(Map.of("title", "task"), principal, "Bearer t");
        assertEquals(200, res.getStatusCode().value());
        assertEquals(0.77, res.getBody().get("complexity_score"));
    }

    @Test
    void chatWithAI_success_injectsRoleContext() {
        when(restTemplate.exchange(contains("/chatbot/query"), eq(HttpMethod.POST), any(HttpEntity.class),
                any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(Map.of("response", "ok")));
        var res = controller.chatWithAI(Map.of("query", "hello"), principal, "Bearer t");
        assertEquals(200, res.getStatusCode().value());
        assertEquals("ok", res.getBody().get("response"));
    }

    @Test
    void chatbotHealth_success_returnsBody() {
        when(restTemplate.exchange(contains("/chatbot/health"), eq(HttpMethod.GET), any(HttpEntity.class),
                any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(Map.of("status", "healthy")));
        var res = controller.chatbotHealth(principal, "Bearer t");
        assertEquals(200, res.getStatusCode().value());
        assertEquals("healthy", res.getBody().get("status"));
    }

    @Test
    void pullModel_success_returnsBody() {
        when(restTemplate.exchange(contains("/chatbot/pull-model"), eq(HttpMethod.POST), any(HttpEntity.class),
                any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(Map.of("status", "pulled")));
        var res = controller.pullModel("phi3", principal, "Bearer t");
        assertEquals(200, res.getStatusCode().value());
        assertEquals("pulled", res.getBody().get("status"));
    }

    @Test
    void getProductivityAnalytics_defaultsWhenRequestNull() {
        when(aiService.getProductivityAnalytics(eq(30), eq(false), anyString(), any(UUID.class)))
                .thenReturn(Map.of("window_days", 30));

        var res = controller.getProductivityAnalytics(null, principal, "Bearer t");
        assertEquals(200, res.getStatusCode().value());
        assertEquals(30, res.getBody().get("window_days"));
    }

    @Test
    void triggerRetraining_success() {
        when(aiService.triggerRetraining(eq(true), anyString(), any(UUID.class)))
                .thenReturn(Map.of("status", "queued"));

        var res = controller.triggerRetraining(true, principal, "Bearer t");
        assertEquals(200, res.getStatusCode().value());
        assertEquals("queued", res.getBody().get("status"));
    }

    @Test
    void triggerRetraining_error_returnsOkWithError() {
        when(aiService.triggerRetraining(eq(false), anyString(), any(UUID.class)))
                .thenThrow(new RuntimeException("retrain down"));

        var res = controller.triggerRetraining(false, principal, "Bearer t");
        assertEquals(200, res.getStatusCode().value());
        assertTrue(String.valueOf(res.getBody().get("error")).contains("retrain down"));
    }

    @Test
    void predictTaskDuration_success_nullPayloadHandled() {
        when(aiService.predictTaskDuration(any(UUID.class), anyString(), anyDouble(), anyList(), anyString(), any(UUID.class)))
                .thenReturn(Map.of("predicted_hours", 5.5));

        var res = controller.predictTaskDuration(
                Map.of("taskId", UUID.randomUUID().toString(), "priority", "LOW", "requiredSkillIds", List.of()),
                principal,
                "Bearer t");
        assertEquals(200, res.getStatusCode().value());
        assertEquals(5.5, res.getBody().get("predicted_hours"));
    }

    @Test
    void detectAnomalies_error_returnsOkWithError() {
        when(aiService.detectAnomalies(anyString(), anyString(), anyString(), any(UUID.class)))
                .thenThrow(new RuntimeException("anomaly down"));
        var res = controller.detectAnomalies(Map.of("entityType", "TASK", "entityId", "id1"), principal, "Bearer t");
        assertEquals(200, res.getStatusCode().value());
        assertTrue(String.valueOf(res.getBody().get("error")).contains("anomaly down"));
    }
}

