package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.CompanyDTO;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.apache.commons.lang3.RandomStringUtils;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for company lifecycle management.
 *
 * <p>
 * Handles company creation (with default departments and teams),
 * join-code generation and regeneration, company lookups, and cascading
 * deletion of all entities belonging to a company in the correct
 * dependency order.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final TeamRepository teamRepository;
    private final ModelMapper modelMapper;
    private final EmployeeRepository employeeRepository;
    private final EmployeeSkillRepository employeeSkillRepository;
    private final EmployeeAvailabilityRepository availabilityRepository;
    private final NotificationRepository notificationRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final TaskPermissionRepository taskPermissionRepository;
    private final TaskRepository taskRepository;
    private final TaskRequiredSkillRepository taskRequiredSkillRepository;
    private final TaskCommentRepository taskCommentRepository;
    private final TaskAuditLogRepository taskAuditLogRepository;
    private final TaskTimeEntryRepository taskTimeEntryRepository;
    private final TaskAssignmentRepository taskAssignmentRepository;

    /**
     * Creates a new company with a unique join code and seeds it with default
     * departments and teams.
     *
     * @param name the desired company name
     * @return the persisted {@link Company} entity
     * @throws com.thesis.smart_resource_planner.exception.DuplicateResourceException if
     *                                                                                a
     *                                                                                company
     *                                                                                with
     *                                                                                the
     *                                                                                same
     *                                                                                name
     *                                                                                already
     *                                                                                exists
     */
    public Company createCompany(String name) {
        if (companyRepository.existsByName(name)) {
            throw new DuplicateResourceException("Company with this name already exists");
        }

        String joinCode = generateUniqueJoinCode();

        Company company = Company.builder()
                .name(name)
                .joinCode(joinCode)
                .subscriptionTier("BASIC")
                .isActive(true)
                .build();

        Company saved = companyRepository.save(company);

        createDefaultDepartments(saved);
        createDefaultTeams(saved);

        return saved;
    }

    /** Seeds a newly created company with a standard set of departments. */
    private void createDefaultDepartments(Company company) {
        List<Department> departments = List.of(
                Department.builder()
                        .name("Engineering")
                        .description("Software development and technical teams")
                        .company(company)
                        .build(),
                Department.builder()
                        .name("Marketing")
                        .description("Marketing and brand management")
                        .company(company)
                        .build(),
                Department.builder()
                        .name("Sales")
                        .description("Sales and business development")
                        .company(company)
                        .build(),
                Department.builder()
                        .name("Human Resources")
                        .description("HR and people operations")
                        .company(company)
                        .build(),
                Department.builder()
                        .name("Finance")
                        .description("Accounting and financial planning")
                        .company(company)
                        .build());

        departmentRepository.saveAll(departments);
    }

    /** Seeds a newly created company with a standard set of teams. */
    private void createDefaultTeams(Company company) {
        List<Team> teams = List.of(
                Team.builder()
                        .name("Development Team")
                        .description("Main development team for AI projects")
                        .company(company)
                        .build(),
                Team.builder()
                        .name("Marketing Team")
                        .description("Marketing and communications team")
                        .company(company)
                        .build());

        teamRepository.saveAll(teams);
    }

    /**
     * Looks up a company by its join code.
     *
     * @param joinCode the alphanumeric join code
     * @return the matching {@link Company}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               no
     *                                                                               company
     *                                                                               matches
     */
    public Company findByJoinCode(String joinCode) {
        return companyRepository.findByJoinCode(joinCode)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid company code"));
    }

    /**
     * Returns the well-known default company used for users who register without a
     * join code.
     *
     * @return the default {@link Company} entity
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               default
     *                                                                               company
     *                                                                               has
     *                                                                               not
     *                                                                               been
     *                                                                               seeded
     */
    public Company getDefaultCompany() {
        UUID defaultCompanyId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        return companyRepository.findById(defaultCompanyId)
                .orElseThrow(() -> new ResourceNotFoundException("Default company not found"));
    }

    /**
     * Resolves the company of the given user and returns its details.
     *
     * @param userId UUID of the user whose company should be fetched
     * @return {@link CompanyDTO} with employee, department, and team counts
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               user
     *                                                                               or
     *                                                                               company
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public CompanyDTO getCompanyById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Company company = user.getCompany();
        if (company == null)
            throw new ResourceNotFoundException("Company not found");

        CompanyDTO dto = modelMapper.map(company, CompanyDTO.class);
        dto.setEmployeeCount((int) userRepository.countByCompanyId(userId));
        dto.setDepartmentCount(departmentRepository.findByCompanyId(userId).size());
        dto.setTeamCount(teamRepository.findByCompanyId(userId).size());

        return dto;
    }

    /**
     * Returns a list of all companies in the system with aggregated statistics.
     *
     * @return list of {@link CompanyDTO} objects
     */
    @Transactional(readOnly = true)
    public List<CompanyDTO> getAllCompanies() {
        return companyRepository.findAll().stream()
                .map(company -> {
                    CompanyDTO dto = modelMapper.map(company, CompanyDTO.class);
                    dto.setEmployeeCount((int) userRepository.countByCompanyId(company.getId()));
                    dto.setDepartmentCount(departmentRepository.findByCompanyId(company.getId()).size());
                    dto.setTeamCount(teamRepository.findByCompanyId(company.getId()).size());
                    return dto;
                })
                .toList();
    }

    /**
     * Generates and persists a new unique join code for the given company,
     * invalidating any previously shared code.
     *
     * @param companyId UUID of the company
     * @return the newly generated join code
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               company
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    public String regenerateJoinCode(UUID companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));

        String newJoinCode = generateUniqueJoinCode();
        company.setJoinCode(newJoinCode);
        companyRepository.save(company);

        return newJoinCode;
    }

    /**
     * Permanently deletes a company and all of its associated data in dependency
     * order:
     * employee skills, availability, assignments, employees, notifications, chat
     * messages,
     * task permissions, task sub-entities, tasks, teams, departments, users, and
     * finally the company.
     *
     * @param companyId UUID of the company to delete
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               company
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     * @throws RuntimeException                                                      if
     *                                                                               the
     *                                                                               cascading
     *                                                                               deletion
     *                                                                               fails
     *                                                                               at
     *                                                                               any
     *                                                                               phase
     */
    @Transactional
    public void deleteCompany(UUID companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));

        try {
            // PHASE 1: DELETE ALL EMPLOYEE-RELATED DATA
            List<Employee> employees = employeeRepository.findByCompanyId(companyId);

            for (Employee employee : employees) {
                UUID employeeId = employee.getId();

                // 1a. Delete employee skills (MOST NESTED)
                try {
                    List<EmployeeSkill> skills = employeeSkillRepository.findByEmployeeId(employeeId);
                    if (!skills.isEmpty()) {
                        employeeSkillRepository.deleteAll(skills);
                        employeeSkillRepository.flush();
                    }
                } catch (Exception e) {
                    log.error("Error deleting skills for employee {}: {}", employeeId, e.getMessage());
                }

                // 1b. Delete availability records
                try {
                    List<EmployeeAvailability> availabilities = availabilityRepository.findByEmployeeId(employeeId);
                    if (!availabilities.isEmpty()) {
                        availabilityRepository.deleteAll(availabilities);
                        availabilityRepository.flush();
                    }
                } catch (Exception e) {
                    log.error("Error deleting availability for employee {}: {}", employeeId, e.getMessage());
                }

                // 1c. Delete task assignments
                try {
                    List<TaskAssignment> assignments = taskAssignmentRepository.findByEmployeeId(employeeId);
                    if (!assignments.isEmpty()) {
                        taskAssignmentRepository.deleteAll(assignments);
                        taskAssignmentRepository.flush();
                    }
                } catch (Exception e) {
                    log.error("Error deleting assignments for employee {}: {}", employeeId, e.getMessage());
                }
            }

            // 1d. NOW delete all employee profiles (after all children are gone)
            if (!employees.isEmpty()) {
                employeeRepository.deleteAll(employees);
                employeeRepository.flush();
            }

            // PHASE 2: DELETE ALL USER-RELATED DATA
            List<User> users = userRepository.findByCompanyId(companyId);

            for (User user : users) {
                UUID userId = user.getId();

                // 2a. Delete notifications
                try {
                    List<Notification> notifications = notificationRepository.findByUserIdAndCompanyId(
                            userId, companyId);
                    if (!notifications.isEmpty()) {
                        notificationRepository.deleteAll(notifications);
                        notificationRepository.flush();
                    }
                } catch (Exception e) {
                    log.error("Error deleting notifications for user {}: {}", userId, e.getMessage());
                }

                // 2b. Delete chat messages
                try {
                    List<ChatMessage> messages = chatMessageRepository.findAllUserMessagesByCompany(
                            userId, companyId);
                    if (!messages.isEmpty()) {
                        chatMessageRepository.deleteAll(messages);
                        chatMessageRepository.flush();
                    }
                } catch (Exception e) {
                    log.error("Error deleting chat messages for user {}: {}", userId, e.getMessage());
                }

                // 2c. Delete task permissions
                try {
                    List<TaskPermission> permissions = taskPermissionRepository.findByUserId(userId);
                    if (!permissions.isEmpty()) {
                        taskPermissionRepository.deleteAll(permissions);
                        taskPermissionRepository.flush();
                    }
                } catch (Exception e) {
                    log.error("Error deleting task permissions for user {}: {}", userId, e.getMessage());
                }
            }

            // PHASE 3: DELETE ALL TASK-RELATED DATA

            List<Task> tasks = taskRepository.findByCompanyId(companyId);

            for (Task task : tasks) {
                UUID taskId = task.getId();
                // 3a. Delete task required skills
                try {
                    List<TaskRequiredSkill> requiredSkills = taskRequiredSkillRepository.findByTaskId(taskId);
                    if (!requiredSkills.isEmpty()) {
                        taskRequiredSkillRepository.deleteAll(requiredSkills);
                        taskRequiredSkillRepository.flush();
                    }
                } catch (Exception e) {
                    log.error("Error deleting required skills for task {}: {}", taskId, e.getMessage());
                }

                // 3b. Delete task comments
                try {
                    List<com.thesis.smart_resource_planner.model.entity.TaskComment> comments = taskCommentRepository
                            .findByTaskIdOrderByCreatedAtDesc(taskId);
                    if (!comments.isEmpty()) {
                        taskCommentRepository.deleteAll(comments);
                        taskCommentRepository.flush();
                    }
                } catch (Exception e) {
                    log.error("Error deleting comments for task {}: {}", taskId, e.getMessage());
                }

                // 3c. Delete audit logs
                try {
                    List<com.thesis.smart_resource_planner.model.entity.TaskAuditLog> auditLogs = taskAuditLogRepository
                            .findByTaskIdOrderByCreatedAtDesc(taskId);
                    if (!auditLogs.isEmpty()) {
                        taskAuditLogRepository.deleteAll(auditLogs);
                        taskAuditLogRepository.flush();
                    }
                } catch (Exception e) {
                    log.error("Error deleting audit logs for task {}: {}", taskId, e.getMessage());
                }

                // 3d. Delete time entries
                try {
                    List<com.thesis.smart_resource_planner.model.entity.TaskTimeEntry> timeEntries = taskTimeEntryRepository
                            .findByTaskIdOrderByWorkDateDesc(taskId);
                    if (!timeEntries.isEmpty()) {
                        taskTimeEntryRepository.deleteAll(timeEntries);
                        taskTimeEntryRepository.flush();
                    }
                } catch (Exception e) {
                    log.error("Error deleting time entries for task {}: {}", taskId, e.getMessage());
                }
            }

            // 3e. Delete all tasks
            if (!tasks.isEmpty()) {
                taskRepository.deleteAll(tasks);
                taskRepository.flush();
            }

            // PHASE 4: DELETE TEAMS
            List<Team> teams = teamRepository.findByCompanyId(companyId);
            if (!teams.isEmpty()) {
                // First, remove team associations from users
                for (User user : users) {
                    if (user.getTeam() != null) {
                        user.setTeam(null);
                        userRepository.save(user);
                    }
                }
                userRepository.flush();

                teamRepository.deleteAll(teams);
                teamRepository.flush();
            }

            // PHASE 5: DELETE DEPARTMENTS

            List<Department> departments = departmentRepository.findByCompanyId(companyId);
            if (!departments.isEmpty()) {
                departmentRepository.deleteAll(departments);
                departmentRepository.flush();
            }

            // PHASE 6: DELETE ALL USERS

            if (!users.isEmpty()) {
                userRepository.deleteAll(users);
                userRepository.flush();
            }

            // PHASE 7: DELETE COMPANY

            companyRepository.delete(company);
            companyRepository.flush();

        } catch (Exception e) {
            throw new RuntimeException("Failed to delete company: " + e.getMessage(), e);
        }
    }

    /**
     * Generates a random 6-character alphanumeric join code that does not already
     * exist in the database, retrying up to 100 times before throwing.
     *
     * @return a unique, uppercase join code
     */
    private String generateUniqueJoinCode() {
        String code;
        int attempts = 0;
        do {
            code = RandomStringUtils.randomAlphanumeric(6).toUpperCase();
            attempts++;
            if (attempts > 100) {
                throw new RuntimeException("Failed to generate unique join code");
            }
        } while (companyRepository.existsByJoinCode(code));
        return code;
    }
}