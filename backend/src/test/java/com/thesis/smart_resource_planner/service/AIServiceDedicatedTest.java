package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.util.ReflectionTestUtils.setField;

@ExtendWith(MockitoExtension.class)
@DisplayName("AIService Tests")
class AIServiceDedicatedTest {

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AIService aiService;

    @BeforeEach
    void setUp() {
        setField(aiService, "aiServiceUrl", "http://localhost:5000");
    }

    @Test
    @DisplayName("getAssignmentSuggestions returns suggestions from response body")
    void getAssignmentSuggestions_success() {
        UUID taskId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();

        Map<String, Object> body = Map.of(
                "suggestions", List.of(Map.of("employeeId", "e1", "score", 0.9)));

        when(restTemplate.exchange(
                contains("/api/ai/assignment/suggest"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenReturn(ResponseEntity.ok(body));

        List<Map<String, Object>> result = aiService.getAssignmentSuggestions(
                taskId,
                "Title",
                "Desc",
                "HIGH",
                5.0,
                List.of("Java"),
                0.7,
                "token",
                companyId);

        assertEquals(1, result.size());
        assertEquals("e1", result.get(0).get("employeeId"));
    }

    @Test
    @DisplayName("getAssignmentSuggestions returns empty list on exception")
    void getAssignmentSuggestions_exception() {
        when(restTemplate.exchange(anyString(), any(), any(), ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenThrow(new RuntimeException("boom"));

        List<Map<String, Object>> result = aiService.getAssignmentSuggestions(
                UUID.randomUUID(), "t", "d", "LOW", null, null, null, "t", UUID.randomUUID());

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("predictTaskDuration returns body or null on exception")
    void predictTaskDuration_successAndException() {
        UUID taskId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();

        Map<String, Object> body = Map.of("predicted_hours", 12.5);
        when(restTemplate.exchange(
                contains("/api/ai/prediction/predict"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenReturn(ResponseEntity.ok(body));

        Map<String, Object> ok = aiService.predictTaskDuration(taskId, "MEDIUM", 0.5, List.of(), "token", companyId);
        assertNotNull(ok);
        assertEquals(12.5, ((Number) ok.get("predicted_hours")).doubleValue(), 0.0001);

        when(restTemplate.exchange(
                contains("/api/ai/prediction/predict"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenThrow(new RuntimeException("fail"));

        Map<String, Object> bad = aiService.predictTaskDuration(taskId, "MEDIUM", 0.5, List.of(), "token", companyId);
        assertNull(bad);
    }

    @Test
    @DisplayName("detectAnomalies returns body and null on exception")
    void detectAnomalies_successAndException() {
        UUID companyId = UUID.randomUUID();
        Map<String, Object> body = Map.of("anomalies", List.of(Map.of("id", "a1")));

        when(restTemplate.exchange(
                contains("/api/ai/anomaly/detect"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenReturn(ResponseEntity.ok(body));

        Map<String, Object> ok = aiService.detectAnomalies("TASK", "123", "token", companyId);
        assertNotNull(ok);
        assertTrue(ok.containsKey("anomalies"));

        when(restTemplate.exchange(
                contains("/api/ai/anomaly/detect"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenThrow(new RuntimeException("boom"));

        assertNull(aiService.detectAnomalies("TASK", "123", "token", companyId));
    }

    @Test
    @DisplayName("getProductivityAnalytics uses defaults and handles errors")
    void getProductivityAnalytics_defaultsAndError() {
        UUID companyId = UUID.randomUUID();
        Map<String, Object> body = Map.of("productivity_score", 82.0);

        when(restTemplate.exchange(
                contains("/api/ai/analytics/productivity"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenReturn(ResponseEntity.ok(body));

        Map<String, Object> ok = aiService.getProductivityAnalytics(null, null, "token", companyId);
        assertNotNull(ok);
        assertEquals(82.0, ((Number) ok.get("productivity_score")).doubleValue(), 0.001);

        when(restTemplate.exchange(
                contains("/api/ai/analytics/productivity"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenThrow(new RuntimeException("nope"));

        assertNull(aiService.getProductivityAnalytics(7, true, "token", companyId));
    }

    @Test
    @DisplayName("bulkOptimizeAssignments returns assignments or empty fallback")
    void bulkOptimizeAssignments_successEmptyAndException() {
        UUID companyId = UUID.randomUUID();
        List<UUID> taskIds = List.of(UUID.randomUUID(), UUID.randomUUID());

        Map<String, Object> okBody = Map.of("assignments", List.of(Map.of("taskId", taskIds.get(0).toString())));
        when(restTemplate.exchange(
                contains("/api/ai/assignment/bulk-optimize"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenReturn(ResponseEntity.ok(okBody));

        List<Map<String, Object>> ok = aiService.bulkOptimizeAssignments(taskIds, null, "token", companyId);
        assertEquals(1, ok.size());

        when(restTemplate.exchange(
                contains("/api/ai/assignment/bulk-optimize"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenReturn(ResponseEntity.ok(Map.of("status", "ok")));
        List<Map<String, Object>> empty = aiService.bulkOptimizeAssignments(taskIds, false, "token", companyId);
        assertTrue(empty.isEmpty());

        when(restTemplate.exchange(
                contains("/api/ai/assignment/bulk-optimize"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenThrow(new RuntimeException("boom"));
        assertTrue(aiService.bulkOptimizeAssignments(taskIds, true, "token", companyId).isEmpty());
    }

    @Test
    @DisplayName("model performance and retraining happy and error paths")
    void modelPerformanceAndRetraining() {
        UUID companyId = UUID.randomUUID();

        when(restTemplate.exchange(
                contains("/api/ai/feedback/performance"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenReturn(ResponseEntity.ok(Map.of("mae", 1.23)));
        Map<String, Object> perf = aiService.getModelPerformance("token", companyId);
        assertNotNull(perf);
        assertEquals(1.23, ((Number) perf.get("mae")).doubleValue(), 0.001);

        when(restTemplate.exchange(
                contains("/api/ai/feedback/performance"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenThrow(new RuntimeException("fail"));
        assertNull(aiService.getModelPerformance("token", companyId));

        when(restTemplate.exchange(
                contains("/api/ai/feedback/trigger-training"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenReturn(ResponseEntity.ok(Map.of("started", true)));
        Map<String, Object> retrain = aiService.triggerRetraining(true, "token", companyId);
        assertNotNull(retrain);
        assertEquals(true, retrain.get("started"));

        when(restTemplate.exchange(
                contains("/api/ai/feedback/trigger-training"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
                .thenThrow(new RuntimeException("fail"));
        assertNull(aiService.triggerRetraining(false, "token", companyId));
    }

    @Test
    @DisplayName("private getJwtToken resolves credentials from security context")
    void getJwtToken_privateMethod() throws Exception {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("u", "jwt-token");
        SecurityContextHolder.getContext().setAuthentication(auth);

        Method method = AIService.class.getDeclaredMethod("getJwtToken");
        method.setAccessible(true);
        assertEquals("jwt-token", method.invoke(aiService));

        SecurityContextHolder.clearContext();
        Exception ex = assertThrows(Exception.class, () -> method.invoke(aiService));
        assertNotNull(ex.getCause());
        assertTrue(ex.getCause().getMessage().contains("No authentication token"));
    }
}

