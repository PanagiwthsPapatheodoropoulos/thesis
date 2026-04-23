package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.model.dto.TaskAuditLogDTO;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskAuditLog;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.TaskAuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Service responsible for recording and retrieving audit log entries for tasks.
 *
 * <p>
 * Audit logs capture significant actions (creation, status changes, field
 * edits) performed on tasks. Logging failures are swallowed internally so
 * they never interrupt the primary business flow.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class TaskAuditLogService {

    private final TaskAuditLogRepository auditLogRepository;
    private final ModelMapper modelMapper;

    /**
     * Records a general action performed on a task.
     *
     * @param task        the task entity on which the action occurred
     * @param user        the user who performed the action
     * @param action      a short, uppercase action identifier (e.g. "TASK_CREATED")
     * @param description a human-readable description of what happened
     */
    public void logTaskAction(Task task, User user, String action, String description) {
        try {
            TaskAuditLog auditLog = TaskAuditLog.builder()
                    .task(task)
                    .user(user)
                    .action(action)
                    .description(description)
                    .build();
            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.error("Failed to create audit log: {}", e.getMessage());
            // Don't throw - audit logging shouldn't break the main flow
        }
    }

    /**
     * Records a field-level change on a task (e.g. a status or priority update).
     *
     * @param task      the task entity that was modified
     * @param user      the user who made the change
     * @param fieldName the name of the field that changed
     * @param oldValue  the previous value of the field
     * @param newValue  the new value of the field
     */
    public void logFieldChange(Task task, User user, String fieldName,
            String oldValue, String newValue) {
        try {
            TaskAuditLog auditLog = TaskAuditLog.builder()
                    .task(task)
                    .user(user)
                    .action("FIELD_UPDATED")
                    .fieldName(fieldName)
                    .oldValue(oldValue)
                    .newValue(newValue)
                    .description(String.format("Changed %s from '%s' to '%s'",
                            fieldName, oldValue, newValue))
                    .build();
            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.error("Failed to log field change: {}", e.getMessage());
            // Don't throw - audit logging shouldn't break the main flow
        }
    }

    /**
     * Retrieves the full audit history for a task, ordered from newest to oldest.
     *
     * @param taskId UUID of the task
     * @return list of {@link TaskAuditLogDTO} entries, or an empty list on error
     */
    @Transactional(readOnly = true)
    public List<TaskAuditLogDTO> getTaskHistory(UUID taskId) {
        try {
            List<TaskAuditLog> logs = auditLogRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
            return logs.stream()
                    .map(this::mapToDTO)
                    .toList();
        } catch (Exception e) {
            log.error("Error fetching task history for task {}: {}", taskId, e.getMessage());
            // Return empty list instead of throwing
            return List.of();
        }
    }

    /**
     * Maps a {@link TaskAuditLog} entity to a {@link TaskAuditLogDTO},
     * handling null user and task references gracefully.
     *
     * @param auditLog the audit log entity to map
     * @return the populated DTO, or a minimal DTO on mapping failure
     */
    private TaskAuditLogDTO mapToDTO(TaskAuditLog auditLog) {
        try {
            TaskAuditLogDTO dto = modelMapper.map(auditLog, TaskAuditLogDTO.class); // Updated parameter name

            if (auditLog.getUser() != null) {
                dto.setUserId(auditLog.getUser().getId());
                dto.setUserName(auditLog.getUser().getUsername());
            } else {
                dto.setUserId(null);
                dto.setUserName("System");
            }

            if (auditLog.getTask() != null) {
                dto.setTaskId(auditLog.getTask().getId());
            }

            return dto;
        } catch (Exception e) {
            // Return a minimal DTO instead of throwing
            TaskAuditLogDTO dto = new TaskAuditLogDTO();
            dto.setId(auditLog.getId());
            dto.setAction(auditLog.getAction() != null ? auditLog.getAction() : "UNKNOWN");
            dto.setDescription(auditLog.getDescription() != null ? auditLog.getDescription() : "");
            dto.setUserName("System");
            dto.setCreatedAt(auditLog.getCreatedAt());
            return dto;
        }
    }
}