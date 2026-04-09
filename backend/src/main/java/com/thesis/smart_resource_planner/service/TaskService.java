// src/main/java/com/thesis/smart_resource_planner/service/TaskService.java
package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.*;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.Map;

/**
 * Central service for task lifecycle management.
 *
 * <p>
 * Covers the full task lifecycle: creation by admin/manager, employee task
 * requests, approval and rejection flows, status updates, paginated retrieval,
 * role-based visibility filtering, permission checks, audit logging, real-time
 * WebSocket broadcasting, and async AI-feedback submission on completion.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class TaskService {

    private final TaskRepository taskRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final TaskAssignmentRepository taskAssignmentRepository;
    private final TaskPermissionRepository taskPermissionRepository;
    private final NotificationService notificationService;
    private final EmployeeRepository employeeRepository;
    private final ModelMapper modelMapper;
    private final SimpMessagingTemplate messagingTemplate;
    private final WebSocketBroadcastService broadcastService;
    private final TaskAuditLogService auditLogService;
    private final TaskRequiredSkillRepository taskRequiredSkillRepository;
    private final SkillRepository skillRepository;
    private final RestTemplate restTemplate;
    private static final double MAX_TASK_HOURS = 200.0;
    private static final double MIN_TASK_HOURS = 0.25;
    private static final int MAX_SCOPE_CHANGES = 2;
    private static final int MAX_REASSIGNMENTS = 3;

    /** Returns the emoji icon associated with a given task status. */
    private String getStatusIcon(TaskStatus status) {
        return switch (status) {
            case PENDING -> "⏳";
            case IN_PROGRESS -> "🔄";
            case COMPLETED -> "✅";
            case BLOCKED -> "🚫";
            case CANCELLED -> "❌";
        };
    }

    // CREATE TASK (Admin/Manager)
    /**
     * Creates a new task, links required skills, records an audit log entry,
     * optionally assigns it to a specific employee, grants the creator full
     * permissions, and notifies relevant users via WebSocket after commit.
     *
     * @param createDTO       DTO with task details, optional team/employee/skill
     *                        IDs
     * @param createdByUserId UUID of the admin or manager creating the task
     * @return the saved {@link TaskDTO}
     */
    public TaskDTO createTask(TaskCreateDTO createDTO, UUID createdByUserId) {
        try {
            User createdBy = userRepository.findById(createdByUserId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found"));

            Task task = new Task();
            task.setTitle(createDTO.getTitle());
            task.setDescription(createDTO.getDescription());
            task.setPriority(createDTO.getPriority());
            task.setEstimatedHours(createDTO.getEstimatedHours());
            task.setStartDate(createDTO.getStartDate());
            task.setDueDate(createDTO.getDueDate());
            task.setComplexityScore(createDTO.getComplexityScore());
            task.setCreatedBy(createdBy);
            task.setStatus(TaskStatus.PENDING);
            task.setActualHours(java.math.BigDecimal.ZERO);
            task.setCompany(createdBy.getCompany());

            // Set team if provided
            if (createDTO.getTeamId() != null) {
                Team team = teamRepository.findById(createDTO.getTeamId())
                        .orElseThrow(() -> new ResourceNotFoundException("Team not found: " + createDTO.getTeamId()));
                task.setTeam(team);
            }

            // Save task FIRST, then handle assignments
            Task savedTask = taskRepository.saveAndFlush(task);

            if (savedTask.getPredictedHours() != null) {
                trackPrediction(savedTask);
            }

            if (createDTO.getRequiredSkillIds() != null && !createDTO.getRequiredSkillIds().isEmpty()) {

                for (UUID skillId : createDTO.getRequiredSkillIds()) {
                    try {
                        // Try to find skill by ID first, then by name
                        Skill skill = skillRepository.findById(skillId).orElse(null);

                        if (skill == null) {
                            // Maybe if it's a skill name stored as UUID format
                            String potentialSkillName = skillId.toString();
                            skill = skillRepository.findByNameIgnoreCase(potentialSkillName)
                                    .orElseThrow(() -> new ResourceNotFoundException(
                                            "Skill not found by ID or name: " + skillId));
                        }

                        // Check for duplicates before saving
                        boolean alreadyLinked = taskRequiredSkillRepository
                                .existsByTaskIdAndSkillId(savedTask.getId(), skill.getId());

                        if (alreadyLinked) {
                            continue;
                        }

                        TaskRequiredSkill taskSkill = TaskRequiredSkill.builder()
                                .task(savedTask)
                                .skill(skill)
                                .build();

                        taskRequiredSkillRepository.saveAndFlush(taskSkill);

                    } catch (Exception e) {
                        log.error("Failed to link skill {}: {}", skillId, e.getMessage(), e);
                        // Don't fail entire task creation if one skill fails
                    }
                }

                // Log what was actually saved for debugging
                List<UUID> savedSkillIds = getTaskRequiredSkillIds(savedTask.getId());

            }

            // Create audit log
            try {
                auditLogService.logTaskAction(savedTask, createdBy, "TASK_CREATED",
                        "Task created: " + savedTask.getTitle());
            } catch (Exception e) {
                log.warn("Audit log failed: {}", e.getMessage());
            }

            // Handle specific employee assignment
            if (createDTO.getAssignedEmployeeId() != null) {
                Employee assignedEmployee = employeeRepository.findById(createDTO.getAssignedEmployeeId())
                        .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

                savedTask.setAssignedEmployeeId(createDTO.getAssignedEmployeeId());
                savedTask = taskRepository.saveAndFlush(savedTask);

                TaskAssignment assignment = TaskAssignment.builder()
                        .task(savedTask)
                        .employee(assignedEmployee)
                        .assignedBy(AssignedByType.MANUAL)
                        .assignedByUser(createdBy)
                        .status(TaskAssignmentStatus.PENDING)
                        .assignedDate(LocalDateTime.now())
                        .build();

                taskAssignmentRepository.saveAndFlush(assignment);

                // Notify ONLY the assigned employee
                final Employee finalEmployee = assignedEmployee;
                final Task finalTask = savedTask;

                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            Set<UUID> notifiedUsers = new HashSet<>();

                            // 1. If personally assigned, notify ONLY that employee
                            if (finalTask.getAssignedEmployeeId() != null) {
                                Employee assignedEmployee = employeeRepository
                                        .findById(finalTask.getAssignedEmployeeId())
                                        .orElse(null);

                                if (assignedEmployee != null && assignedEmployee.getUser() != null) {
                                    NotificationCreateDTO notification = new NotificationCreateDTO();
                                    notification.setUserId(assignedEmployee.getUser().getId());
                                    notification.setType("TASK_ASSIGNED");
                                    notification.setTitle("📋 Personal Task Assignment");
                                    notification.setMessage(
                                            "You have been personally assigned to task: " + finalTask.getTitle());
                                    notification.setSeverity(NotificationSeverity.INFO);
                                    notification.setRelatedEntityType(EntityType.TASK);
                                    notification.setRelatedEntityId(finalTask.getId());

                                    notificationService.createNotification(notification);
                                    notifiedUsers.add(assignedEmployee.getUser().getId());

                                    TaskDTO taskDTO = modelMapper.map(finalTask, TaskDTO.class);
                                    broadcastService.broadcastTaskCreated(assignedEmployee.getUser().getId(), taskDTO);

                                }
                            }
                            // 2. If team task (no specific assignment), notify team members
                            else if (finalTask.getTeam() != null) {
                                List<User> teamMembers = userRepository.findByTeamId(finalTask.getTeam().getId());
                                TaskDTO taskDTO = modelMapper.map(finalTask, TaskDTO.class);

                                for (User member : teamMembers) {
                                    // Skip if already notified
                                    if (notifiedUsers.contains(member.getId()))
                                        continue;

                                    // Only notify employees/managers
                                    if (member.getRole() == UserRole.EMPLOYEE ||
                                            member.getRole() == UserRole.MANAGER) {

                                        NotificationCreateDTO notification = new NotificationCreateDTO();
                                        notification.setUserId(member.getId());
                                        notification.setType("TASK_ASSIGNED");
                                        notification.setTitle("📋 New Team Task");
                                        notification.setMessage("New task for your team: " + finalTask.getTitle());
                                        notification.setSeverity(NotificationSeverity.INFO);
                                        notification.setRelatedEntityType(EntityType.TASK);
                                        notification.setRelatedEntityId(finalTask.getId());

                                        notificationService.createNotification(notification);
                                        broadcastService.broadcastTaskCreated(member.getId(), taskDTO);
                                        notifiedUsers.add(member.getId());
                                    }
                                }
                            }
                            // 3. Public task - notify ALL employees in the company
                            else {
                                List<User> allEmployees = userRepository.findByRoleAndCompanyId(
                                        UserRole.EMPLOYEE,
                                        createdBy.getCompany().getId());
                                List<User> allManagers = userRepository.findByRoleAndCompanyId(
                                        UserRole.MANAGER,
                                        createdBy.getCompany().getId());

                                List<User> allUsers = new ArrayList<>(allEmployees);
                                allUsers.addAll(allManagers);

                                TaskDTO taskDTO = modelMapper.map(finalTask, TaskDTO.class);

                                for (User user : allUsers) {
                                    // Skip if already notified
                                    if (notifiedUsers.contains(user.getId()))
                                        continue;

                                    NotificationCreateDTO notification = new NotificationCreateDTO();
                                    notification.setUserId(user.getId());
                                    notification.setType("TASK_ASSIGNED");
                                    notification.setTitle("📋 New Public Task");
                                    notification.setMessage("New task available: " + finalTask.getTitle());
                                    notification.setSeverity(NotificationSeverity.INFO);
                                    notification.setRelatedEntityType(EntityType.TASK);
                                    notification.setRelatedEntityId(finalTask.getId());

                                    notificationService.createNotification(notification);
                                    broadcastService.broadcastTaskCreated(user.getId(), taskDTO);
                                    notifiedUsers.add(user.getId());
                                }
                            }
                        } catch (Exception e) {
                            log.error("Failed to send notifications: {}", e.getMessage(), e);
                        }
                    }
                });
            }

            // Grant permissions to creator
            grantTaskPermissions(savedTask.getId(), createdByUserId, true, true, true, createdByUserId);

            TaskDTO result = modelMapper.map(savedTask, TaskDTO.class);
            return result;

        } catch (Exception e) {
            throw new RuntimeException("Failed to create task: " + e.getMessage());
        }
    }

    // EMPLOYEE REQUEST TASK
    /**
     * Allows an employee to submit a task request for manager review.
     * The request is prefixed with "[REQUEST]" in its title and triggers
     * notifications
     * to all managers and admins in the company after commit.
     *
     * @param createDTO         DTO with task details
     * @param requestedByUserId UUID of the employee submitting the request
     * @return the saved {@link TaskDTO} representing the pending request
     */
    public TaskDTO createTaskRequest(TaskCreateDTO createDTO, UUID requestedByUserId) {
        try {
            User requestedBy = userRepository.findById(requestedByUserId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found"));

            Task task = new Task();
            task.setTitle("[REQUEST] " + createDTO.getTitle());
            task.setDescription(createDTO.getDescription());
            task.setPriority(createDTO.getPriority());
            task.setEstimatedHours(createDTO.getEstimatedHours());
            task.setStartDate(createDTO.getStartDate());
            task.setDueDate(createDTO.getDueDate());
            task.setComplexityScore(createDTO.getComplexityScore());
            task.setCreatedBy(requestedBy);
            task.setStatus(TaskStatus.PENDING);
            task.setTeam(null);
            task.setActualHours(BigDecimal.ZERO);
            task.setCompany(requestedBy.getCompany());
            task.setIsEmployeeRequest(true); // Mark as employee request

            if (createDTO.getRequiredSkillIds() != null && !createDTO.getRequiredSkillIds().isEmpty()) {
                // Single query to validate all skills
                List<UUID> existingSkills = skillRepository.findExistingSkillIds(createDTO.getRequiredSkillIds());

                if (existingSkills.size() != createDTO.getRequiredSkillIds().size()) {
                    Set<UUID> missing = new HashSet<>(createDTO.getRequiredSkillIds());
                    missing.removeAll(existingSkills);
                    throw new ResourceNotFoundException("Skills not found: " + missing);
                }
            }

            Task savedTask = taskRepository.saveAndFlush(task);

            UUID companyId = requestedBy.getCompany().getId();
            final Task finalTask = savedTask;
            final User originalRequester = requestedBy;

            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        List<User> managers = userRepository.findByRoleAndCompanyId(UserRole.MANAGER, companyId);
                        List<User> admins = userRepository.findByRoleAndCompanyId(UserRole.ADMIN, companyId);
                        List<User> allApprovers = new ArrayList<>(managers);
                        allApprovers.addAll(admins);

                        for (User approver : allApprovers) {
                            try {
                                NotificationCreateDTO notification = new NotificationCreateDTO();
                                notification.setUserId(approver.getId());
                                notification.setType("TASK_REQUEST");
                                notification.setTitle("📝 New Task Request from " + originalRequester.getUsername());
                                notification.setMessage(originalRequester.getUsername() + " requested: " +
                                        finalTask.getTitle().replace("[REQUEST] ", ""));
                                notification.setSeverity(NotificationSeverity.WARNING);
                                notification.setRelatedEntityType(EntityType.TASK);
                                notification.setRelatedEntityId(finalTask.getId());

                                notificationService.createNotification(notification);
                            } catch (Exception notifError) {
                                log.error("Failed to notify {}: {}", approver.getUsername(), notifError.getMessage());
                            }
                        }
                    } catch (Exception e) {
                        log.error("Failed to send notifications: {}", e.getMessage());
                    }
                }
            });

            return modelMapper.map(savedTask, TaskDTO.class);

        } catch (Exception e) {
            throw new RuntimeException("Failed to create task request: " + e.getMessage());
        }
    }

    // MANAGER APPROVES TASK REQUEST
    /**
     * Approves a pending task request: removes the "[REQUEST]" title prefix,
     * sets status to PENDING, grants the original requester view permission,
     * and notifies the requester (and team members when relevant) after commit.
     *
     * @param taskId           UUID of the task to approve
     * @param approvedByUserId UUID of the manager/admin approving the request
     * @return the updated {@link TaskDTO}
     */
    public TaskDTO approveTask(UUID taskId, UUID approvedByUserId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        User approvedBy = userRepository.findById(approvedByUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Remove [REQUEST] prefix but KEEP isEmployeeRequest flag
        if (task.getTitle().startsWith("[REQUEST]")) {
            task.setTitle(task.getTitle().replace("[REQUEST] ", "").trim());
        }

        task.setStatus(TaskStatus.PENDING);
        // DO NOT reset isEmployeeRequest - it stays true forever
        Task updated = taskRepository.save(task);

        grantTaskPermissions(taskId, task.getCreatedBy().getId(), false, false, true, approvedByUserId);

        // Send notifications AFTER commit
        final Task finalTask = updated;
        final User originalRequester = task.getCreatedBy();

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                // 1.ALWAYS notify the original requester
                NotificationCreateDTO requesterNotif = new NotificationCreateDTO();
                requesterNotif.setUserId(originalRequester.getId());
                requesterNotif.setType("TASK_APPROVED");
                requesterNotif.setTitle("✅ Task Request Approved");
                requesterNotif.setMessage("Your task request '" + finalTask.getTitle() + "' has been approved!");
                requesterNotif.setSeverity(NotificationSeverity.SUCCESS);
                requesterNotif.setRelatedEntityType(EntityType.TASK);
                requesterNotif.setRelatedEntityId(finalTask.getId());

                notificationService.createNotification(requesterNotif);

                // 2.ONLY notify team members if task was assigned to a team during approval
                // (Employee requests start with team = null)
                if (finalTask.getTeam() != null) {
                    try {
                        List<User> teamMembers = userRepository.findByTeamId(finalTask.getTeam().getId());
                        TaskDTO taskDTO = modelMapper.map(finalTask, TaskDTO.class);

                        for (User member : teamMembers) {
                            // Skip the requester (already notified above)
                            if (member.getId().equals(originalRequester.getId())) {
                                continue;
                            }

                            NotificationCreateDTO teamNotif = new NotificationCreateDTO();
                            teamNotif.setUserId(member.getId());
                            teamNotif.setType("TASK_APPROVED");
                            teamNotif.setTitle("✅ Task Approved");
                            teamNotif.setMessage(
                                    "Task '" + finalTask.getTitle() + "' has been approved and is now available");
                            teamNotif.setSeverity(NotificationSeverity.INFO);
                            teamNotif.setRelatedEntityType(EntityType.TASK);
                            teamNotif.setRelatedEntityId(finalTask.getId());

                            notificationService.createNotification(teamNotif);
                            broadcastService.broadcastTaskCreated(member.getId(), taskDTO);
                        }

                    } catch (Exception e) {
                        log.error("Failed to notify team members: {}", e.getMessage());
                    }
                } else {
                    log.info("Approved task has no team - only requester notified");
                }
            }
        });

        // Broadcast status update
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                broadcastTaskStatusUpdate(updated);
            }
        });
        return modelMapper.map(updated, TaskDTO.class);
    }

    // REJECT TASK REQUEST
    /**
     * Rejects a pending task request by cancelling it and notifying the requester.
     *
     * @param taskId           UUID of the task request to reject
     * @param rejectedByUserId UUID of the manager/admin rejecting the request
     */
    public void rejectTask(UUID taskId, UUID rejectedByUserId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        User rejectedBy = userRepository.findById(rejectedByUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Get the requester BEFORE changing status
        final User requester = task.getCreatedBy();
        final String taskTitle = task.getTitle().replace("[REQUEST] ", "");

        // Mark as cancelled
        task.setStatus(TaskStatus.CANCELLED);
        taskRepository.save(task);

        // Send notification AFTER commit
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                NotificationCreateDTO notification = new NotificationCreateDTO();
                notification.setUserId(requester.getId());
                notification.setType("TASK_REJECTED");
                notification.setTitle("❌ Task Request Rejected");
                notification.setMessage(
                        "Your task request '" + taskTitle + "' was rejected by " + rejectedBy.getUsername());
                notification.setSeverity(NotificationSeverity.WARNING);
                notification.setRelatedEntityType(EntityType.TASK);
                notification.setRelatedEntityId(task.getId());

                notificationService.createNotification(notification);
            }
        });

    }

    /**
     * Batch fetch required skills for multiple tasks
     * 
     * @param taskIds List of task UUIDs
     * @return Map of task ID to list of skill IDs
     */
    @Transactional(readOnly = true)
    public Map<String, List<String>> getTaskRequiredSkillsBatch(List<UUID> taskIds) {
        Map<String, List<String>> result = new HashMap<>();

        if (taskIds == null || taskIds.isEmpty()) {
            return result;
        }

        try {
            // Single query to fetch all task skills
            List<TaskRequiredSkill> allSkills = taskRequiredSkillRepository
                    .findByTaskIdIn(taskIds);

            // Group by task ID
            Map<UUID, List<TaskRequiredSkill>> skillsByTask = allSkills.stream()
                    .collect(Collectors.groupingBy(trs -> trs.getTask().getId()));

            // Build response map
            for (UUID taskId : taskIds) {
                List<TaskRequiredSkill> taskSkills = skillsByTask.getOrDefault(taskId, List.of());

                List<String> skillIds = taskSkills.stream()
                        .filter(trs -> trs.getSkill() != null)
                        .map(trs -> trs.getSkill().getId().toString())
                        .toList();

                result.put(taskId.toString(), skillIds);
            }

            return result;

        } catch (Exception e) {
            log.error("Error fetching batch task skills for {} tasks: {}",
                    taskIds.size(), e.getMessage(), e);

            // Return empty lists for all tasks on error
            for (UUID taskId : taskIds) {
                result.put(taskId.toString(), List.of());
            }
            return result;
        }
    }

    /**
     * Calculates actual hours for a task using start/creation time and completion
     * time.
     * Applies sanity bounds: tasks under 15 minutes are rounded to 0.5 h;
     * tasks exceeding {@value #MAX_TASK_HOURS} hours fall back to estimated hours.
     *
     * @param task the task entity
     * @return calculated actual hours, rounded to 1 decimal place
     */
    private BigDecimal calculateActualHours(Task task) {
        LocalDateTime startTime = null;

        // Priority 1: Use startDate if available (most accurate)
        if (task.getStartDate() != null) {
            startTime = task.getStartDate();
        }
        // Priority 2: Use createdAt as fallback
        else if (task.getCreatedAt() != null) {
            startTime = task.getCreatedAt();
        }

        // If no start time, use estimated hours
        if (startTime == null) {
            log.warn("Task {} has no start time, using estimated hours", task.getId());
            return task.getEstimatedHours() != null
                    ? task.getEstimatedHours()
                    : BigDecimal.valueOf(8.0);
        }

        LocalDateTime endTime = task.getCompletedDate() != null
                ? task.getCompletedDate()
                : LocalDateTime.now();

        // Calculate elapsed time in hours
        long minutes = java.time.Duration.between(startTime, endTime).toMinutes();
        double hours = minutes / 60.0;

        // Sanity checks for unrealistic values
        if (hours < 0.25) {
            // Task completed in < 15 minutes - probably immediate completion
            log.info("Task {} completed very quickly ({} min), setting to 0.5h",
                    task.getId(), minutes);
            return BigDecimal.valueOf(0.5);
        } else if (hours > MAX_TASK_HOURS) {
            // Task took too long (> 200 hours) - probably sat idle
            // Use estimated hours as more realistic value
            log.warn("Task {} took {} hours (> {} max), using estimated hours instead",
                    task.getId(), hours, MAX_TASK_HOURS);
            return task.getEstimatedHours() != null
                    ? task.getEstimatedHours()
                    : BigDecimal.valueOf(8.0);
        }

        // Round to 1 decimal place
        double roundedHours = Math.round(hours * 10.0) / 10.0;
        return BigDecimal.valueOf(roundedHours);
    }

    /**
     * Updates the status of a task, enforces completion permissions, records
     * an audit log entry, calculates actual hours on completion, submits AI
     * feedback,
     * and broadcasts the status change via WebSocket.
     *
     * @param taskId          UUID of the task
     * @param newStatus       the new {@link TaskStatus}
     * @param updatedByUserId UUID of the user making the change
     * @return the updated {@link TaskDTO}
     */
    public TaskDTO updateTaskStatus(UUID taskId, TaskStatus newStatus, UUID updatedByUserId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        User updatedBy = userRepository.findById(updatedByUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (newStatus == TaskStatus.COMPLETED) {
            boolean canComplete = canUserCompleteTask(taskId, updatedByUserId);
            if (!canComplete) {
                throw new IllegalStateException("No permission to complete this task");
            }
        }

        TaskStatus oldStatus = task.getStatus();
        task.setStatus(newStatus);

        // Submit feedback when completed
        if (newStatus == TaskStatus.COMPLETED && task.getCompletedDate() == null) {
            task.setCompletedDate(LocalDateTime.now());

            if (task.getActualHours() == null || task.getActualHours().compareTo(BigDecimal.ZERO) == 0) {
                BigDecimal calculatedHours = calculateActualHours(task);
                task.setActualHours(calculatedHours);

            }

            // Calculate prediction error if we had a prediction
            if (task.getPredictedHours() != null && task.getActualHours() != null) {
                BigDecimal error = task.getActualHours().subtract(task.getPredictedHours());
                task.setPredictionError(error);
            }

            // Submit feedback asynchronously
            submitAIFeedback(task);
        }

        auditLogService.logFieldChange(task, updatedBy, "status",
                oldStatus.name(), newStatus.name());

        Task updated = taskRepository.save(task);
        TaskDTO taskDTO = mapTaskToDTO(updated);
        taskDTO.setRequiredSkillIds(getTaskRequiredSkillIds(updated.getId()));

        // Broadcast update
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        broadcastTaskStatusUpdate(updated);
                    }
                });

        return taskDTO;
    }

    // GET ALL TASKS (filtered by role and visibility)
    /**
     * Returns all tasks visible to the given user based on role.
     * Employees see only their own team tasks, personally assigned tasks,
     * and their own requests. Admins/managers see all company tasks.
     * Required skills are batch-loaded to avoid N+1 queries.
     *
     * @param userId UUID of the requesting user
     * @return list of visible {@link TaskDTO} objects
     */
    @Transactional(readOnly = true)
    public List<TaskDTO> getAllTasks(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<Task> allTasks;

        if (user.getRole() == UserRole.EMPLOYEE) {
            Employee employeeProfile = employeeRepository.findByUserId(userId).orElse(null);
            UUID employeeId = employeeProfile != null ? employeeProfile.getId() : null;
            UUID teamId = user.getTeam() != null ? user.getTeam().getId() : null;

            if (teamId != null) {
                allTasks = taskRepository.findVisibleTasksForEmployee(
                        user.getCompany().getId(), userId, employeeId, teamId);
            } else {
                allTasks = taskRepository.findVisibleTasksForEmployeeNoTeam(
                        user.getCompany().getId(), userId, employeeId);
            }

            // Filter out OTHER users' requests
            // Only show requests that THIS user created
            allTasks = allTasks.stream()
                    .filter(task -> {
                        if (!task.getTitle().startsWith("[REQUEST]")) {
                            return true; // Keep all non-request tasks
                        }
                        // Only keep requests created by THIS user
                        return task.getCreatedBy() != null &&
                                task.getCreatedBy().getId().equals(userId);
                    })
                    .toList();

        } else {
            // Admin/Manager sees all tasks (including all requests)
            allTasks = taskRepository.findByCompanyId(user.getCompany().getId());
        }

        // Batch fetch all required skills in ONE query
        Map<UUID, List<UUID>> taskSkillsMap = new HashMap<>();
        if (!allTasks.isEmpty()) {
            List<UUID> taskIds = allTasks.stream()
                    .map(Task::getId)
                    .toList();

            // Single query for ALL task skills
            List<TaskRequiredSkill> allSkills = taskRequiredSkillRepository.findByTaskIdIn(taskIds);

            // Group by task ID
            allSkills.forEach(trs -> taskSkillsMap.computeIfAbsent(trs.getTask().getId(), k -> new ArrayList<>())
                    .add(trs.getSkill().getId()));
        }

        // Map to DTOs using pre-fetched data
        return allTasks.stream()
                .map(task -> {
                    TaskDTO dto = mapTaskToDTO(task);
                    dto.setRequiredSkillIds(taskSkillsMap.getOrDefault(task.getId(), List.of()));
                    return dto;
                })
                .toList();
    }

    /**
     * Returns a paginated, filterable slice of tasks visible to the given user.
     * Applies the same role-based visibility rules as {@link #getAllTasks(UUID)}
     * and batch-loads skills and assignments for the current page.
     *
     * @param userId   UUID of the requesting user
     * @param pageable pagination and sort parameters
     * @param status   optional status filter
     * @param priority optional priority filter
     * @param search   optional free-text search term
     * @return a {@link Page} of {@link TaskDTO} objects
     */
    @Transactional(readOnly = true)
    public Page<TaskDTO> getTasksPaginated(UUID userId, Pageable pageable,
            TaskStatus status, TaskPriority priority, String search) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Page<Task> taskPage;

        if (user.getRole() == UserRole.EMPLOYEE) {
            Employee employeeProfile = employeeRepository.findByUserId(userId).orElse(null);
            UUID employeeId = employeeProfile != null ? employeeProfile.getId() : null;
            UUID teamId = user.getTeam() != null ? user.getTeam().getId() : null;

            // Convert enums to strings for native query
            String statusStr = status != null ? status.name() : null;
            String priorityStr = priority != null ? priority.name() : null;

            if (teamId != null) {
                taskPage = taskRepository.findVisibleTasksForEmployeePaginatedNative(
                        user.getCompany().getId(),
                        userId,
                        employeeId,
                        teamId,
                        statusStr, // Pass as string
                        priorityStr, // Pass as string
                        search,
                        pageable);
            } else {
                taskPage = taskRepository.findVisibleTasksForEmployeeNoTeamPaginatedNative(
                        user.getCompany().getId(),
                        userId,
                        employeeId,
                        statusStr, // Pass as string
                        priorityStr, // Pass as string
                        search,
                        pageable);
            }

            // Filter out OTHER users' requests
            List<Task> filteredTasks = taskPage.getContent().stream()
                    .filter(task -> {
                        if (!task.getTitle().startsWith("[REQUEST]")) {
                            return true;
                        }
                        return task.getCreatedBy() != null &&
                                task.getCreatedBy().getId().equals(userId);
                    })
                    .toList();

            taskPage = new PageImpl<>(filteredTasks, pageable, taskPage.getTotalElements());

        } else {
            // Admin/Manager sees all tasks with filters
            // Convert enums to strings for native query
            String statusStr = status != null ? status.name() : null;
            String priorityStr = priority != null ? priority.name() : null;

            taskPage = taskRepository.findByCompanyIdWithFiltersNative(
                    user.getCompany().getId(),
                    statusStr,
                    priorityStr,
                    search,
                    pageable);
        }

        if (taskPage.isEmpty()) {
            return Page.empty(pageable);
        }

        // Extract IDs from current page
        List<UUID> taskIds = taskPage.getContent().stream()
                .map(Task::getId)
                .toList();

        // Batch fetch all required skills in ONE query
        Map<UUID, List<UUID>> taskSkillsMap = new HashMap<>();
        List<TaskRequiredSkill> allSkills = taskRequiredSkillRepository.findByTaskIdIn(taskIds);

        allSkills.forEach(trs -> taskSkillsMap.computeIfAbsent(trs.getTask().getId(), k -> new ArrayList<>())
                .add(trs.getSkill().getId()));

        // Batch fetch assignments
        Map<UUID, List<TaskAssignmentDTO>> assignmentsMap = new HashMap<>();
        List<TaskAssignment> allAssignments = taskAssignmentRepository.findByTaskIdIn(taskIds);

        allAssignments.forEach(assignment -> {
            TaskAssignmentDTO dto = modelMapper.map(assignment, TaskAssignmentDTO.class);
            assignmentsMap.computeIfAbsent(assignment.getTask().getId(), k -> new ArrayList<>())
                    .add(dto);
        });

        // Map to DTOs using pre-fetched data
        List<TaskDTO> taskDTOs = taskPage.getContent().stream()
                .map(task -> {
                    TaskDTO dto = mapTaskToDTO(task);
                    dto.setRequiredSkillIds(taskSkillsMap.getOrDefault(task.getId(), List.of()));
                    dto.setAssignments(assignmentsMap.getOrDefault(task.getId(), List.of()));
                    return dto;
                })
                .toList();

        return new PageImpl<>(taskDTOs, pageable, taskPage.getTotalElements());
    }

    // GET TASK REQUESTS (for managers)
    /**
     * Returns all pending task requests that are awaiting manager approval.
     * All managers and admins can see every request regardless of team.
     *
     * @param managerId UUID of the manager/admin making the request
     * @return list of pending-request {@link TaskDTO} objects
     */
    @Transactional(readOnly = true)
    public List<TaskDTO> getTaskRequests(UUID managerId) {
        User manager = userRepository.findByIdWithTeam(managerId)
                .orElseThrow(() -> new ResourceNotFoundException("Manager not found"));

        // Since employee requests have NO team (team = null),
        // all managers and admins can see all requests
        List<Task> allTasks = taskRepository.findByStatus(TaskStatus.PENDING);

        List<Task> requests = allTasks.stream()
                .filter(t -> t.getTitle().startsWith("[REQUEST]"))
                .toList();

        return requests.stream()
                .map(task -> modelMapper.map(task, TaskDTO.class))
                .toList();
    }

    // PERMISSION CHECKS
    /**
     * Checks whether the given user may edit the specified task.
     *
     * @param taskId UUID of the task
     * @param userId UUID of the user
     * @return {@code true} if the user has edit permission
     */
    public boolean canUserEditTask(UUID taskId, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (user.getRole() == UserRole.ADMIN)
            return true;

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        if (task.getCreatedBy() != null && task.getCreatedBy().getId().equals(userId)) {
            return true;
        }

        if (user.getRole() == UserRole.MANAGER && task.getTeam() != null) {
            return user.getTeam() != null && user.getTeam().getId().equals(task.getTeam().getId());
        }

        return taskPermissionRepository.findByTaskIdAndUserId(taskId, userId)
                .map(TaskPermission::getCanEdit)
                .orElse(false);
    }

    /**
     * Checks whether the given user may delete the specified task.
     * Admins must belong to the same company; employees may only delete
     * their own unapproved requests.
     *
     * @param taskId UUID of the task
     * @param userId UUID of the user
     * @return {@code true} if the user has delete permission
     */
    public boolean canUserDeleteTask(UUID taskId, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Fetch task immediately to verify company ownership
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        // SECURITY FIX: Ensure Admin belongs to the same company as the task
        if (user.getRole() == UserRole.ADMIN) {
            return user.getCompany().getId().equals(task.getCompany().getId());
        }

        // Managers can delete tasks in their teams
        if (user.getRole() == UserRole.MANAGER && task.getTeam() != null) {
            return user.getTeam() != null && user.getTeam().getId().equals(task.getTeam().getId());
        }

        // Employees can ONLY delete their own UNAPPROVED requests
        if (user.getRole() == UserRole.EMPLOYEE) {
            boolean isOwnRequest = task.getCreatedBy() != null &&
                    task.getCreatedBy().getId().equals(userId) &&
                    task.getTitle().startsWith("[REQUEST]");
            return isOwnRequest;
        }

        return taskPermissionRepository.findByTaskIdAndUserId(taskId, userId)
                .map(TaskPermission::getCanDelete)
                .orElse(false);
    }

    /**
     * Checks whether the given user may mark the specified task as completed.
     *
     * @param taskId UUID of the task
     * @param userId UUID of the user
     * @return {@code true} if the user has complete permission
     */
    public boolean canUserCompleteTask(UUID taskId, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Admins and Managers can always complete tasks
        if (user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.MANAGER) {
            return true;
        }

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        // Employees can complete tasks if:
        if (user.getRole() == UserRole.EMPLOYEE) {
            // 1. They created it AND it was approved (not a [REQUEST])
            boolean isApprovedCreator = task.getCreatedBy() != null &&
                    task.getCreatedBy().getId().equals(userId) &&
                    !task.getTitle().startsWith("[REQUEST]");

            if (isApprovedCreator) {
                return true;
            }

            // 2. They are in the task's team (if task has a team)
            if (task.getTeam() != null && user.getTeam() != null &&
                    task.getTeam().getId().equals(user.getTeam().getId())) {
                return true;
            }

            // 3. Task has NO team (public task)
            if (task.getTeam() == null && task.getAssignedEmployeeId() == null) {
                return true;
            }

            // 4. They are specifically assigned to this task
            try {
                Employee employee = employeeRepository.findByUserId(userId)
                        .orElse(null);

                if (employee != null) {
                    boolean isAssigned = task.getAssignments().stream()
                            .anyMatch(a -> a.getEmployee().getId().equals(employee.getId()) &&
                                    a.getStatus() == TaskAssignmentStatus.ACCEPTED);

                    if (isAssigned) {
                        return true;
                    }

                    // Check if task is directly assigned to this employee
                    if (task.getAssignedEmployeeId() != null &&
                            task.getAssignedEmployeeId().equals(employee.getId())) {
                        return true;
                    }
                }
            } catch (Exception e) {
                log.error("Error checking employee assignments: {}", e.getMessage());
            }

            return false;
        }

        // Check explicit permissions
        return taskPermissionRepository.findByTaskIdAndUserId(taskId, userId)
                .map(TaskPermission::getCanComplete)
                .orElse(false);
    }

    /**
     * Checks whether the given user may view the specified task.
     *
     * @param taskId UUID of the task
     * @param userId UUID of the user
     * @return {@code true} if the user has view permission
     */
    public boolean canUserViewTask(UUID taskId, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (user.getRole() == UserRole.ADMIN)
            return true;

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        if (task.getCreatedBy() != null && task.getCreatedBy().getId().equals(userId)) {
            return true;
        }

        if (task.getTeam() == null) {
            return true;
        }

        if (user.getRole() == UserRole.MANAGER && user.getTeam() != null) {
            return user.getTeam().getId().equals(task.getTeam().getId());
        }

        if (user.getTeam() != null && user.getTeam().getId().equals(task.getTeam().getId())) {
            return true;
        }

        return taskPermissionRepository.findByTaskIdAndUserId(taskId, userId).isPresent();
    }

    // HELPER METHODS
    /**
     * Upserts a task permission record granting or updating edit/delete/complete
     * flags.
     *
     * @param taskId          UUID of the task
     * @param userId          UUID of the user being granted permissions
     * @param canEdit         whether the user may edit the task
     * @param canDelete       whether the user may delete the task
     * @param canComplete     whether the user may complete the task
     * @param grantedByUserId UUID of the user granting the permission
     */
    private void grantTaskPermissions(UUID taskId, UUID userId, Boolean canEdit,
            Boolean canDelete, Boolean canComplete, UUID grantedByUserId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        User grantedBy = userRepository.findById(grantedByUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Granter not found"));

        TaskPermission permission = taskPermissionRepository.findByTaskIdAndUserId(taskId, userId)
                .orElse(new TaskPermission());

        permission.setTask(task);
        permission.setUser(user);
        permission.setCanEdit(canEdit);
        permission.setCanDelete(canDelete);
        permission.setCanComplete(canComplete);
        permission.setGrantedBy(grantedBy);

        taskPermissionRepository.save(permission);
    }

    /**
     * Retrieves the names of all skills required by a task.
     *
     * @param taskId UUID of the task
     * @return list of skill name strings
     */
    public List<String> getTaskRequiredSkillNames(UUID taskId) {
        return taskRequiredSkillRepository.findByTaskId(taskId)
                .stream()
                .map(trs -> trs.getSkill().getName()) // Get NAME instead of ID
                .toList();
    }

    /**
     * Retrieves the UUIDs of all skills required by a task.
     *
     * @param taskId UUID of the task
     * @return list of skill UUIDs
     */
    public List<UUID> getTaskRequiredSkillIds(UUID taskId) {
        return taskRequiredSkillRepository.findByTaskId(taskId)
                .stream()
                .map(trs -> trs.getSkill().getId())
                .toList();
    }

    /**
     * Sends notifications to the task creator and team members when the task status
     * changes.
     *
     * @param task      the affected task
     * @param oldStatus the previous status
     * @param newStatus the new status
     * @param changedBy UUID of the user who changed the status
     */
    private void notifyStatusChange(Task task, TaskStatus oldStatus, TaskStatus newStatus, UUID changedBy) {
        // Notify creator if someone else changed status
        if (task.getCreatedBy() != null && !task.getCreatedBy().getId().equals(changedBy)) {
            NotificationCreateDTO notification = new NotificationCreateDTO();
            notification.setUserId(task.getCreatedBy().getId());
            notification.setType("TASK_STATUS_CHANGED");

            String icon = getStatusIcon(newStatus);
            notification.setTitle(String.format("%s Task Status Updated", icon));
            notification.setMessage(String.format(
                    "Task '%s' status changed from %s to %s",
                    task.getTitle(),
                    oldStatus,
                    newStatus));
            notification.setSeverity(newStatus == TaskStatus.COMPLETED
                    ? NotificationSeverity.SUCCESS
                    : NotificationSeverity.INFO);
            notification.setRelatedEntityType(EntityType.TASK);
            notification.setRelatedEntityId(task.getId());

            notificationService.createNotification(notification);
        }

        // Notify team members on completion
        if (newStatus == TaskStatus.COMPLETED && task.getTeam() != null) {
            List<User> teamMembers = userRepository.findByTeamId(task.getTeam().getId());

            for (User member : teamMembers) {
                if (member.getId().equals(changedBy))
                    continue;

                NotificationCreateDTO notification = new NotificationCreateDTO();
                notification.setUserId(member.getId());
                notification.setType("TASK_COMPLETED");
                notification.setTitle("✅ Task Completed!");
                notification.setMessage(String.format(
                        "Task '%s' has been marked as completed",
                        task.getTitle()));
                notification.setSeverity(NotificationSeverity.SUCCESS);
                notification.setRelatedEntityType(EntityType.TASK);
                notification.setRelatedEntityId(task.getId());

                notificationService.createNotification(notification);
            }
        }
    }

    // Other methods remain unchanged
    /**
     * Retrieves a single task by its UUID, including required skills and
     * assignments.
     *
     * @param id UUID of the task
     * @return the matching {@link TaskDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    @Transactional(readOnly = true)
    public TaskDTO getTaskById(UUID id) {

        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with ID: " + id));

        // Use mapTaskToDTO instead of modelMapper directly
        TaskDTO dto = mapTaskToDTO(task);

        // Manually set required skill IDs
        dto.setRequiredSkillIds(getTaskRequiredSkillIds(id));

        // Get assignments
        dto.setAssignments(getTaskAssignments(id));

        return dto;
    }

    /**
     * Returns all tasks with the given status across the system.
     *
     * @param status the {@link TaskStatus} to filter by
     * @return list of matching {@link TaskDTO} objects
     */
    @Transactional(readOnly = true)
    public List<TaskDTO> getTasksByStatus(TaskStatus status) {
        return taskRepository.findByStatus(status).stream()
                .map(task -> modelMapper.map(task, TaskDTO.class))
                .toList();
    }

    /**
     * Returns all tasks belonging to a given team.
     *
     * @param teamId UUID of the team
     * @return list of {@link TaskDTO} objects
     */
    @Transactional(readOnly = true)
    public List<TaskDTO> getTasksByTeam(UUID teamId) {
        return taskRepository.findByTeamId(teamId).stream()
                .map(task -> modelMapper.map(task, TaskDTO.class))
                .toList();
    }

    /**
     * Returns all tasks with the given priority across the system.
     *
     * @param priority the {@link TaskPriority} to filter by
     * @return list of matching {@link TaskDTO} objects
     */
    @Transactional(readOnly = true)
    public List<TaskDTO> getTasksByPriority(TaskPriority priority) {
        return taskRepository.findByPriority(priority).stream()
                .map(task -> modelMapper.map(task, TaskDTO.class))
                .toList();
    }

    /**
     * Returns all overdue tasks (non-completed, past their due date).
     *
     * @return list of overdue {@link TaskDTO} objects
     */
    @Transactional(readOnly = true)
    public List<TaskDTO> getOverdueTasks() {
        return taskRepository.findOverdueTasks(TaskStatus.PENDING, LocalDateTime.now()).stream()
                .map(task -> modelMapper.map(task, TaskDTO.class))
                .toList();
    }

    /**
     * Partially updates a task's fields, recording individual audit log entries
     * for each changed field.
     *
     * @param id              UUID of the task to update
     * @param updateDTO       DTO containing the fields to change (null = keep
     *                        existing)
     * @param updatedByUserId UUID of the user performing the update
     * @return the updated {@link TaskDTO}
     */
    public TaskDTO updateTask(UUID id, TaskUpdateDTO updateDTO, UUID updatedByUserId) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        User updatedBy = userRepository.findById(updatedByUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (updateDTO.getTitle() != null && !updateDTO.getTitle().equals(task.getTitle())) {
            auditLogService.logFieldChange(task, updatedBy, "title", task.getTitle(), updateDTO.getTitle());
            task.setTitle(updateDTO.getTitle());
        }
        if (updateDTO.getDescription() != null && !updateDTO.getDescription().equals(task.getDescription())) {
            auditLogService.logFieldChange(task, updatedBy, "description", task.getDescription(),
                    updateDTO.getDescription());
            task.setDescription(updateDTO.getDescription());
        }
        if (updateDTO.getStatus() != null && updateDTO.getStatus() != task.getStatus()) {
            auditLogService.logFieldChange(task, updatedBy, "status", task.getStatus().name(),
                    updateDTO.getStatus().name());
            task.setStatus(updateDTO.getStatus());
            if (updateDTO.getStatus() == TaskStatus.COMPLETED && task.getCompletedDate() == null) {
                task.setCompletedDate(LocalDateTime.now());
            }
        }
        if (updateDTO.getPriority() != null && updateDTO.getPriority() != task.getPriority()) {
            auditLogService.logFieldChange(task, updatedBy, "priority", task.getPriority().name(),
                    updateDTO.getPriority().name());
            task.setPriority(updateDTO.getPriority());
        }
        if (updateDTO.getEstimatedHours() != null && !updateDTO.getEstimatedHours().equals(task.getEstimatedHours())) {
            auditLogService.logFieldChange(task, updatedBy, "estimatedHours", task.getEstimatedHours().toString(),
                    updateDTO.getEstimatedHours().toString());
            task.setEstimatedHours(updateDTO.getEstimatedHours());
        }
        if (updateDTO.getActualHours() != null && !updateDTO.getActualHours().equals(task.getActualHours())) {
            auditLogService.logFieldChange(task, updatedBy, "actualHours",
                    task.getActualHours() != null ? task.getActualHours().toString() : "null",
                    updateDTO.getActualHours().toString());
            task.setActualHours(updateDTO.getActualHours());
        }
        if (updateDTO.getStartDate() != null && !updateDTO.getStartDate().equals(task.getStartDate())) {
            auditLogService.logFieldChange(task, updatedBy, "startDate",
                    task.getStartDate() != null ? task.getStartDate().toString() : "null",
                    updateDTO.getStartDate().toString());
            task.setStartDate(updateDTO.getStartDate());
        }
        if (updateDTO.getDueDate() != null && !updateDTO.getDueDate().equals(task.getDueDate())) {
            auditLogService.logFieldChange(task, updatedBy, "dueDate",
                    task.getDueDate() != null ? task.getDueDate().toString() : "null",
                    updateDTO.getDueDate().toString());
            task.setDueDate(updateDTO.getDueDate());
        }
        if (updateDTO.getComplexityScore() != null
                && !updateDTO.getComplexityScore().equals(task.getComplexityScore())) {
            auditLogService.logFieldChange(task, updatedBy, "complexityScore",
                    task.getComplexityScore() != null ? task.getComplexityScore().toString() : "null",
                    updateDTO.getComplexityScore().toString());
            task.setComplexityScore(updateDTO.getComplexityScore());
        }

        Task updated = taskRepository.save(task);
        return modelMapper.map(updated, TaskDTO.class);
    }

    /**
     * Permanently deletes a task by its ID.
     *
     * @param id UUID of the task to delete
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    public void deleteTask(UUID id) {
        if (!taskRepository.existsById(id)) {
            throw new ResourceNotFoundException("Task not found");
        }

        taskRepository.deleteById(id);
    }

    /** Broadcasts a task-created event to appropriate users via WebSocket. */
    private void broadcastTaskCreated(Task task) {
        try {
            TaskDTO taskDTO = modelMapper.map(task, TaskDTO.class);

            // If task is assigned to specific employee, notify only them
            if (task.getAssignments() != null && !task.getAssignments().isEmpty()) {
                task.getAssignments().forEach(assignment -> {
                    UUID userId = assignment.getEmployee().getUser().getId();
                    messagingTemplate.convertAndSendToUser(
                            userId.toString(),
                            "/queue/task-updates",
                            Map.of(
                                    "action", "task_created",
                                    "task", taskDTO));
                });
            }
            // If task has team but no specific assignment, notify all team members
            else if (task.getTeam() != null) {
                List<User> teamMembers = userRepository.findByTeamId(task.getTeam().getId());
                teamMembers.forEach(member -> {
                    messagingTemplate.convertAndSendToUser(
                            member.getId().toString(),
                            "/queue/task-updates",
                            Map.of(
                                    "action", "task_created",
                                    "task", taskDTO));
                });
            }
            // If no team and no assignment, broadcast to all admins/managers
            else {
                List<User> adminsAndManagers = userRepository.findByRole(UserRole.ADMIN);
                adminsAndManagers.addAll(userRepository.findByRole(UserRole.MANAGER));

                adminsAndManagers.forEach(user -> {
                    messagingTemplate.convertAndSendToUser(
                            user.getId().toString(),
                            "/queue/task-updates",
                            Map.of(
                                    "action", "task_created",
                                    "task", taskDTO));
                });
            }
        } catch (Exception e) {
            log.error("Failed to broadcast task creation: {}", e.getMessage());
        }
    }

    /**
     * Broadcasts a task status-update event to the task's creator, assignees, and
     * team members.
     */
    private void broadcastTaskStatusUpdate(Task task) {
        try {
            TaskDTO taskDTO = modelMapper.map(task, TaskDTO.class);

            // Notify all users who can see this task
            List<UUID> notifyUsers = new ArrayList<>();

            // Add creator
            if (task.getCreatedBy() != null) {
                notifyUsers.add(task.getCreatedBy().getId());
            }

            // Add assigned employees
            if (task.getAssignments() != null) {
                task.getAssignments().forEach(assignment -> {
                    notifyUsers.add(assignment.getEmployee().getUser().getId());
                });
            }

            // Add team members if team task
            if (task.getTeam() != null) {
                List<User> teamMembers = userRepository.findByTeamId(task.getTeam().getId());
                teamMembers.forEach(member -> notifyUsers.add(member.getId()));
            }

            // If task is COMPLETED, broadcast to ALL managers/admins
            // This triggers AI Insights refresh for everyone
            if (task.getStatus() == TaskStatus.COMPLETED) {
                List<User> managers = userRepository.findByRoleAndCompanyId(
                        UserRole.MANAGER,
                        task.getCompany().getId());
                List<User> admins = userRepository.findByRoleAndCompanyId(
                        UserRole.ADMIN,
                        task.getCompany().getId());

                managers.forEach(m -> notifyUsers.add(m.getId()));
                admins.forEach(a -> notifyUsers.add(a.getId()));

            }

            // Remove duplicates and broadcast
            notifyUsers.stream().distinct().forEach(userId -> {
                messagingTemplate.convertAndSendToUser(
                        userId.toString(),
                        "/queue/task-updates",
                        Map.of(
                                "action", "task_status_updated",
                                "task", taskDTO));
            });

        } catch (Exception e) {
            log.error("Failed to broadcast task status update: {}", e.getMessage());
        }
    }

    /**
     * Notifies all relevant managers and admins when an employee submits a task
     * request.
     */
    private void broadcastTaskRequest(Task task) {
        try {
            TaskDTO taskDTO = modelMapper.map(task, TaskDTO.class);

            List<User> managers;
            if (task.getTeam() != null) {
                // Notify only managers of the specific team
                managers = userRepository.findByRole(UserRole.MANAGER).stream()
                        .filter(m -> m.getTeam() != null && m.getTeam().getId().equals(task.getTeam().getId()))
                        .toList();

                if (managers.isEmpty()) {
                    managers = userRepository.findByRole(UserRole.MANAGER);
                }
            } else {
                managers = userRepository.findByRole(UserRole.MANAGER);
            }

            // Also notify all admins
            List<User> admins = userRepository.findByRole(UserRole.ADMIN);

            Stream.concat(managers.stream(), admins.stream()).forEach(user -> {
                messagingTemplate.convertAndSendToUser(
                        user.getId().toString(),
                        "/queue/task-updates",
                        Map.of(
                                "action", "task_request",
                                "task", taskDTO));
            });
        } catch (Exception e) {
            log.error("Failed to broadcast task request: {}", e.getMessage());
        }
    }

    /**
     * Sends a deadline-reminder notification to a user for the given task.
     *
     * @param task the task approaching its deadline
     * @param user the user to notify
     */
    private void sendDeadlineNotification(Task task, User user) {
        NotificationCreateDTO notification = new NotificationCreateDTO();
        notification.setUserId(user.getId());
        notification.setType("DEADLINE_REMINDER");
        notification.setTitle("⏰ Task Deadline Approaching");
        notification.setMessage(String.format(
                "Task '%s' is due in 24 hours (%s)",
                task.getTitle(),
                task.getDueDate().format(DateTimeFormatter.ofPattern("MMM dd, HH:mm"))));
        notification.setSeverity(NotificationSeverity.WARNING);
        notification.setRelatedEntityType(EntityType.TASK);
        notification.setRelatedEntityId(task.getId());

        notificationService.createNotification(notification);
    }

    /**
     * Scheduled job that runs daily at 09:00 and sends deadline-reminder
     * notifications for all tasks due within the next 24 hours.
     */
    @Scheduled(cron = "0 0 9 * * *") // Run daily at 9 AM
    public void sendDeadlineReminders() {
        LocalDateTime tomorrow = LocalDateTime.now().plusDays(1);
        LocalDateTime dayAfterTomorrow = LocalDateTime.now().plusDays(2);

        List<Task> upcomingTasks = taskRepository.findByDueDateBetween(tomorrow, dayAfterTomorrow);

        for (Task task : upcomingTasks) {
            if (task.getStatus() != TaskStatus.COMPLETED && task.getStatus() != TaskStatus.CANCELLED) {
                // Notify task creator
                if (task.getCreatedBy() != null) {
                    sendDeadlineNotification(task, task.getCreatedBy());
                }

                // Notify assigned employees
                List<TaskAssignment> assignments = taskAssignmentRepository.findByTaskId(task.getId());
                for (TaskAssignment assignment : assignments) {
                    if (assignment.getEmployee() != null && assignment.getEmployee().getUser() != null) {
                        sendDeadlineNotification(task, assignment.getEmployee().getUser());
                    }
                }
            }
        }
    }

    /**
     * Returns the assignments for a given task.
     *
     * @param taskId UUID of the task
     * @return list of {@link TaskAssignmentDTO} objects
     */
    private List<TaskAssignmentDTO> getTaskAssignments(UUID taskId) {
        return taskAssignmentRepository.findByTaskId(taskId).stream()
                .map(assignment -> modelMapper.map(assignment, TaskAssignmentDTO.class))
                .toList();
    }

    /**
     * Maps a {@link Task} entity to a {@link TaskDTO} without loading
     * skills or assignments (callers add those separately for efficiency).
     *
     * @param task the task entity
     * @return partially populated {@link TaskDTO}
     */
    private TaskDTO mapTaskToDTO(Task task) {
        TaskDTO dto = new TaskDTO();
        dto.setId(task.getId());
        dto.setTitle(task.getTitle());
        dto.setDescription(task.getDescription());
        dto.setStatus(task.getStatus());
        dto.setPriority(task.getPriority());
        dto.setEstimatedHours(task.getEstimatedHours());
        dto.setActualHours(task.getActualHours());
        dto.setStartDate(task.getStartDate());
        dto.setDueDate(task.getDueDate());
        dto.setCompletedDate(task.getCompletedDate());
        dto.setAssignedEmployeeId(task.getAssignedEmployeeId());
        dto.setComplexityScore(task.getComplexityScore());
        dto.setCreatedAt(task.getCreatedAt());
        dto.setIsEmployeeRequest(task.getIsEmployeeRequest());
        dto.setIsArchived(task.getIsArchived());
        dto.setRequiresApproval(task.getRequiresApproval());

        if (task.getTeam() != null) {
            dto.setTeamId(task.getTeam().getId());
            dto.setTeamName(task.getTeam().getName());
        }

        if (task.getCreatedBy() != null) {
            dto.setCreatedBy(task.getCreatedBy().getId());
            dto.setCreatedByName(task.getCreatedBy().getUsername());
        }

        return dto;
    }

    @Value("${ai.service.url}")
    private String aiServiceUrl;

    /**
     * Submit feedback to AI service when task is completed
     * This helps the model learn from actual outcomes
     */
    private void submitAIFeedback(Task task) {
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
            Map feedback = new HashMap<>();
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
            List skillIds = taskRequiredSkillRepository.findByTaskId(task.getId())
                    .stream()
                    .map(trs -> trs.getSkill().getId())
                    .toList();
            feedback.put("required_skill_ids", skillIds);

            // Include validation metadata
            feedback.put("validation_category", validation.category);
            feedback.put("quality_score", validation.qualityScore);

            // Submit asynchronously
            submitFeedbackAsync(feedback, task.getCompany().getId(), task.getId());

        } catch (Exception e) {
            log.error("Error preparing feedback for task {}: {}",
                    task.getId(), e.getMessage());
        }
    }

    /**
     * Validate feedback data quality
     */
    /**
     * Validates the quality of AI feedback data derived from a completed task.
     * Rejects extreme outliers, tasks with many scope changes, and frequently
     * reassigned tasks; returns a quality score and category for valid feedback.
     *
     * @param task the completed task
     * @return a {@link FeedbackValidation} result object
     */
    private FeedbackValidation validateTaskFeedback(Task task) {
        FeedbackValidation validation = new FeedbackValidation();
        double actualHours = task.getActualHours().doubleValue();

        // Check 1: Extreme outliers
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

        // Check 2: Multiple scope changes
        if (task.getScopeChangeCount() != null && task.getScopeChangeCount() > MAX_SCOPE_CHANGES) {
            validation.reason = "Scope changed >" + MAX_SCOPE_CHANGES + " times";
            validation.category = "scope_changed";
            validation.qualityScore = 0.3;
            return validation;
        }

        // Check 3: Multiple reassignments
        if (task.getReassignmentCount() != null && task.getReassignmentCount() > MAX_REASSIGNMENTS) {
            validation.reason = "Task reassigned >" + MAX_REASSIGNMENTS + " times";
            validation.category = "reassigned";
            validation.qualityScore = 0.4;
            return validation;
        }

        // Check 4: Calculate overall quality
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

    /**
     * Calculate feedback quality score
     */
    /**
     * Computes a 0–1 quality score based on completeness and reliability signals
     * such as presence of a description, number of reassignments, lateness, and
     * scope changes.
     *
     * @param task the completed task
     * @return quality score between 0.0 and 1.0
     */
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
            long daysLate = java.time.temporal.ChronoUnit.DAYS.between(
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

    /**
     * Submit feedback asynchronously
     */
    /**
     * Submits task completion feedback to the AI service asynchronously
     * and marks the task as having had feedback submitted upon success.
     *
     * @param feedback  the payload map to send to the AI service
     * @param companyId UUID of the company scope
     * @param taskId    UUID of the completed task
     */
    private void submitFeedbackAsync(Map<String, Object> feedback,
            UUID companyId,
            UUID taskId) {
        CompletableFuture.runAsync(() -> {
            try {
                String url = aiServiceUrl + "/api/ai/feedback/submit";

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("X-Company-Id", companyId.toString());

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

                    // Proper generic type
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

    /**
     * Tracks a prediction made by the AI service (when a task is first saved with a
     * predicted-hours value) by asynchronously notifying the AI service endpoint.
     *
     * @param task the task that has a predicted-hours value set
     */
    private void trackPrediction(Task task) {
        if (task.getPredictedHours() == null) {
            return;
        }

        CompletableFuture.runAsync(() -> {
            try {
                String url = aiServiceUrl + "/api/ai/feedback/track-prediction";

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("X-Company-Id", task.getCompany().getId().toString());

                Map<String, Object> data = new HashMap<>();
                data.put("task_id", task.getId().toString());
                data.put("predicted_hours", task.getPredictedHours().doubleValue());
                data.put("title", task.getTitle());
                data.put("priority", task.getPriority().name());

                HttpEntity<Map<String, Object>> request = new HttpEntity<>(data, headers);

                ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
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

    /**
     * Inner class for feedback validation
     */
    @lombok.Data
    private static class FeedbackValidation {
        boolean isValid = false;
        String reason = "";
        String category = "";
        double qualityScore = 0.0;
    }
}