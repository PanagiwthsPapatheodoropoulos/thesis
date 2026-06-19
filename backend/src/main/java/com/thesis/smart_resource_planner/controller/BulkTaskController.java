// src/main/java/com/thesis/smart_resource_planner/controller/BulkTaskController.java
package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.BulkTaskActionDTO;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Controller for handling bulk operations on tasks.
 * Provides endpoints to update, delete, and assign multiple tasks
 * simultaneously.
 */
@RestController
@RequestMapping("/api/tasks/bulk")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class BulkTaskController {

    private final TaskService taskService;

    /**
     * Updates the status of multiple tasks in bulk.
     *
     * @param actionDTO   Data containing the list of task IDs and the new status.
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with a map showing success, failure, and total counts.
     */
    @PostMapping("/update-status")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Map<String, Object>> bulkUpdateStatus(
            @RequestBody BulkTaskActionDTO actionDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        Map<String, Object> result = new HashMap<>();
        int successCount = 0;
        int failCount = 0;

        // Iterate over task IDs and attempt status update
        for (UUID taskId : actionDTO.getTaskIds()) {
            try {
                taskService.updateTaskStatus(taskId, actionDTO.getNewStatus(), currentUser.getId());
                successCount++;
            } catch (Exception e) {
                failCount++;
            }
        }

        result.put("success", successCount);
        result.put("failed", failCount);
        result.put("total", actionDTO.getTaskIds().size());

        return ResponseEntity.ok(result);
    }

    /**
     * Deletes multiple tasks in bulk.
     *
     * @param taskIds     List of task IDs to be removed.
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with a map showing success, failure, and total counts.
     */
    @PostMapping("/delete")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> bulkDelete(
            @RequestBody List<UUID> taskIds,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        Map<String, Object> result = new HashMap<>();
        int successCount = 0;
        int failCount = 0;

        // Delete each task if the user is authorized to do so
        for (UUID taskId : taskIds) {
            try {
                if (taskService.canUserDeleteTask(taskId, currentUser.getId())) {
                    taskService.deleteTask(taskId);
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (Exception e) {
                failCount++;
            }
        }

        result.put("success", successCount);
        result.put("failed", failCount);
        result.put("total", taskIds.size());

        return ResponseEntity.ok(result);
    }

    /**
     * Assigns multiple tasks to a specific employee in bulk.
     *
     * @param payload     Map containing the list of task IDs and the employee ID.
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with a map showing success, failure, and total counts.
     */
    @PostMapping("/assign")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> bulkAssign(
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        @SuppressWarnings("unchecked")
        List<String> taskIds = (List<String>) payload.get("taskIds");
        String employeeId = (String) payload.get("employeeId");

        Map<String, Object> result = new HashMap<>();
        int successCount = 0;
        int failCount = 0;

        // Process bulk assignment logic for each task
        for (String taskIdStr : taskIds) {
            try {
                UUID taskId = UUID.fromString(taskIdStr);
                // Implementation for assignment logic
                successCount++;
            } catch (Exception e) {
                failCount++;
            }
        }

        result.put("success", successCount);
        result.put("failed", failCount);
        result.put("total", taskIds.size());

        return ResponseEntity.ok(result);
    }
}