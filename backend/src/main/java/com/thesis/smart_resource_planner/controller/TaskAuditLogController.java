package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.TaskAuditLogDTO;
import com.thesis.smart_resource_planner.service.TaskAuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for accessing the task audit log.
 * Provides a read-only view of the immutable change history for any given task,
 * recording all state transitions and field updates over its lifecycle.
 */
@RestController
@RequestMapping("/api/tasks/audit")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class TaskAuditLogController {

    private final TaskAuditLogService auditLogService;

    /**
     * Returns the full change history for a specific task.
     * Each entry in the log records a discrete state change, such as a status
     * update
     * or field modification, along with the user and timestamp.
     *
     * @param taskId The UUID of the task to retrieve audit history for.
     * @return A chronologically ordered list of audit log entries.
     */
    @GetMapping("/task/{taskId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<TaskAuditLogDTO>> getTaskHistory(@PathVariable UUID taskId) {
        // Load comprehensive history map
        List<TaskAuditLogDTO> history = auditLogService.getTaskHistory(taskId);
        return ResponseEntity.ok(history);
    }
}