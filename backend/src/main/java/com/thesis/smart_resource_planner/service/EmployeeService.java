package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.*;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.*;
import jakarta.validation.ValidationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for employee profile lifecycle management.
 *
 * <p>
 * Handles creation, retrieval (by ID, user ID, department, skill),
 * paginated listing, update, and deletion of employee profiles. Also
 * manages employee skills, availability windows, and workload calculations.
 * Broadcasts profile updates over WebSocket and sends role-promotion
 * notifications when a USER-role account is elevated to EMPLOYEE on
 * profile creation.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final SkillRepository skillRepository;
    private final EmployeeSkillRepository employeeSkillRepository;
    private final EmployeeAvailabilityRepository availabilityRepository;
    private final NotificationService notificationService;
    private final ModelMapper modelMapper;
    private final TaskAssignmentRepository taskAssignmentRepository;
    private final TaskRepository taskRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final WebSocketBroadcastService broadcastService;

    /**
     * Creates an employee profile for the given user, handling orphaned
     * records by cleaning them up before retrying.
     * Promotes the user from {@code USER} to {@code EMPLOYEE} role automatically
     * and sends a role-promotion notification after the transaction commits.
     *
     * @param createDTO DTO with personal details and optional skill/availability
     *                  data
     * @return the saved {@link EmployeeDTO}
     * @throws jakarta.validation.ValidationException if an active employee profile
     *                                                already exists for the user
     */
    @Transactional
    public EmployeeDTO createEmployee(EmployeeCreateDTO createDTO) {
        // Check if employee profile EXISTS (including orphaned records)
        Optional<Employee> existingEmployee = employeeRepository.findByUserId(createDTO.getUserId());

        if (existingEmployee.isPresent()) {
            Employee existing = existingEmployee.get();

            // If the user reference is broken (orphaned record), delete it
            if (existing.getUser() == null) {
                try {
                    employeeSkillRepository.deleteByEmployeeId(existing.getId());
                    availabilityRepository.deleteByEmployeeId(existing.getId());
                    taskAssignmentRepository.deleteByEmployeeId(existing.getId());
                    employeeRepository.delete(existing);
                    employeeRepository.flush();

                    // Retry creation after cleanup
                    return createEmployeeInternal(createDTO);
                } catch (Exception e) {
                    throw new RuntimeException("Cannot create employee: orphaned record exists and cleanup failed");
                }
            }

            throw new ValidationException("Employee profile already exists for user ID: " + createDTO.getUserId());
        }

        return createEmployeeInternal(createDTO);
    }

    /**
     * Core creation logic shared by {@link #createEmployee} and the orphan-cleanup
     * retry path.
     * Promotes a USER to EMPLOYEE role if needed and registers a post-commit
     * notification.
     *
     * @param createDTO DTO with employee personal and work details
     * @return the saved {@link EmployeeDTO}
     */
    private EmployeeDTO createEmployeeInternal(EmployeeCreateDTO createDTO) {
        User user = userRepository.findById(createDTO.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + createDTO.getUserId()));

        boolean roleChanged = false;
        if (user.getRole() == UserRole.USER) {
            user.setRole(UserRole.EMPLOYEE);
            userRepository.saveAndFlush(user);
            roleChanged = true;
        }

        Employee employee = new Employee();
        employee.setUser(user);
        employee.setFirstName(createDTO.getFirstName());
        employee.setLastName(createDTO.getLastName());
        employee.setPosition(createDTO.getPosition());
        employee.setDepartment(createDTO.getDepartment());
        employee.setHireDate(createDTO.getHireDate());
        employee.setHourlyRate(createDTO.getHourlyRate());
        employee.setMaxWeeklyHours(createDTO.getMaxWeeklyHours() != null ? createDTO.getMaxWeeklyHours() : 40);
        employee.setTimezone(
                createDTO.getTimezone() != null && !createDTO.getTimezone().isEmpty() ? createDTO.getTimezone()
                        : "UTC");
        employee.setProfileImageUrl(createDTO.getProfileImageUrl());

        Employee savedEmployee = employeeRepository.saveAndFlush(employee);

        if (roleChanged) {
            final User finalUser = user;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        NotificationCreateDTO notification = new NotificationCreateDTO();
                        notification.setUserId(finalUser.getId());
                        notification.setType("ROLE_PROMOTION");
                        notification.setTitle("🎉 You've been promoted to Employee!");
                        notification.setMessage(
                                "An administrator has created an employee profile for you. Please log out and log back in to access all employee features.");
                        notification.setSeverity(NotificationSeverity.SUCCESS);
                        notification.setRelatedEntityType(EntityType.EMPLOYEE);
                        notification.setRelatedEntityId(savedEmployee.getId());

                        notificationService.createNotification(notification);
                    } catch (Exception e) {
                        log.warn("Failed to send role promotion notification: {}", e.getMessage());
                    }
                }
            });
        }

        return modelMapper.map(savedEmployee, EmployeeDTO.class);
    }

    /**
     * Returns all skills associated with the given employee, eagerly loaded.
     *
     * @param employeeId UUID of the employee
     * @return list of {@link EmployeeSkillDTO} objects, or an empty list if none
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               employee
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<EmployeeSkillDTO> getEmployeeSkills(UUID employeeId) {
        // Verify employee exists first
        if (!employeeRepository.existsById(employeeId)) {
            throw new ResourceNotFoundException("Employee not found with ID: " + employeeId);
        }

        List<EmployeeSkill> skills = employeeSkillRepository.findByEmployeeId(employeeId);

        if (skills.isEmpty()) {
            return Collections.emptyList();
        }

        List<EmployeeSkillDTO> result = skills.stream()
                .map(skill -> {
                    EmployeeSkillDTO dto = new EmployeeSkillDTO();
                    dto.setId(skill.getId());

                    // Ensure skill is loaded
                    if (skill.getSkill() != null) {
                        dto.setSkillId(skill.getSkill().getId());
                        dto.setSkillName(skill.getSkill().getName());
                        dto.setSkillCategory(skill.getSkill().getCategory());
                    } else {
                        log.error("Skill entity is NULL for EmployeeSkill ID: {}", skill.getId());
                    }

                    dto.setProficiencyLevel(skill.getProficiencyLevel());
                    dto.setYearsOfExperience(skill.getYearsOfExperience());
                    dto.setLastUsed(skill.getLastUsed());

                    return dto;
                })
                .toList();

        return result;
    }

    /**
     * Calculates the workload distribution for all employees in the requesting
     * user's company. Tasks are weighted to avoid multi-week tasks inflating
     * the weekly load figure (large tasks are partially dampened).
     *
     * @param userId UUID of the requesting user (determines company scope)
     * @return list of {@link EmployeeWorkloadDTO} with active/pending/completed
     *         counts
     *         and a workload percentage relative to each employee's max weekly
     *         hours
     */
    public List<EmployeeWorkloadDTO> getEmployeeWorkload(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        UUID companyId = user.getCompany().getId();

        // 1. OPTIMIZATION: Fetch ALL company tasks ONCE, outside the loop
        List<Task> allCompanyTasks = taskRepository.findByCompanyId(companyId).stream()
                .filter(t -> !t.getTitle().startsWith("[REQUEST]"))
                .filter(t -> !Boolean.TRUE.equals(t.getIsEmployeeRequest()))
                .toList();

        List<TaskAssignment> acceptedAssignments = taskAssignmentRepository
                .findByCompanyIdAndStatus(companyId, TaskAssignmentStatus.ACCEPTED);

        Map<UUID, Set<UUID>> acceptedTasksByEmployee = acceptedAssignments.stream()
                .collect(Collectors.groupingBy(
                        ta -> ta.getEmployee().getId(),
                        Collectors.mapping(ta -> ta.getTask().getId(), Collectors.toSet())));

        List<Employee> employees = employeeRepository.findByCompanyIdWithTeam(companyId).stream()
                .filter(emp -> emp.getUser() != null && emp.getUser().getRole() == UserRole.EMPLOYEE)
                .toList();

        return employees.stream().map(emp -> {

            // 2. Filter relevant tasks for THIS employee using the pre-fetched list
            List<Task> relevantTasks = allCompanyTasks.stream()
                    .filter(task -> {
                        // A. Personally assigned
                        if (task.getAssignedEmployeeId() != null &&
                                task.getAssignedEmployeeId().equals(emp.getId())) {
                            return true;
                        }

                        // B. Has ACCEPTED assignment
                        Set<UUID> empAcceptedTasks = acceptedTasksByEmployee
                                .getOrDefault(emp.getId(), Collections.emptySet());
                        boolean hasAcceptedAssignment = empAcceptedTasks.contains(task.getId());

                        if (hasAcceptedAssignment) {
                            return true;
                        }

                        // C. Team task (no specific assignment)
                        if (task.getTeam() != null && task.getAssignedEmployeeId() == null) {
                            UUID userTeamId = emp.getUser().getTeam() != null ? emp.getUser().getTeam().getId() : null;
                            return task.getTeam().getId().equals(userTeamId);
                        }

                        // D. Public task (no team, no assignment) - Optional, keep if needed
                        return task.getTeam() == null && task.getAssignedEmployeeId() == null;
                    })
                    .toList();

            int active = (int) relevantTasks.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS).count();
            int completed = (int) relevantTasks.stream().filter(t -> t.getStatus() == TaskStatus.COMPLETED).count();
            int pending = (int) relevantTasks.stream().filter(t -> t.getStatus() == TaskStatus.PENDING).count();

            // Calculate hours based on ACTUAL task estimates
            double hoursUsed = relevantTasks.stream()
                    .mapToDouble(t -> {
                        // Completed tasks do not count towards CURRENT workload
                        if (t.getStatus() == TaskStatus.COMPLETED) {
                            return 0;
                        }

                        double estimate = 4.0;
                        if (t.getEstimatedHours() != null) {
                            estimate = t.getEstimatedHours().doubleValue();
                        }

                        // 2. SMART WEIGHTING:
                        // Large tasks (e.g., 26 hours) usually span multiple weeks.
                        // If we count the full 26 hours, it breaks the weekly chart.
                        // Logic: Count the first 8 hours fully, then dampen the rest.

                        double threshold = 8.0; // 1 full workday
                        if (estimate <= threshold) {
                            return estimate;
                        } else {
                            // Example: Task is 26 hours.
                            // First 8 hours count as 8.
                            // Remaining 18 hours count as 4.5 (25% weight).
                            // Total "Weekly Load" impact = 12.5 hours.
                            return threshold + ((estimate - threshold) * 0.25);
                        }
                    })
                    .sum();

            double maxHours = emp.getMaxWeeklyHours() > 0 ? emp.getMaxWeeklyHours() : 40;
            double workload = (hoursUsed / maxHours) * 100.0;

            if (Double.isNaN(workload) || Double.isInfinite(workload)) {
                workload = 0;
            }
            workload = Math.max(0, Math.min(200, workload));

            int availableHours = (int) Math.max(0, maxHours - hoursUsed);

            String status = workload < 50 ? "UNDERLOADED" : workload <= 85 ? "OPTIMAL" : "OVERLOADED";

            return EmployeeWorkloadDTO.builder()
                    .employeeId(emp.getId())
                    .employeeName(emp.getFirstName() + " " + emp.getLastName())
                    .department(emp.getDepartment())
                    .activeTasks(active)
                    .completedTasks(completed)
                    .pendingTasks(pending)
                    .workloadPercentage(workload)
                    .availableHours(availableHours)
                    .status(status)
                    .build();
        }).toList();
    }

    /**
     * Retrieves a single employee by UUID, including fully populated skills.
     *
     * @param id UUID of the employee
     * @return the matching {@link EmployeeDTO} with skills
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    @Transactional(readOnly = true)
    public EmployeeDTO getEmployeeById(UUID id) {
        // Use eager-loading query
        Employee employee = employeeRepository.findByIdWithSkills(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with ID: " + id));

        EmployeeDTO dto = new EmployeeDTO();
        dto.setId(employee.getId());
        dto.setUserId(employee.getUser().getId());
        dto.setFirstName(employee.getFirstName());
        dto.setLastName(employee.getLastName());
        dto.setPosition(employee.getPosition());
        dto.setDepartment(employee.getDepartment());
        dto.setHireDate(employee.getHireDate());
        dto.setHourlyRate(employee.getHourlyRate());
        dto.setMaxWeeklyHours(employee.getMaxWeeklyHours());
        dto.setTimezone(employee.getTimezone());
        dto.setProfileImageUrl(employee.getProfileImageUrl());
        dto.setCreatedAt(employee.getCreatedAt());
        dto.setUpdatedAt(employee.getUpdatedAt());

        // Map skills manually
        List<EmployeeSkillDTO> skillDTOs = new ArrayList<>();
        if (employee.getEmployeeSkills() != null) {
            for (EmployeeSkill skill : employee.getEmployeeSkills()) {
                if (skill != null && skill.getSkill() != null) {
                    EmployeeSkillDTO skillDTO = new EmployeeSkillDTO();
                    skillDTO.setId(skill.getId());
                    skillDTO.setSkillId(skill.getSkill().getId());
                    skillDTO.setSkillName(skill.getSkill().getName());
                    skillDTO.setSkillCategory(skill.getSkill().getCategory());
                    skillDTO.setProficiencyLevel(skill.getProficiencyLevel());
                    skillDTO.setYearsOfExperience(skill.getYearsOfExperience());
                    skillDTO.setLastUsed(skill.getLastUsed());
                    skillDTOs.add(skillDTO);
                }
            }
        }
        dto.setSkills(skillDTOs);

        return dto;
    }

    /**
     * Retrieves the employee profile for the given user UUID, including fully
     * populated skills.
     *
     * @param userId UUID of the user
     * @return the matching {@link EmployeeDTO} with skills
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               no
     *                                                                               profile
     *                                                                               exists
     *                                                                               for
     *                                                                               the
     *                                                                               user
     */
    @Transactional(readOnly = true)
    public EmployeeDTO getEmployeeByUserId(UUID userId) {
        // Use eager-loading query
        Employee employee = employeeRepository.findByUserIdWithSkills(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found for user ID: " + userId));

        // Manual mapping to avoid Hibernate issues
        EmployeeDTO dto = new EmployeeDTO();
        dto.setId(employee.getId());
        dto.setUserId(employee.getUser().getId());
        dto.setFirstName(employee.getFirstName());
        dto.setLastName(employee.getLastName());
        dto.setPosition(employee.getPosition());
        dto.setDepartment(employee.getDepartment());
        dto.setHireDate(employee.getHireDate());
        dto.setHourlyRate(employee.getHourlyRate());
        dto.setMaxWeeklyHours(employee.getMaxWeeklyHours());
        dto.setTimezone(employee.getTimezone());
        dto.setProfileImageUrl(employee.getProfileImageUrl());
        dto.setCreatedAt(employee.getCreatedAt());
        dto.setUpdatedAt(employee.getUpdatedAt());

        // Skills are already eagerly loaded
        List<EmployeeSkillDTO> skillDTOs = new ArrayList<>();
        if (employee.getEmployeeSkills() != null) {
            for (EmployeeSkill skill : employee.getEmployeeSkills()) {
                if (skill != null && skill.getSkill() != null) {
                    EmployeeSkillDTO skillDTO = new EmployeeSkillDTO();
                    skillDTO.setId(skill.getId());
                    skillDTO.setSkillId(skill.getSkill().getId());
                    skillDTO.setSkillName(skill.getSkill().getName());
                    skillDTO.setSkillCategory(skill.getSkill().getCategory());
                    skillDTO.setProficiencyLevel(skill.getProficiencyLevel());
                    skillDTO.setYearsOfExperience(skill.getYearsOfExperience());
                    skillDTO.setLastUsed(skill.getLastUsed());
                    skillDTOs.add(skillDTO);
                }
            }
        }
        dto.setSkills(skillDTOs);

        return dto;
    }

    // Skills must be eagerly loaded
    /**
     * Returns all employees in the requesting user's company.
     * Skills are batch-loaded in a single query. Hourly rate is hidden
     * from non-admin/non-manager callers.
     *
     * @param userId UUID of the requesting user
     * @return list of {@link EmployeeDTO} objects (EMPLOYEE role only)
     */
    @Transactional(readOnly = true)
    public List<EmployeeDTO> getAllEmployees(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        UUID companyId = user.getCompany().getId();
        boolean canViewSalary = user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.MANAGER;

        // Use eager loading query
        List<Employee> employees = employeeRepository.findByCompanyIdWithSkills(companyId);

        // Batch fetch all employee skills in ONE query
        Map<UUID, List<EmployeeSkillDTO>> employeeSkillsMap = new HashMap<>();
        if (!employees.isEmpty()) {
            List<UUID> employeeIds = employees.stream()
                    .map(Employee::getId)
                    .toList();

            // Get all skills for all employees in one query
            List<EmployeeSkill> allSkills = employeeSkillRepository.findByEmployeeIdIn(employeeIds);

            allSkills.forEach(skill -> {
                EmployeeSkillDTO skillDTO = new EmployeeSkillDTO();
                skillDTO.setId(skill.getId());
                if (skill.getSkill() != null) {
                    skillDTO.setSkillId(skill.getSkill().getId());
                    skillDTO.setSkillName(skill.getSkill().getName());
                    skillDTO.setSkillCategory(skill.getSkill().getCategory());
                }
                skillDTO.setProficiencyLevel(skill.getProficiencyLevel());
                skillDTO.setYearsOfExperience(skill.getYearsOfExperience());
                skillDTO.setLastUsed(skill.getLastUsed());

                employeeSkillsMap.computeIfAbsent(skill.getEmployee().getId(), k -> new ArrayList<>())
                        .add(skillDTO);
            });
        }

        return employees.stream()
                .filter(employee -> employee.getUser().getRole() == UserRole.EMPLOYEE)
                .map(employee -> {
                    EmployeeDTO dto = modelMapper.map(employee, EmployeeDTO.class);
                    dto.setSkills(employeeSkillsMap.getOrDefault(employee.getId(), List.of()));

                    // SECURITY FIX: Hide salary info for non-privileged users
                    if (!canViewSalary) {
                        dto.setHourlyRate(null);
                    }

                    return dto;
                })
                .toList();
    }

    /**
     * Returns a paginated, filterable slice of employees in the requesting user's
     * company.
     * Applies a native case-insensitive search. Hourly rate is hidden from
     * non-privileged callers.
     *
     * @param userId     UUID of the requesting user
     * @param pageable   pagination parameters
     * @param department optional department filter
     * @param position   optional position filter
     * @param search     optional free-text search
     * @return a {@link Page} of {@link EmployeeDTO} objects
     */
    @Transactional(readOnly = true)
    public Page<EmployeeDTO> getEmployeesPaginated(UUID userId, Pageable pageable,
            String department, String position, String search) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        boolean canViewSalary = user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.MANAGER;
        UUID companyId = user.getCompany().getId();

        // Use NATIVE query with ILIKE for case-insensitive search
        Page<Employee> employeePage = employeeRepository.findByCompanyIdWithFiltersNative(
                companyId,
                department,
                position,
                search,
                pageable);

        if (employeePage.isEmpty()) {
            return Page.empty(pageable);
        }

        // Extract IDs from current page
        List<UUID> employeeIds = employeePage.getContent().stream()
                .map(Employee::getId)
                .toList();

        // Batch fetch all employee skills in ONE query
        Map<UUID, List<EmployeeSkillDTO>> employeeSkillsMap = new HashMap<>();
        List<EmployeeSkill> allSkills = employeeSkillRepository.findByEmployeeIdIn(employeeIds);

        allSkills.forEach(skill -> {
            EmployeeSkillDTO skillDTO = new EmployeeSkillDTO();
            skillDTO.setId(skill.getId());
            if (skill.getSkill() != null) {
                skillDTO.setSkillId(skill.getSkill().getId());
                skillDTO.setSkillName(skill.getSkill().getName());
                skillDTO.setSkillCategory(skill.getSkill().getCategory());
            }
            skillDTO.setProficiencyLevel(skill.getProficiencyLevel());
            skillDTO.setYearsOfExperience(skill.getYearsOfExperience());
            skillDTO.setLastUsed(skill.getLastUsed());

            employeeSkillsMap.computeIfAbsent(skill.getEmployee().getId(), k -> new ArrayList<>())
                    .add(skillDTO);
        });

        // Map to DTOs
        List<EmployeeDTO> employeeDTOs = employeePage.getContent().stream()
                .filter(employee -> employee.getUser().getRole() == UserRole.EMPLOYEE)
                .map(employee -> {
                    EmployeeDTO dto = modelMapper.map(employee, EmployeeDTO.class);
                    dto.setSkills(employeeSkillsMap.getOrDefault(employee.getId(), List.of()));

                    // SECURITY FIX: Hide salary info for non-privileged users
                    if (!canViewSalary) {
                        dto.setHourlyRate(null);
                    }

                    return dto;
                })
                .toList();

        return new PageImpl<>(employeeDTOs, pageable, employeePage.getTotalElements());
    }

    /**
     * Returns all employees belonging to a specific department within the
     * requesting user's company.
     *
     * @param departmentName name of the department
     * @param userId         UUID of the requesting user
     * @return list of matching {@link EmployeeDTO} objects
     */
    @Transactional(readOnly = true)
    public List<EmployeeDTO> getEmployeesByDepartment(String departmentName, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        UUID companyId = user.getCompany().getId();

        // Call the new multi-tenant repository method
        List<Employee> employees = employeeRepository
                .findByDepartmentAndCompanyId(departmentName, companyId);

        return employees.stream()
                .map(employee -> modelMapper.map(employee, EmployeeDTO.class))
                .toList();
    }

    /**
     * Returns all employees who possess a specific skill, optionally filtered by a
     * minimum proficiency level.
     *
     * @param skillId        UUID of the skill
     * @param minProficiency optional minimum proficiency (1–5); pass {@code null}
     *                       to return all
     * @return list of matching {@link EmployeeDTO} objects
     */
    @Transactional(readOnly = true)
    public List<EmployeeDTO> getEmployeesBySkill(UUID skillId, Integer minProficiency) {
        List<Employee> employees;
        if (minProficiency != null) {
            employees = employeeRepository.findBySkillAndMinProficiency(skillId, minProficiency);
        } else {
            employees = employeeRepository.findBySkillId(skillId);
        }
        return employees.stream()
                .map(employee -> modelMapper.map(employee, EmployeeDTO.class))
                .toList();
    }

    /**
     * Adds a skill to an employee's profile (or updates it if it already exists).
     *
     * @param employeeId UUID of the employee
     * @param skillDTO   DTO containing skill ID, proficiency level, years of
     *                   experience, and last-used date
     * @return the saved or updated {@link EmployeeSkillDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               employee
     *                                                                               or
     *                                                                               skill
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional
    public EmployeeSkillDTO addSkillToEmployee(UUID employeeId, EmployeeSkillDTO skillDTO) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        Skill skill = skillRepository.findById(skillDTO.getSkillId())
                .orElseThrow(() -> new ResourceNotFoundException("Skill not found"));

        // Check if skill already exists for this employee
        Optional<EmployeeSkill> existing = employeeSkillRepository
                .findByEmployeeIdAndSkillId(employeeId, skillDTO.getSkillId());

        if (existing.isPresent()) {
            EmployeeSkill existingSkill = existing.get();
            existingSkill.setProficiencyLevel(skillDTO.getProficiencyLevel());
            existingSkill.setYearsOfExperience(skillDTO.getYearsOfExperience());
            existingSkill.setLastUsed(skillDTO.getLastUsed());

            EmployeeSkill updated = employeeSkillRepository.saveAndFlush(existingSkill);

            EmployeeSkillDTO dto = modelMapper.map(updated, EmployeeSkillDTO.class);
            dto.setSkillId(skill.getId());
            dto.setSkillName(skill.getName());
            dto.setSkillCategory(skill.getCategory());
            return dto;
        }

        // Create new skill mapping
        EmployeeSkill employeeSkill = new EmployeeSkill();
        employeeSkill.setEmployee(employee);
        employeeSkill.setSkill(skill);
        employeeSkill.setProficiencyLevel(skillDTO.getProficiencyLevel() != null ? skillDTO.getProficiencyLevel() : 3);
        employeeSkill.setYearsOfExperience(
                skillDTO.getYearsOfExperience() != null ? skillDTO.getYearsOfExperience() : BigDecimal.ZERO);
        employeeSkill.setLastUsed(skillDTO.getLastUsed());

        // Use saveAndFlush to ensure immediate persistence
        EmployeeSkill saved = employeeSkillRepository.saveAndFlush(employeeSkill);

        // Verify it was saved
        boolean exists = employeeSkillRepository.existsById(saved.getId());

        // Map to DTO with full skill information
        EmployeeSkillDTO resultDTO = new EmployeeSkillDTO();
        resultDTO.setId(saved.getId());
        resultDTO.setSkillId(skill.getId());
        resultDTO.setSkillName(skill.getName());
        resultDTO.setSkillCategory(skill.getCategory());
        resultDTO.setProficiencyLevel(saved.getProficiencyLevel());
        resultDTO.setYearsOfExperience(saved.getYearsOfExperience());
        resultDTO.setLastUsed(saved.getLastUsed());

        return resultDTO;
    }

    /**
     * Removes a skill from an employee's profile.
     *
     * @param employeeId UUID of the employee
     * @param skillId    UUID of the skill to remove
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               skill
     *                                                                               is
     *                                                                               not
     *                                                                               associated
     *                                                                               with
     *                                                                               the
     *                                                                               employee
     */
    public void removeSkillFromEmployee(UUID employeeId, UUID skillId) {
        EmployeeSkill employeeSkill = employeeSkillRepository
                .findByEmployeeIdAndSkillId(employeeId, skillId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee skill not found"));

        employeeSkillRepository.delete(employeeSkill);
    }

    /**
     * Creates or updates an availability record for the given employee on a
     * specific date.
     *
     * @param availabilityDTO DTO containing employee ID, date, available hours, and
     *                        a flag for availability
     * @return the saved {@link EmployeeAvailabilityDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               employee
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    public EmployeeAvailabilityDTO setEmployeeAvailability(EmployeeAvailabilityDTO availabilityDTO) {
        Employee employee = employeeRepository.findById(availabilityDTO.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        // Get employee's company
        UUID companyId = employee.getUser().getCompany().getId();

        // Use the correct query method for single date
        EmployeeAvailability availability = availabilityRepository
                .findByEmployeeIdAndDateAndCompanyId(
                        employee.getId(),
                        availabilityDTO.getDate(),
                        companyId)
                .orElseGet(() -> {
                    EmployeeAvailability newAvail = new EmployeeAvailability();
                    newAvail.setEmployee(employee);
                    newAvail.setDate(availabilityDTO.getDate());
                    return newAvail;
                });

        availability.setAvailableHours(availabilityDTO.getAvailableHours());
        availability.setIsAvailable(availabilityDTO.getIsAvailable());
        availability.setNotes(availabilityDTO.getNotes());

        EmployeeAvailability saved = availabilityRepository.save(availability);
        return modelMapper.map(saved, EmployeeAvailabilityDTO.class);
    }

    /**
     * Returns all availability records for an employee within a date range, scoped
     * to the employee's company.
     *
     * @param employeeId UUID of the employee
     * @param startDate  inclusive start of the date range
     * @param endDate    inclusive end of the date range
     * @return list of {@link EmployeeAvailabilityDTO} objects
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               employee
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<EmployeeAvailabilityDTO> getEmployeeAvailability(UUID employeeId,
            LocalDate startDate,
            LocalDate endDate) {
        // Get employee's company
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        UUID companyId = employee.getUser().getCompany().getId();

        // Use company-filtered query
        return availabilityRepository.findByEmployeeIdAndDateBetweenAndCompanyId(
                employeeId, startDate, endDate, companyId).stream()
                .map(availability -> modelMapper.map(availability, EmployeeAvailabilityDTO.class))
                .toList();
    }

    /**
     * Partially updates an employee's profile fields (null fields are ignored).
     * Broadcasts a profile-update event via WebSocket to the employee and all
     * connected users after the transaction commits.
     *
     * @param id        UUID of the employee to update
     * @param updateDTO DTO containing the fields to update
     * @return the updated {@link EmployeeDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               employee
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    public EmployeeDTO updateEmployee(UUID id, EmployeeCreateDTO updateDTO) {

        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        if (updateDTO.getFirstName() != null) {
            employee.setFirstName(updateDTO.getFirstName());
        }
        if (updateDTO.getLastName() != null) {
            employee.setLastName(updateDTO.getLastName());
        }
        if (updateDTO.getPosition() != null) {
            employee.setPosition(updateDTO.getPosition());
        }
        if (updateDTO.getDepartment() != null) {
            employee.setDepartment(updateDTO.getDepartment());
        }
        if (updateDTO.getHireDate() != null) {
            employee.setHireDate(updateDTO.getHireDate());
        }
        if (updateDTO.getHourlyRate() != null) {
            employee.setHourlyRate(updateDTO.getHourlyRate());
        }
        if (updateDTO.getMaxWeeklyHours() != null) {
            employee.setMaxWeeklyHours(updateDTO.getMaxWeeklyHours());
        }
        if (updateDTO.getTimezone() != null) {
            employee.setTimezone(updateDTO.getTimezone());
        }
        if (updateDTO.getProfileImageUrl() != null) {
            employee.setProfileImageUrl(updateDTO.getProfileImageUrl());
        }

        Employee updated = employeeRepository.save(employee);

        // Broadcast profile update to ALL users via WebSocket
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    if (updated.getUser() != null) {
                        Map<String, Object> updateEvent = Map.of(
                                "action", "profile_updated",
                                "userId", updated.getUser().getId().toString(),
                                "employeeId", updated.getId().toString(),
                                "profileImageUrl",
                                updated.getProfileImageUrl() != null ? updated.getProfileImageUrl() : "",
                                "timestamp", System.currentTimeMillis());

                        // Broadcast to the user who updated
                        messagingTemplate.convertAndSendToUser(
                                updated.getUser().getId().toString(),
                                "/queue/profile-update",
                                updateEvent);

                        // Broadcast to ALL online users (for team views, chat, etc.)
                        messagingTemplate.convertAndSend(
                                "/topic/profile-updates",
                                updateEvent);

                    }
                } catch (Exception e) {
                    log.error("Failed to broadcast profile update: {}", e.getMessage());
                }
            }
        });

        return modelMapper.map(updated, EmployeeDTO.class);
    }

    /**
     * Permanently deletes an employee profile by its ID.
     *
     * @param id UUID of the employee to delete
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    public void deleteEmployee(UUID id) {
        if (!employeeRepository.existsById(id)) {
            throw new ResourceNotFoundException("Employee not found");
        }

        employeeRepository.deleteById(id);
    }
}
