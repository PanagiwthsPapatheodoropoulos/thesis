package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.exception.BadRequestException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.CompanyDTO;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.modelmapper.ModelMapper;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.apache.commons.lang3.RandomStringUtils;

import java.util.List;
import java.util.UUID;

/**
 * Service for company lifecycle management.
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

    public Company createCompany(String name) {
        if (companyRepository.existsByName(name)) {
            throw new DuplicateResourceException("Company with this name already exists");
        }

        String joinCode = generateUniqueJoinCode();

        Company company = Company.builder()
                .name(name)
                .joinCode(joinCode)
                .isActive(true)
                .build();

        Company saved = companyRepository.save(company);

        createDefaultDepartments(saved);
        createDefaultTeams(saved);

        return saved;
    }

    private void createDefaultDepartments(Company company) {
        List<Department> departments = List.of(
                Department.builder().name("Engineering").description("Software development and technical teams").company(company).build(),
                Department.builder().name("Marketing").description("Marketing and brand management").company(company).build(),
                Department.builder().name("Sales").description("Sales and business development").company(company).build(),
                Department.builder().name("Human Resources").description("HR and people operations").company(company).build(),
                Department.builder().name("Finance").description("Accounting and financial planning").company(company).build());
        departmentRepository.saveAll(departments);
    }

    private void createDefaultTeams(Company company) {
        List<Team> teams = List.of(
                Team.builder().name("Development Team").description("Main development team for AI projects").company(company).build(),
                Team.builder().name("Marketing Team").description("Marketing and communications team").company(company).build());
        teamRepository.saveAll(teams);
    }

    public Company findByJoinCode(String joinCode) {
        return companyRepository.findByJoinCode(joinCode)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid company code"));
    }

    public Company getDefaultCompany() {
        UUID defaultCompanyId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        return companyRepository.findById(defaultCompanyId)
                .orElseThrow(() -> new ResourceNotFoundException("Default company not found"));
    }

    /**
     * Resolves the company of the given user and returns its details.
     * Employee count excludes ADMIN-role users (they are not counted as employees).
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "company", key = "#userId")
    public CompanyDTO getCompanyById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Company company = user.getCompany();
        if (company == null)
            throw new ResourceNotFoundException("Company not found");

        CompanyDTO dto = modelMapper.map(company, CompanyDTO.class);
        // Count only non-admin users (EMPLOYEE + MANAGER + USER roles)
        dto.setEmployeeCount((int) userRepository.countByCompanyIdAndRoleNot(company.getId(), UserRole.ADMIN));
        dto.setDepartmentCount(departmentRepository.findByCompanyId(company.getId()).size());
        dto.setTeamCount(teamRepository.findByCompanyId(company.getId()).size());

        return dto;
    }

    @Transactional(readOnly = true)
    public List<CompanyDTO> getAllCompanies() {
        return companyRepository.findAll().stream()
                .map(company -> {
                    CompanyDTO dto = modelMapper.map(company, CompanyDTO.class);
                    dto.setEmployeeCount((int) userRepository.countByCompanyIdAndRoleNot(company.getId(), UserRole.ADMIN));
                    dto.setDepartmentCount(departmentRepository.findByCompanyId(company.getId()).size());
                    dto.setTeamCount(teamRepository.findByCompanyId(company.getId()).size());
                    return dto;
                })
                .toList();
    }

    @CacheEvict(value = "company", allEntries = true)
    public String regenerateJoinCode(UUID companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));

        String newJoinCode = generateUniqueJoinCode();
        company.setJoinCode(newJoinCode);
        companyRepository.save(company);

        return newJoinCode;
    }

    @Transactional
    @CacheEvict(value = {"company", "employees", "employee", "employeeByUser", "employeeSkills", "employeeWorkload", "departments", "departmentNames"}, allEntries = true)
    public void deleteCompany(UUID companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));

        try {
            List<Employee> employees = employeeRepository.findByCompanyId(companyId);

            for (Employee employee : employees) {
                UUID employeeId = employee.getId();
                try {
                    List<EmployeeSkill> skills = employeeSkillRepository.findByEmployeeId(employeeId);
                    if (!skills.isEmpty()) { employeeSkillRepository.deleteAll(skills); employeeSkillRepository.flush(); }
                } catch (Exception e) { log.error("Error deleting skills for employee {}: {}", employeeId, e.getMessage()); }

                try {
                    List<EmployeeAvailability> availabilities = availabilityRepository.findByEmployeeId(employeeId);
                    if (!availabilities.isEmpty()) { availabilityRepository.deleteAll(availabilities); availabilityRepository.flush(); }
                } catch (Exception e) { log.error("Error deleting availability for employee {}: {}", employeeId, e.getMessage()); }

                try {
                    List<TaskAssignment> assignments = taskAssignmentRepository.findByEmployeeId(employeeId);
                    if (!assignments.isEmpty()) { taskAssignmentRepository.deleteAll(assignments); taskAssignmentRepository.flush(); }
                } catch (Exception e) { log.error("Error deleting assignments for employee {}: {}", employeeId, e.getMessage()); }
            }

            if (!employees.isEmpty()) { employeeRepository.deleteAll(employees); employeeRepository.flush(); }

            List<User> users = userRepository.findByCompanyId(companyId);

            for (User user : users) {
                UUID userId = user.getId();
                try {
                    List<Notification> notifications = notificationRepository.findByUserIdAndCompanyId(userId, companyId);
                    if (!notifications.isEmpty()) { notificationRepository.deleteAll(notifications); notificationRepository.flush(); }
                } catch (Exception e) { log.error("Error deleting notifications for user {}: {}", userId, e.getMessage()); }

                try {
                    List<ChatMessage> messages = chatMessageRepository.findAllUserMessagesByCompany(userId, companyId);
                    if (!messages.isEmpty()) { chatMessageRepository.deleteAll(messages); chatMessageRepository.flush(); }
                } catch (Exception e) { log.error("Error deleting chat messages for user {}: {}", userId, e.getMessage()); }

                try {
                    List<TaskPermission> permissions = taskPermissionRepository.findByUserId(userId);
                    if (!permissions.isEmpty()) { taskPermissionRepository.deleteAll(permissions); taskPermissionRepository.flush(); }
                } catch (Exception e) { log.error("Error deleting task permissions for user {}: {}", userId, e.getMessage()); }
            }

            List<Task> tasks = taskRepository.findByCompanyId(companyId);

            for (Task task : tasks) {
                UUID taskId = task.getId();
                try {
                    List<TaskRequiredSkill> requiredSkills = taskRequiredSkillRepository.findByTaskId(taskId);
                    if (!requiredSkills.isEmpty()) { taskRequiredSkillRepository.deleteAll(requiredSkills); taskRequiredSkillRepository.flush(); }
                } catch (Exception e) { log.error("Error deleting required skills for task {}: {}", taskId, e.getMessage()); }

                try {
                    List<TaskComment> comments = taskCommentRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
                    if (!comments.isEmpty()) { taskCommentRepository.deleteAll(comments); taskCommentRepository.flush(); }
                } catch (Exception e) { log.error("Error deleting comments for task {}: {}", taskId, e.getMessage()); }

                try {
                    List<TaskAuditLog> auditLogs = taskAuditLogRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
                    if (!auditLogs.isEmpty()) { taskAuditLogRepository.deleteAll(auditLogs); taskAuditLogRepository.flush(); }
                } catch (Exception e) { log.error("Error deleting audit logs for task {}: {}", taskId, e.getMessage()); }

                try {
                    List<TaskTimeEntry> timeEntries = taskTimeEntryRepository.findByTaskIdOrderByWorkDateDesc(taskId);
                    if (!timeEntries.isEmpty()) { taskTimeEntryRepository.deleteAll(timeEntries); taskTimeEntryRepository.flush(); }
                } catch (Exception e) { log.error("Error deleting time entries for task {}: {}", taskId, e.getMessage()); }
            }

            if (!tasks.isEmpty()) { taskRepository.deleteAll(tasks); taskRepository.flush(); }

            List<Team> teams = teamRepository.findByCompanyId(companyId);
            if (!teams.isEmpty()) {
                for (User user : users) {
                    if (user.getTeam() != null) { user.setTeam(null); userRepository.save(user); }
                }
                userRepository.flush();
                teamRepository.deleteAll(teams);
                teamRepository.flush();
            }

            List<Department> departments = departmentRepository.findByCompanyId(companyId);
            if (!departments.isEmpty()) { departmentRepository.deleteAll(departments); departmentRepository.flush(); }

            if (!users.isEmpty()) { userRepository.deleteAll(users); userRepository.flush(); }

            companyRepository.delete(company);
            companyRepository.flush();

        } catch (Exception e) {
            throw new IllegalStateException("Failed to delete company: " + e.getMessage(), e);
        }
    }

    private String generateUniqueJoinCode() {
        String code;
        int attempts = 0;
        do {
            code = RandomStringUtils.randomAlphanumeric(6).toUpperCase();
            attempts++;
            if (attempts > 100) {
                throw new BadRequestException("Failed to generate unique join code");
            }
        } while (companyRepository.existsByJoinCode(code));
        return code;
    }
}
