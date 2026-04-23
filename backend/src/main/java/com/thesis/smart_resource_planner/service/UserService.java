package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Service layer for user management operations.
 *
 * <p>
 * Provides CRUD operations for
 * {@link com.thesis.smart_resource_planner.model.entity.User}
 * entities, allowing retrieval by ID, username, email, team, and role.
 * Also supports cascading user deletion that cleans up all dependent data
 * (employee profile, skills, availability, assignments, chat messages,
 * notifications, and task references) in the correct order to avoid
 * referential-integrity violations.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final EmployeeRepository employeeRepository;
    private final EmployeeSkillRepository employeeSkillRepository;
    private final EmployeeAvailabilityRepository availabilityRepository;
    private final NotificationRepository notificationRepository;
    private final TaskAssignmentRepository taskAssignmentRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final TaskRepository taskRepository;
    private final TaskPermissionRepository taskPermissionRepository;
    private final ModelMapper modelMapper;

    /**
     * Retrieves a user by their unique identifier.
     *
     * @param id the UUID of the user
     * @return the matching {@link UserDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException
     *                                                                               if
     *                                                                               no
     *                                                                               user
     *                                                                               with
     *                                                                               the
     *                                                                               givenID
     *                                                                               exists
     */
    @Transactional(readOnly = true)
    public UserDTO getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));
        return modelMapper.map(user, UserDTO.class);
    }

    /**
     * Retrieves a user by their username.
     *
     * @param username the unique username to look up
     * @return the matching {@link UserDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException
     *                                                                               if
     *                                                                               no
     *                                                                               user
     *                                                                               with
     *                                                                               the
     *                                                                               given
     *                                                                               username
     *                                                                               exists
     */
    @Transactional(readOnly = true)
    public UserDTO getUserByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with username: " + username));
        return modelMapper.map(user, UserDTO.class);
    }

    /**
     * Retrieves a user by their email address.
     *
     * @param email the email address to look up
     * @return the matching {@link UserDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException
     *                                                                               if
     *                                                                               no
     *                                                                               user
     *                                                                               with
     *                                                                               the
     *                                                                               given
     *                                                                               email
     *                                                                               exists
     */
    @Transactional(readOnly = true)
    public UserDTO getUserByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));
        return modelMapper.map(user, UserDTO.class);
    }

    /**
     * Returns all users who belong to the same company as the requesting user.
     *
     * @param userId the UUID of the requesting user (determines company scope)
     * @return list of {@link UserDTO} objects for all company members
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException
     *                                                                               if
     *                                                                               the
     *                                                                               requesting
     *                                                                               user
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<UserDTO> getAllUsers(UUID userId) {
        User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return userRepository.findByCompanyId(currentUser.getCompany().getId()).stream()
                .map(user -> modelMapper.map(user, UserDTO.class))
                .toList();
    }

    /**
     * Returns all users currently assigned to a specific team.
     *
     * @param teamId the UUID of the team
     * @return list of {@link UserDTO} objects for all team members
     */
    @Transactional(readOnly = true)
    public List<UserDTO> getUsersByTeam(UUID teamId) {
        return userRepository.findByTeamId(teamId).stream()
                .map(user -> modelMapper.map(user, UserDTO.class))
                .toList();
    }

    /**
     * Returns all users that have been assigned a specific role.
     *
     * @param role the {@link com.thesis.smart_resource_planner.enums.UserRole} to
     *             filter by
     * @return list of {@link UserDTO} objects matching the role
     */
    @Transactional(readOnly = true)
    public List<UserDTO> getUsersByRole(UserRole role) {
        return userRepository.findByRole(role).stream()
                .map(user -> modelMapper.map(user, UserDTO.class))
                .toList();
    }

    /**
     * Partially updates a user's profile (email, role, active status, and team).
     * Promotes or demotes team membership automatically when the role changes.
     *
     * @param id        the UUID of the user to update
     * @param updateDTO DTO containing the fields to change (null fields are
     *                  ignored)
     * @return the updated {@link UserDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException
     *                                                                                if
     *                                                                                the
     *                                                                                user
     *                                                                                or
     *                                                                                target
     *                                                                                team
     *                                                                                does
     *                                                                                not
     *                                                                                exist
     * @throws com.thesis.smart_resource_planner.exception.DuplicateResourceException
     *                                                                                if
     *                                                                                the
     *                                                                                new
     *                                                                                email
     *                                                                                is
     *                                                                                already
     *                                                                                taken
     */
    public UserDTO updateUser(UUID id, UserUpdateDTO updateDTO) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));

        if (updateDTO.getEmail() != null && !updateDTO.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(updateDTO.getEmail())) {
                throw new DuplicateResourceException("Email already exists");
            }
            user.setEmail(updateDTO.getEmail());
        }

        if (updateDTO.getRole() != null) {
            // Check if role is changing
            if (user.getRole() != updateDTO.getRole()) {
                // If promoting to ADMIN or MANAGER, remove from current team
                if (updateDTO.getRole() == UserRole.ADMIN || updateDTO.getRole() == UserRole.MANAGER) {
                    if (user.getTeam() != null) {
                        user.setTeam(null);
                    }
                }
            }
            user.setRole(updateDTO.getRole());
        }

        if (updateDTO.getIsActive() != null) {
            user.setIsActive(updateDTO.getIsActive());
        }

        if (updateDTO.getTeamId() != null) {
            Team team = teamRepository.findById(updateDTO.getTeamId())
                    .orElseThrow(() -> new ResourceNotFoundException("Team not found"));
            user.setTeam(team);
        }

        User updatedUser = userRepository.save(user);

        return modelMapper.map(updatedUser, UserDTO.class);
    }

    /**
     * Permanently deletes a user and all associated data in the correct dependency
     * order:
     * <ol>
     * <li>Task permissions</li>
     * <li>Employee skills, availability, and assignments</li>
     * <li>The employee profile itself</li>
     * <li>Notifications</li>
     * <li>Chat messages</li>
     * <li>Tasks created by this user (creator reference is nulled)</li>
     * <li>Team association</li>
     * <li>The user record</li>
     * </ol>
     * Deletion of the last ADMIN or MANAGER is prevented.
     *
     * @param id the UUID of the user to delete
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               no
     *                                                                               user
     *                                                                               with
     *                                                                               the
     *                                                                               given
     *                                                                               ID
     *                                                                               exists
     * @throws IllegalStateException                                                 if
     *                                                                               deleting
     *                                                                               the
     *                                                                               user
     *                                                                               would
     *                                                                               remove
     *                                                                               the
     *                                                                               last
     *                                                                               admin
     *                                                                               or
     *                                                                               manager
     */
    @Transactional
    public void deleteUser(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));

        // Prevent deletion of last admin/manager
        if (user.getRole() == UserRole.ADMIN) {
            long adminCount = userRepository.countByRole(UserRole.ADMIN);
            if (adminCount <= 1) {
                throw new IllegalStateException(
                        "Cannot delete the last administrator. Promote another user to ADMIN first.");
            }
        }

        if (user.getRole() == UserRole.MANAGER) {
            long managerCount = userRepository.countByRole(UserRole.MANAGER);
            if (managerCount <= 1) {
                throw new IllegalStateException(
                        "Cannot delete the last manager. Promote another user to MANAGER first.");
            }
        }

        // Delete in correct order

        try {
            // 1. Delete task permissions first
            List<TaskPermission> permissions = taskPermissionRepository.findByUserId(id);
            if (!permissions.isEmpty()) {
                taskPermissionRepository.deleteAll(permissions);
                taskPermissionRepository.flush(); // Force deletion
            }

            // 2. Delete employee-related data (if exists)
            Optional<Employee> employeeOpt = employeeRepository.findByUserId(id);
            if (employeeOpt.isPresent()) {
                Employee employee = employeeOpt.get();
                UUID employeeId = employee.getId();

                // Delete employee skills FIRST (most nested)
                List<EmployeeSkill> skills = employeeSkillRepository.findByEmployeeId(employeeId);
                if (!skills.isEmpty()) {
                    employeeSkillRepository.deleteAll(skills);
                    employeeSkillRepository.flush();
                }

                // Delete availability records
                List<EmployeeAvailability> availabilities = availabilityRepository.findByEmployeeId(employeeId);
                if (!availabilities.isEmpty()) {
                    availabilityRepository.deleteAll(availabilities);
                    availabilityRepository.flush();
                }

                // Delete task assignments
                List<TaskAssignment> assignments = taskAssignmentRepository.findByEmployeeId(employeeId);
                if (!assignments.isEmpty()) {
                    taskAssignmentRepository.deleteAll(assignments);
                    taskAssignmentRepository.flush();
                }

                // Unassign tasks from this employee
                List<Task> assignedTasks = taskRepository.findByAssignedEmployeeId(employeeId);
                if (!assignedTasks.isEmpty()) {
                    assignedTasks.forEach(task -> task.setAssignedEmployeeId(null));
                    taskRepository.saveAll(assignedTasks);
                    taskRepository.flush();
                }

                // NOW delete employee profile (after all children are gone)
                employeeRepository.delete(employee);
                employeeRepository.flush();
            }

            // 3. Delete notifications
            List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(id);
            if (!notifications.isEmpty()) {
                notificationRepository.deleteAll(notifications);
                notificationRepository.flush();
            }

            // 4. Delete chat messages
            List<ChatMessage> chatMessages = chatMessageRepository.findAllUserMessages(id);
            if (!chatMessages.isEmpty()) {
                chatMessageRepository.deleteAll(chatMessages);
                chatMessageRepository.flush();
            }

            // 5. Reassign or handle tasks created by this user
            List<Task> userTasks = taskRepository.findByCreatedById(id);
            if (!userTasks.isEmpty()) {
                userTasks.forEach(task -> task.setCreatedBy(null));
                taskRepository.saveAll(userTasks);
                taskRepository.flush();
            }

            // 6. Remove team association
            if (user.getTeam() != null) {
                user.setTeam(null);
                userRepository.save(user);
                userRepository.flush();
            }

            // 7. Finally delete the user
            userRepository.deleteById(id);
            userRepository.flush(); // Final flush

        } catch (Exception e) {
            throw new RuntimeException("Failed to delete user: " + e.getMessage(), e);
        }
    }

    /**
     * Persists the user's notification preference settings as a JSON string.
     *
     * @param userId          the UUID of the user
     * @param preferencesJson a JSON-encoded string of notification preference flags
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException
     *                                                                               if
     *                                                                               the
     *                                                                               user
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    public void updatePreferences(UUID userId, String preferencesJson) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setNotificationPreferences(preferencesJson);
        userRepository.save(user);
    }
}