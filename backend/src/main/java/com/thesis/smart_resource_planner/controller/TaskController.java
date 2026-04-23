package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.enums.TaskPriority;
import com.thesis.smart_resource_planner.enums.TaskStatus;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST controller for task lifecycle management.
 * Handles creating, reading, updating, deleting, and filtering tasks.
 * Also manages task state transitions (approve, reject, status change).
 */
@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class TaskController {

    private final TaskService taskService;

    /**
     * Creates a new task in the system.
     * Validates that a title and due date are provided before delegating to the
     * service.
     *
     * @param createDTO   The task creation payload.
     * @param currentUser The authenticated user performing the action.
     * @return The newly created task, or 400 if validation fails.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TaskDTO> createTask(
            @Valid @RequestBody TaskCreateDTO createDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        try {
            // Validate ONLY required fields
            if (createDTO.getTitle() == null || createDTO.getTitle().trim().isEmpty()) {
                return ResponseEntity.badRequest().build();
            }

            if (createDTO.getDueDate() == null) {
                return ResponseEntity.badRequest().build();
            }

            TaskDTO task = taskService.createTask(createDTO, currentUser.getId());
            return ResponseEntity.status(HttpStatus.CREATED).body(task);

        } catch (ResourceNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Allows an employee to submit a task request for manager approval.
     *
     * @param createDTO   The task request payload.
     * @param currentUser The authenticated employee submitting the request.
     * @return The created task in PENDING_APPROVAL state.
     */
    @PostMapping("/request")
    @PreAuthorize("hasRole('EMPLOYEE')")
    public ResponseEntity<TaskDTO> requestTask(
            @Valid @RequestBody TaskCreateDTO createDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        TaskDTO task = taskService.createTaskRequest(createDTO, currentUser.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(task);
    }

    /**
     * Approves a pending task request, making it active.
     *
     * @param id          The ID of the task to approve.
     * @param currentUser The admin or manager approving the task.
     * @return The updated task.
     */
    @PatchMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TaskDTO> approveTask(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        TaskDTO task = taskService.approveTask(id, currentUser.getId());
        return ResponseEntity.ok(task);
    }

    /**
     * Rejects a pending task request.
     *
     * @param id          The ID of the task to reject.
     * @param currentUser The admin or manager rejecting the task.
     * @return 204 No Content on success.
     */
    @PatchMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> rejectTask(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        taskService.rejectTask(id, currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    /**
     * Retrieves all task requests that are pending approval for the current
     * manager.
     *
     * @param currentUser The authenticated manager or admin.
     * @return A list of pending task requests.
     */
    @GetMapping("/requests")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<TaskDTO>> getTaskRequests(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<TaskDTO> requests = taskService.getTaskRequests(currentUser.getId());
        return ResponseEntity.ok(requests);
    }

    /**
     * Returns the names of all skills required to complete the specified task.
     *
     * @param id The task UUID.
     * @return A list of skill names.
     */
    @GetMapping("/{id}/required-skills")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<String>> getTaskRequiredSkills(@PathVariable UUID id) {
        List<String> skillNames = taskService.getTaskRequiredSkillNames(id);
        return ResponseEntity.ok(skillNames);
    }

    /**
     * Updates the status of an existing task (e.g., IN_PROGRESS, DONE).
     *
     * @param id          The task UUID.
     * @param status      The target status value.
     * @param currentUser The user changing the status.
     * @return The updated task.
     */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<TaskDTO> updateTaskStatus(
            @PathVariable UUID id,
            @RequestParam TaskStatus status,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        TaskDTO task = taskService.updateTaskStatus(id, status, currentUser.getId());
        return ResponseEntity.ok(task);
    }

    /**
     * Checks whether the current user has permission to edit the specified task.
     *
     * @param id          The task UUID.
     * @param currentUser The user requesting the permission check.
     * @return True if editing is permitted, false otherwise.
     */
    @GetMapping("/{id}/can-edit")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Boolean> canEditTask(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        boolean canEdit = taskService.canUserEditTask(id, currentUser.getId());
        return ResponseEntity.ok(canEdit);
    }

    /**
     * Checks whether the current user has permission to delete the specified task.
     *
     * @param id          The task UUID.
     * @param currentUser The user requesting the permission check.
     * @return True if deletion is permitted, false otherwise.
     */
    @GetMapping("/{id}/can-delete")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Boolean> canDeleteTask(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        boolean canDelete = taskService.canUserDeleteTask(id, currentUser.getId());
        return ResponseEntity.ok(canDelete);
    }

    /**
     * Retrieves the full details of a single task by its ID.
     *
     * @param id The task UUID.
     * @return The task data transfer object.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<TaskDTO> getTaskById(@PathVariable UUID id) {
        TaskDTO task = taskService.getTaskById(id);
        return ResponseEntity.ok(task);
    }

    /**
     * Retrieves all tasks visible to the current user based on their role and team
     * membership.
     *
     * @param currentUser The authenticated user.
     * @return A list of tasks.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<TaskDTO>> getAllTasks(@AuthenticationPrincipal UserPrincipal currentUser) {
        List<TaskDTO> tasks = taskService.getAllTasks(currentUser.getId());
        return ResponseEntity.ok(tasks);
    }

    /**
     * Maps a camelCase Java property name to its corresponding database column
     * name.
     * Required because Spring Data's Sort does not handle camelCase-to-snake_case
     * conversion.
     *
     * @param propertyName The Java property name (e.g., "createdAt").
     * @return The mapped database column name (e.g., "created_at").
     */
    private String mapPropertyToColumn(String propertyName) {
        return switch (propertyName) {
            case "createdAt" -> "created_at";
            case "updatedAt" -> "updated_at";
            case "dueDate" -> "due_date";
            case "startDate" -> "start_date";
            case "completedDate" -> "completed_date";
            case "estimatedHours" -> "estimated_hours";
            case "actualHours" -> "actual_hours";
            case "teamId" -> "team_id";
            case "assignedEmployeeId" -> "assigned_employee_id";
            // For fields that match exactly (no camelCase), return as-is
            default -> propertyName;
        };
    }

    /**
     * Retrieves the required skills for multiple tasks in a single batch request.
     * Accepts a list of task ID strings and returns a map of task ID to skill name
     * list.
     *
     * @param taskIds A list of task UUIDs as strings.
     * @return A map where each key is a task ID and the value is its list of
     *         required skills.
     */
    @GetMapping("/required-skills/batch")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Map<String, List<String>>> getTaskRequiredSkillsBatch(
            @RequestParam List<String> taskIds) {
        try {
            // Convert string IDs to UUIDs
            List<UUID> taskUUIDs = taskIds.stream()
                    .map(UUID::fromString)
                    .toList();

            // Call service method
            Map<String, List<String>> result = taskService.getTaskRequiredSkillsBatch(taskUUIDs);

            return ResponseEntity.ok(result);

        } catch (IllegalArgumentException e) {
            log.error("Invalid task ID format in batch request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(new HashMap<>());

        } catch (Exception e) {
            log.error("Error in batch task skills endpoint: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new HashMap<>());
        }
    }

    /**
     * Returns a paginated, sorted, and optionally filtered list of tasks.
     * Supports filtering by status, priority, and a free-text search.
     *
     * @param currentUser The authenticated user (scopes results by role).
     * @param page        Zero-based page number (default 0).
     * @param size        Number of records per page (default 20).
     * @param sortBy      Java property name to sort by (default "createdAt").
     * @param sortDir     Sort direction, "asc" or "desc" (default "desc").
     * @param status      Optional status filter string (e.g., "IN_PROGRESS").
     * @param priority    Optional priority filter string (e.g., "HIGH").
     * @param search      Optional free-text search applied to title/description.
     * @return A Spring Data Page of matching tasks.
     */
    @GetMapping("/paginated")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Page<TaskDTO>> getTasksPaginated(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String search) {

        Sort.Direction direction = sortDir.equalsIgnoreCase("desc")
                ? Sort.Direction.DESC
                : Sort.Direction.ASC;

        // MAP Java property names to database column names
        String dbColumnName = mapPropertyToColumn(sortBy);
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, dbColumnName));

        // Convert strings to enums (null if "ALL" or invalid)
        TaskStatus statusEnum = null;
        if (status != null && !status.equals("ALL")) {
            try {
                statusEnum = TaskStatus.valueOf(status);
            } catch (IllegalArgumentException e) {
                log.warn("Invalid status filter: {}", status);
            }
        }

        TaskPriority priorityEnum = null;
        if (priority != null && !priority.equals("ALL")) {
            try {
                priorityEnum = TaskPriority.valueOf(priority);
            } catch (IllegalArgumentException e) {
                log.warn("Invalid priority filter: {}", priority);
            }
        }

        // Pass filters to service
        Page<TaskDTO> tasks = taskService.getTasksPaginated(
                currentUser.getId(),
                pageable,
                statusEnum,
                priorityEnum,
                search);

        return ResponseEntity.ok(tasks);
    }

    /**
     * Retrieves all tasks matching a specific status.
     *
     * @param status The status to filter by.
     * @return A list of tasks with the specified status.
     */
    @GetMapping("/status/{status}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<TaskDTO>> getTasksByStatus(@PathVariable TaskStatus status) {
        List<TaskDTO> tasks = taskService.getTasksByStatus(status);
        return ResponseEntity.ok(tasks);
    }

    /**
     * Retrieves all tasks matching a specific priority level.
     *
     * @param priority The priority level to filter by.
     * @return A list of tasks with the specified priority.
     */
    @GetMapping("/priority/{priority}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<TaskDTO>> getTasksByPriority(@PathVariable TaskPriority priority) {
        List<TaskDTO> tasks = taskService.getTasksByPriority(priority);
        return ResponseEntity.ok(tasks);
    }

    /**
     * Retrieves all tasks assigned to a specific team.
     *
     * @param teamId The UUID of the team.
     * @return A list of tasks for that team.
     */
    @GetMapping("/team/{teamId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<TaskDTO>> getTasksByTeam(@PathVariable UUID teamId) {
        List<TaskDTO> tasks = taskService.getTasksByTeam(teamId);
        return ResponseEntity.ok(tasks);
    }

    /**
     * Retrieves all tasks that have passed their due date without being completed.
     *
     * @return A list of overdue tasks.
     */
    @GetMapping("/overdue")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<TaskDTO>> getOverdueTasks() {
        List<TaskDTO> tasks = taskService.getOverdueTasks();
        return ResponseEntity.ok(tasks);
    }

    /**
     * Updates the details of an existing task.
     * Enforces a permission check before allowing the update.
     *
     * @param id          The UUID of the task to update.
     * @param updateDTO   The updated task data.
     * @param currentUser The user performing the update.
     * @return The updated task, or 403 if the user lacks permission.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<TaskDTO> updateTask(
            @PathVariable UUID id,
            @Valid @RequestBody TaskUpdateDTO updateDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        if (!taskService.canUserEditTask(id, currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        TaskDTO updated = taskService.updateTask(id, updateDTO, currentUser.getId());
        return ResponseEntity.ok(updated);
    }

    /**
     * Deletes a task permanently.
     * Enforces a permission check before allowing the deletion.
     *
     * @param id          The UUID of the task to delete.
     * @param currentUser The user performing the deletion.
     * @return 204 No Content on success, or 403 if the user lacks permission.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Void> deleteTask(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        if (!taskService.canUserDeleteTask(id, currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        taskService.deleteTask(id);
        return ResponseEntity.noContent().build();
    }
}