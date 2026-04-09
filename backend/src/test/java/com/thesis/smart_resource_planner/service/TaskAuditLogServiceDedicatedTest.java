package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.model.dto.TaskAuditLogDTO;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskAuditLog;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.TaskAuditLogRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.modelmapper.ModelMapper;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TaskAuditLogService Tests")
class TaskAuditLogServiceDedicatedTest {

    @Mock
    private TaskAuditLogRepository auditLogRepository;

    @Mock
    private ModelMapper modelMapper;

    @InjectMocks
    private TaskAuditLogService service;

    @Test
    @DisplayName("logTaskAction swallows repository exceptions")
    void logTaskAction_swallowException() {
        doThrow(new RuntimeException("db")).when(auditLogRepository).save(any(TaskAuditLog.class));
        service.logTaskAction(new Task(), new User(), "TASK_CREATED", "desc");
        verify(auditLogRepository).save(any(TaskAuditLog.class));
    }

    @Test
    @DisplayName("getTaskHistory maps logs and returns empty list on error")
    void getTaskHistory_successAndError() {
        UUID taskId = UUID.randomUUID();

        TaskAuditLog log = TaskAuditLog.builder()
                .id(UUID.randomUUID())
                .action("FIELD_UPDATED")
                .description("d")
                .createdAt(LocalDateTime.now())
                .build();

        when(auditLogRepository.findByTaskIdOrderByCreatedAtDesc(taskId)).thenReturn(List.of(log));
        when(modelMapper.map(eq(log), eq(TaskAuditLogDTO.class))).thenReturn(new TaskAuditLogDTO());

        List<TaskAuditLogDTO> ok = service.getTaskHistory(taskId);
        assertEquals(1, ok.size());

        when(auditLogRepository.findByTaskIdOrderByCreatedAtDesc(taskId)).thenThrow(new RuntimeException("fail"));
        List<TaskAuditLogDTO> bad = service.getTaskHistory(taskId);
        assertNotNull(bad);
        assertTrue(bad.isEmpty());
    }
}

