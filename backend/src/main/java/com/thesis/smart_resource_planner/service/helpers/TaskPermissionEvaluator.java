package com.thesis.smart_resource_planner.service.helpers;

import com.thesis.smart_resource_planner.enums.TaskAssignmentStatus;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.UUID;

@RequiredArgsConstructor
@Slf4j
public class TaskPermissionEvaluator {

    private final UserRepository userRepository;
    private final TaskRepository taskRepository;
    private final TaskPermissionRepository taskPermissionRepository;
    private final EmployeeRepository employeeRepository;
    private final TeamRepository teamRepository;

    public static final String REQUEST_PREFIX = "[REQUEST] ";

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

    public boolean canUserDeleteTask(UUID taskId, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        if (user.getRole() == UserRole.ADMIN) {
            return user.getCompany().getId().equals(task.getCompany().getId());
        }

        if (user.getRole() == UserRole.MANAGER && task.getTeam() != null) {
            return user.getTeam() != null && user.getTeam().getId().equals(task.getTeam().getId());
        }

        if (user.getRole() == UserRole.EMPLOYEE) {
            boolean isOwnRequest = task.getCreatedBy() != null &&
                    task.getCreatedBy().getId().equals(userId) &&
                    task.getTitle().startsWith(REQUEST_PREFIX);
            return isOwnRequest;
        }

        return taskPermissionRepository.findByTaskIdAndUserId(taskId, userId)
                .map(TaskPermission::getCanDelete)
                .orElse(false);
    }

    public boolean canUserCompleteTask(UUID taskId, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.MANAGER) {
            return true;
        }

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        if (user.getRole() == UserRole.EMPLOYEE) {
            boolean isApprovedCreator = task.getCreatedBy() != null &&
                    task.getCreatedBy().getId().equals(userId) &&
                    !task.getTitle().startsWith(REQUEST_PREFIX);

            if (isApprovedCreator) {
                return true;
            }

            if (task.getTeam() != null && user.getTeam() != null &&
                    task.getTeam().getId().equals(user.getTeam().getId())) {
                return true;
            }

            if (task.getTeam() == null && task.getAssignedEmployeeId() == null) {
                return true;
            }

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

        return taskPermissionRepository.findByTaskIdAndUserId(taskId, userId)
                .map(TaskPermission::getCanComplete)
                .orElse(false);
    }

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

    public void grantTaskPermissions(UUID taskId, UUID userId, Boolean canEdit,
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
}
