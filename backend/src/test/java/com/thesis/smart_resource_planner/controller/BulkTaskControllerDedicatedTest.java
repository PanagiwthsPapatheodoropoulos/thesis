package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.enums.TaskStatus;
import com.thesis.smart_resource_planner.model.dto.BulkTaskActionDTO;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("BulkTaskController Dedicated Tests")
class BulkTaskControllerDedicatedTest {

    @Mock
    private TaskService taskService;

    private BulkTaskController controller;
    private UserPrincipal currentUser;

    @BeforeEach
    void setUp() {
        controller = new BulkTaskController(taskService);
        currentUser = new UserPrincipal(
                UUID.randomUUID(),
                "manager",
                "manager@example.com",
                "pw",
                List.of(new SimpleGrantedAuthority("ROLE_MANAGER")),
                true,
                UUID.randomUUID());
    }

    @Test
    @DisplayName("bulkUpdateStatus counts success and failures")
    void bulkUpdateStatus_mixedResults() {
        UUID ok = UUID.randomUUID();
        UUID fail = UUID.randomUUID();
        BulkTaskActionDTO dto = BulkTaskActionDTO.builder()
                .taskIds(List.of(ok, fail))
                .newStatus(TaskStatus.IN_PROGRESS)
                .build();

        when(taskService.updateTaskStatus(ok, TaskStatus.IN_PROGRESS, currentUser.getId())).thenReturn(null);
        doThrow(new RuntimeException("boom")).when(taskService)
                .updateTaskStatus(fail, TaskStatus.IN_PROGRESS, currentUser.getId());

        ResponseEntity<Map<String, Object>> response = controller.bulkUpdateStatus(dto, currentUser);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().get("success"));
        assertEquals(1, response.getBody().get("failed"));
        assertEquals(2, response.getBody().get("total"));
    }

    @Test
    @DisplayName("bulkDelete handles allowed denied and exception")
    void bulkDelete_mixedResults() {
        UUID allowed = UUID.randomUUID();
        UUID denied = UUID.randomUUID();
        UUID crashes = UUID.randomUUID();

        when(taskService.canUserDeleteTask(allowed, currentUser.getId())).thenReturn(true);
        when(taskService.canUserDeleteTask(denied, currentUser.getId())).thenReturn(false);
        when(taskService.canUserDeleteTask(crashes, currentUser.getId())).thenThrow(new RuntimeException("error"));

        ResponseEntity<Map<String, Object>> response = controller.bulkDelete(List.of(allowed, denied, crashes), currentUser);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().get("success"));
        assertEquals(2, response.getBody().get("failed"));
        assertEquals(3, response.getBody().get("total"));
    }

    @Test
    @DisplayName("bulkAssign parses UUIDs and counts invalid entries")
    void bulkAssign_mixedTaskIds() {
        Map<String, Object> payload = Map.of(
                "taskIds", List.of(UUID.randomUUID().toString(), "not-a-uuid"),
                "employeeId", UUID.randomUUID().toString());

        ResponseEntity<Map<String, Object>> response = controller.bulkAssign(payload, currentUser);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().get("success"));
        assertEquals(1, response.getBody().get("failed"));
        assertEquals(2, response.getBody().get("total"));
    }
}

