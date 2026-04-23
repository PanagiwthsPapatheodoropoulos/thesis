package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Service providing cross-company administrative read/write capabilities for
 * super-admins.
 *
 * <p>
 * Offers company, user, employee, department, team, and task management
 * operations that span multiple companies, as well as system-wide and
 * per-company statistics.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class SuperAdminService {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final TeamRepository teamRepository;
    private final TaskRepository taskRepository;
    private final ModelMapper modelMapper;
    private final EmployeeSkillRepository employeeSkillRepository;

    // ============================================================
    // COMPANY OPERATIONS
    // ============================================================

    /**
     * Returns all companies in the system with employee, department, and team
     * counts.
     *
     * @return list of {@link CompanyDTO} objects
     */
    @Transactional(readOnly = true)
    public List<CompanyDTO> getAllCompanies() {
        return companyRepository.findAll().stream()
                .map(company -> {
                    CompanyDTO dto = modelMapper.map(company, CompanyDTO.class);

                    // Populate statistics (using dashboard-specific queries that exclude
                    // ADMIN/MANAGER)
                    dto.setEmployeeCount(
                            (int) employeeRepository.countEmployeesByCompanyIdForDashboard(company.getId()));
                    dto.setDepartmentCount(departmentRepository.findByCompanyId(company.getId()).size());
                    dto.setTeamCount(teamRepository.findByCompanyId(company.getId()).size());

                    return dto;
                })
                .toList();
    }

    /**
     * Retrieves a single company by ID with aggregated statistics.
     *
     * @param companyId UUID of the company
     * @return the matching {@link CompanyDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    @Transactional(readOnly = true)
    public CompanyDTO getCompanyById(UUID companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));

        CompanyDTO dto = modelMapper.map(company, CompanyDTO.class);
        dto.setEmployeeCount((int) employeeRepository.countEmployeesByCompanyIdForDashboard(companyId));
        dto.setDepartmentCount(departmentRepository.findByCompanyId(companyId).size());
        dto.setTeamCount(teamRepository.findByCompanyId(companyId).size());

        return dto;
    }

    /**
     * Toggles the active/inactive status of a company.
     *
     * @param companyId UUID of the company
     * @return the updated {@link CompanyDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    public CompanyDTO toggleCompanyActive(UUID companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));

        company.setIsActive(!company.getIsActive());
        Company updated = companyRepository.save(company);

        return modelMapper.map(updated, CompanyDTO.class);
    }

    // USER OPERATIONS
    /**
     * Returns all users belonging to a specific company.
     *
     * @param companyId UUID of the company
     * @return list of {@link UserDTO} objects
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               company
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<UserDTO> getUsersByCompany(UUID companyId) {
        if (!companyRepository.existsById(companyId)) {
            throw new ResourceNotFoundException("Company not found");
        }

        return userRepository.findByCompanyId(companyId).stream()
                .map(user -> modelMapper.map(user, UserDTO.class))
                .toList();
    }

    // TASK OPERATIONS
    /**
     * Returns all tasks belonging to a specific company.
     *
     * @param companyId UUID of the company
     * @return list of {@link TaskDTO} objects
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               company
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<TaskDTO> getTasksByCompany(UUID companyId) {
        if (!companyRepository.existsById(companyId)) {
            throw new ResourceNotFoundException("Company not found");
        }

        List<Task> tasks = taskRepository.findByCompanyId(companyId);
        return tasks.stream()
                .map(this::mapTaskToDTO)
                .toList();
    }

    /**
     * Manual mapping to avoid ModelMapper circular reference issues
     */
    private TaskDTO mapTaskToDTO(Task task) {
        TaskDTO dto = new TaskDTO();

        try {
            // Basic fields
            dto.setId(task.getId());
            dto.setTitle(task.getTitle());
            dto.setDescription(task.getDescription());
            dto.setStatus(task.getStatus());
            dto.setPriority(task.getPriority());
            dto.setDueDate(task.getDueDate());
            dto.setStartDate(task.getStartDate());
            dto.setCompletedDate(task.getCompletedDate());
            dto.setEstimatedHours(task.getEstimatedHours());
            dto.setActualHours(task.getActualHours());
            dto.setComplexityScore(task.getComplexityScore());
            dto.setCreatedAt(task.getCreatedAt());
            dto.setUpdatedAt(task.getUpdatedAt());
            dto.setIsArchived(task.getIsArchived() != null ? task.getIsArchived() : false);
            dto.setIsEmployeeRequest(task.getIsEmployeeRequest() != null ? task.getIsEmployeeRequest() : false);
            dto.setRequiresApproval(task.getRequiresApproval() != null ? task.getRequiresApproval() : false);
            dto.setAssignedEmployeeId(task.getAssignedEmployeeId());

            // Team info (safely handle null)
            if (task.getTeam() != null) {
                dto.setTeamId(task.getTeam().getId());
                dto.setTeamName(task.getTeam().getName());
            }

            // Creator info (safely handle null)
            if (task.getCreatedBy() != null) {
                dto.setCreatedBy(task.getCreatedBy().getId());
                dto.setCreatedByName(task.getCreatedBy().getUsername());
            }

            // Skills mapping - get skill IDs from TaskRequiredSkill
            if (task.getRequiredSkills() != null && !task.getRequiredSkills().isEmpty()) {
                List<UUID> skillIds = task.getRequiredSkills().stream()
                        .map(taskRequiredSkill -> taskRequiredSkill.getSkill().getId())
                        .toList();
                dto.setRequiredSkillIds(skillIds);
            } else {
                dto.setRequiredSkillIds(new ArrayList<>());
            }

            // Assignments mapping (basic info only to avoid circular references)
            if (task.getAssignments() != null && !task.getAssignments().isEmpty()) {
                List<TaskAssignmentDTO> assignmentDTOs = task.getAssignments().stream()
                        .map(assignment -> {
                            TaskAssignmentDTO assignmentDTO = new TaskAssignmentDTO();
                            assignmentDTO.setId(assignment.getId());
                            assignmentDTO.setTaskId(task.getId());
                            assignmentDTO.setTaskTitle(task.getTitle());
                            assignmentDTO.setEmployeeId(assignment.getEmployee().getId());
                            assignmentDTO.setEmployeeName(
                                    assignment.getEmployee().getFirstName() + " " +
                                            assignment.getEmployee().getLastName());
                            assignmentDTO.setAssignedBy(assignment.getAssignedBy());
                            assignmentDTO.setStatus(assignment.getStatus());
                            assignmentDTO.setFitScore(assignment.getFitScore());
                            assignmentDTO.setConfidenceScore(assignment.getConfidenceScore());
                            assignmentDTO.setAssignedDate(assignment.getAssignedDate());
                            assignmentDTO.setNotes(assignment.getNotes());
                            return assignmentDTO;
                        })
                        .toList();
                dto.setAssignments(assignmentDTOs);
            } else {
                dto.setAssignments(new ArrayList<>());
            }

        } catch (Exception e) {
            log.error("Error mapping task {}: {}", task.getId(), e.getMessage(), e);
            // Return partially filled DTO rather than failing completely
        }

        return dto;
    }

    // ============================================================
    // EMPLOYEE OPERATIONS
    // Note: Uses dashboard-specific queries that only display
    // employees with EMPLOYEE role (excludes ADMIN and MANAGER)
    // ============================================================

    /**
     * Returns all employees of a specific company, excluding admin and manager
     * accounts,
     * with skills eagerly loaded to avoid N+1 queries.
     *
     * @param companyId UUID of the company
     * @return list of {@link EmployeeDTO} objects with skills populated
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               company
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<EmployeeDTO> getEmployeesByCompany(UUID companyId) {
        if (!companyRepository.existsById(companyId)) {
            throw new ResourceNotFoundException("Company not found");
        }

        // Use eager loading
        List<Employee> employees = employeeRepository.findEmployeesByCompanyIdForDashboard(companyId);

        // Batch fetch all skills
        Map<UUID, List<EmployeeSkillDTO>> skillsMap = new HashMap<>();
        if (!employees.isEmpty()) {
            List<UUID> employeeIds = employees.stream()
                    .map(Employee::getId)
                    .toList();

            List<EmployeeSkill> allSkills = employeeSkillRepository.findByEmployeeIdIn(employeeIds);

            allSkills.forEach(empSkill -> {
                if (empSkill != null && empSkill.getSkill() != null) {
                    EmployeeSkillDTO skillDTO = new EmployeeSkillDTO();
                    skillDTO.setId(empSkill.getId());
                    skillDTO.setSkillId(empSkill.getSkill().getId());
                    skillDTO.setSkillName(empSkill.getSkill().getName());
                    skillDTO.setSkillCategory(empSkill.getSkill().getCategory());
                    skillDTO.setProficiencyLevel(empSkill.getProficiencyLevel());
                    skillDTO.setYearsOfExperience(empSkill.getYearsOfExperience());
                    skillDTO.setLastUsed(empSkill.getLastUsed());

                    skillsMap.computeIfAbsent(empSkill.getEmployee().getId(), k -> new ArrayList<>())
                            .add(skillDTO);
                }
            });
        }

        return employees.stream()
                .map(employee -> {
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
                    dto.setSkills(skillsMap.getOrDefault(employee.getId(), List.of()));
                    return dto;
                })
                .toList();
    }

    // ============================================================
    // DEPARTMENT OPERATIONS
    // ============================================================

    /**
     * Returns all departments of a specific company with employee counts.
     *
     * @param companyId UUID of the company
     * @return list of {@link DepartmentDTO} objects
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               company
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<DepartmentDTO> getDepartmentsByCompany(UUID companyId) {
        if (!companyRepository.existsById(companyId)) {
            throw new ResourceNotFoundException("Company not found");
        }

        List<Department> departments = departmentRepository.findByCompanyId(companyId);

        return departments.stream()
                .map(dept -> {
                    DepartmentDTO dto = new DepartmentDTO();
                    dto.setName(dept.getName());
                    dto.setDescription(dept.getDescription());

                    // Count employees in this department using the dashboard-specific method
                    long employeeCount = employeeRepository.countEmployeesByDepartmentAndCompanyIdForDashboard(
                            dept.getName(), companyId);
                    dto.setEmployeeCount((int) employeeCount);

                    return dto;
                })
                .toList();
    }

    // ============================================================
    // TEAM OPERATIONS
    // ============================================================

    /**
     * Returns all teams of a specific company with member counts.
     *
     * @param companyId UUID of the company
     * @return list of {@link TeamDTO} objects
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               company
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<TeamDTO> getTeamsByCompany(UUID companyId) {
        if (!companyRepository.existsById(companyId)) {
            throw new ResourceNotFoundException("Company not found");
        }

        List<Team> teams = teamRepository.findByCompanyId(companyId);

        return teams.stream()
                .map(team -> {
                    TeamDTO dto = modelMapper.map(team, TeamDTO.class);

                    // Count team members
                    long memberCount = userRepository.countByTeamId(team.getId());
                    dto.setMemberCount((int) memberCount);

                    return dto;
                })
                .toList();
    }

    // STATISTICS & ANALYTICS
    /**
     * Returns aggregated system-wide statistics across all companies.
     *
     * @return map containing totalCompanies, activeCompanies, totalUsers,
     *         totalEmployees, totalTasks, totalDepartments, and totalTeams
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getSystemStatistics() {
        Map<String, Object> stats = new HashMap<>();

        List<Company> allCompanies = companyRepository.findAll();

        stats.put("totalCompanies", allCompanies.size());
        stats.put("activeCompanies", allCompanies.stream().filter(Company::getIsActive).count());
        stats.put("inactiveCompanies", allCompanies.stream().filter(c -> !c.getIsActive()).count());

        int totalUsers = 0;
        int totalEmployees = 0;
        int totalTasks = 0;
        int totalDepartments = 0;
        int totalTeams = 0;

        for (Company company : allCompanies) {
            totalUsers += userRepository.countByCompanyId(company.getId());
            totalEmployees += employeeRepository.countEmployeesByCompanyIdForDashboard(company.getId());
            totalTasks += taskRepository.findByCompanyId(company.getId()).size();
            totalDepartments += departmentRepository.findByCompanyId(company.getId()).size();
            totalTeams += teamRepository.findByCompanyId(company.getId()).size();
        }

        stats.put("totalUsers", totalUsers);
        stats.put("totalEmployees", totalEmployees);
        stats.put("totalTasks", totalTasks);
        stats.put("totalDepartments", totalDepartments);
        stats.put("totalTeams", totalTeams);

        return stats;
    }

    /**
     * Returns key statistics for a single company.
     *
     * @param companyId UUID of the company
     * @return map containing userCount, employeeCount, taskCount, departmentCount,
     *         and teamCount
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               company
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getCompanyStatistics(UUID companyId) {
        if (!companyRepository.existsById(companyId)) {
            throw new ResourceNotFoundException("Company not found");
        }

        Map<String, Object> stats = new HashMap<>();

        stats.put("userCount", userRepository.countByCompanyId(companyId));
        stats.put("employeeCount", employeeRepository.countEmployeesByCompanyIdForDashboard(companyId));
        stats.put("taskCount", taskRepository.findByCompanyId(companyId).size());
        stats.put("departmentCount", departmentRepository.findByCompanyId(companyId).size());
        stats.put("teamCount", teamRepository.findByCompanyId(companyId).size());

        return stats;
    }
}