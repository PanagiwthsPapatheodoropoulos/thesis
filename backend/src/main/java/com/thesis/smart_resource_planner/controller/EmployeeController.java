package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.EmployeeSkill;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.repository.EmployeeSkillRepository;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.EmployeeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Controller for managing employee records, skills, and availability.
 * Provides endpoints for pagination, workload tracking, and skill assignments.
 */
@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class EmployeeController {

    private final EmployeeService employeeService;
    private final EmployeeRepository employeeRepository;
    private final EmployeeSkillRepository employeeSkillRepository;

    /**
     * Creates a new employee record.
     *
     * @param createDTO Data containing the new employee details.
     * @return ResponseEntity with the created employee object.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<EmployeeDTO> createEmployee(@Valid @RequestBody EmployeeCreateDTO createDTO) {
        EmployeeDTO employee = employeeService.createEmployee(createDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(employee);
    }

    /**
     * Maps standard camelCase property names to database column names for sorting.
     *
     * @param propertyName The DTO property name.
     * @return The corresponding snake_case database column.
     */
    private String mapPropertyToColumn(String propertyName) {
        return switch (propertyName) {
            case "firstName" -> "first_name";
            case "lastName" -> "last_name";
            case "hireDate" -> "hire_date";
            case "hourlyRate" -> "hourly_rate";
            case "maxWeeklyHours" -> "max_weekly_hours";
            case "userId" -> "user_id";
            case "profileImageUrl" -> "profile_image_url";
            case "createdAt" -> "created_at";
            case "updatedAt" -> "updated_at";
            // For fields that match exactly (no camelCase), return as-is
            default -> propertyName;
        };
    }

    /**
     * Retrieves a paginated list of employees with optional filtering and sorting.
     *
     * @param currentUser The currently authenticated user.
     * @param page        The page number to fetch.
     * @param size        Number of records per page.
     * @param sortBy      Property to sort results by.
     * @param sortDir     Direction of the sort.
     * @param department  Optional department filter.
     * @param position    Optional position filter.
     * @param search      Optional search query for names or details.
     * @return ResponseEntity with paginated employee records.
     */
    @GetMapping("/paginated")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Page<EmployeeDTO>> getEmployeesPaginated(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "firstName") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String position,
            @RequestParam(required = false) String search) {

        Sort.Direction direction = sortDir.equalsIgnoreCase("desc")
                ? Sort.Direction.DESC
                : Sort.Direction.ASC;

        // MAP Java property names to database column names
        String dbColumnName = mapPropertyToColumn(sortBy);
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, dbColumnName));

        // Convert "ALL" to null for backend
        String deptFilter = (department == null || department.equals("ALL")) ? null : department;
        String posFilter = (position == null || position.equals("ALL")) ? null : position;
        String searchFilter = (search == null || search.trim().isEmpty()) ? null : search.trim();

        // Retrieve paginated list
        Page<EmployeeDTO> employees = employeeService.getEmployeesPaginated(
                currentUser.getId(),
                pageable,
                deptFilter,
                posFilter,
                searchFilter);

        return ResponseEntity.ok(employees);
    }

    /**
     * Retrieves the current workload statistics for all accessible employees.
     *
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity containing workload statistics.
     */
    @GetMapping("/workload")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<EmployeeWorkloadDTO>> getEmployeeWorkload(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<EmployeeWorkloadDTO> workload = employeeService.getEmployeeWorkload(currentUser.getId());
        return ResponseEntity.ok(workload);
    }

    /**
     * Retrieves employee profile details by user ID.
     *
     * @param userId The ID of the authenticated user entity.
     * @return ResponseEntity containing the mapped employee profile.
     */
    @GetMapping("/user/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<EmployeeDTO> getEmployeeByUserId(@PathVariable UUID userId) {
        EmployeeDTO employee = employeeService.getEmployeeByUserId(userId);
        return ResponseEntity.ok(employee);
    }

    /**
     * Retrieves employees filtered by a specific department.
     *
     * @param department  The department name.
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with a list of matching employees.
     */
    @GetMapping("/department/{department}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<EmployeeDTO>> getEmployeesByDepartment(
            @PathVariable String department,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<EmployeeDTO> employees = employeeService.getEmployeesByDepartment(department, currentUser.getId());
        return ResponseEntity.ok(employees);
    }

    /**
     * Retrieves employees possessing a specific skill, with an optional minimum
     * proficiency.
     *
     * @param skillId        The ID of the required skill.
     * @param minProficiency The minimum proficiency level desired.
     * @return ResponseEntity containing the matching employees.
     */
    @GetMapping("/skill/{skillId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<EmployeeDTO>> getEmployeesBySkill(
            @PathVariable UUID skillId,
            @RequestParam(required = false) Integer minProficiency) {
        List<EmployeeDTO> employees = employeeService.getEmployeesBySkill(skillId, minProficiency);
        return ResponseEntity.ok(employees);
    }

    /**
     * Retrieves a specific employee detail using their employee ID.
     *
     * @param id The ID of the employee.
     * @return ResponseEntity with the employee representation.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<EmployeeDTO> getEmployeeById(@PathVariable UUID id) {
        EmployeeDTO employee = employeeService.getEmployeeById(id);
        return ResponseEntity.ok(employee);
    }

    /**
     * Retrieves a list of all employees in the system accessible by the current
     * user.
     *
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with all accessible employees.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<EmployeeDTO>> getAllEmployees(@AuthenticationPrincipal UserPrincipal currentUser) {
        List<EmployeeDTO> employees = employeeService.getAllEmployees(currentUser.getId());
        return ResponseEntity.ok(employees);
    }

    /**
     * Updates an existing employee document.
     * Enforces security so an employee only updates their own profile if not an
     * admin.
     *
     * @param id          The employee ID.
     * @param updateDTO   Document holding updated values.
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity containing the updated employee document.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<EmployeeDTO> updateEmployee(
            @PathVariable UUID id,
            @Valid @RequestBody EmployeeCreateDTO updateDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        // Establish access rights
        boolean isOwnProfile = employee.getUser().getId().equals(currentUser.getId());
        boolean isAdminOrManager = currentUser.getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_ADMIN") ||
                        auth.getAuthority().equals("ROLE_MANAGER"));

        if (!isOwnProfile && !isAdminOrManager) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        EmployeeDTO updated = employeeService.updateEmployee(id, updateDTO);
        return ResponseEntity.ok(updated);
    }

    /**
     * Deletes an employee's record completely. Admin only.
     *
     * @param id The ID of the employee to delete.
     * @return ResponseEntity indicating success.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteEmployee(@PathVariable UUID id) {
        employeeService.deleteEmployee(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Adds a new skill assignment with proficiency to an existing employee.
     *
     * @param id          The employee ID.
     * @param skillDTO    The DTO containing the skill relation data.
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity reflecting the created resource.
     */
    @PostMapping("/{id}/skills")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<EmployeeSkillDTO> addSkillToEmployee(
            @PathVariable UUID id,
            @Valid @RequestBody EmployeeSkillDTO skillDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        boolean isOwnProfile = employee.getUser().getId().equals(currentUser.getId());
        boolean isAdminOrManager = currentUser.getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_ADMIN") ||
                        auth.getAuthority().equals("ROLE_MANAGER"));

        if (!isOwnProfile && !isAdminOrManager) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        // Add matching skill
        EmployeeSkillDTO added = employeeService.addSkillToEmployee(id, skillDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(added);
    }

    /**
     * Retrieves skills connected to a specific employee in simple or detailed map
     * formats.
     *
     * @param id     The employee ID.
     * @param format Display format parameter ('simple' or 'detailed').
     * @return ResponseEntity encompassing the skills data in the requested
     *         presentation mode.
     */
    @GetMapping("/{id}/skills")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<?> getEmployeeSkills(
            @PathVariable UUID id,
            @RequestParam(required = false, defaultValue = "simple") String format) {
        if (!employeeRepository.existsById(id)) {
            throw new ResourceNotFoundException("Employee not found with ID: " + id);
        }

        List<EmployeeSkill> skills = employeeSkillRepository.findByEmployeeId(id);

        if (skills.isEmpty()) {
            if ("detailed".equals(format)) {
                return ResponseEntity.ok(Map.of(
                        "skills", List.of(),
                        "skillsById", Map.of(),
                        "skillsByName", Map.of()));
            }
            return ResponseEntity.ok(List.of());
        }

        List<EmployeeSkillDTO> skillDTOs = skills.stream()
                .map(skill -> {
                    EmployeeSkillDTO dto = new EmployeeSkillDTO();
                    dto.setId(skill.getId());

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

        // Process requested format mode
        if ("detailed".equals(format)) {
            Map<String, Integer> skillsById = skillDTOs.stream()
                    .filter(s -> s.getSkillId() != null)
                    .collect(Collectors.toMap(
                            s -> s.getSkillId().toString(),
                            EmployeeSkillDTO::getProficiencyLevel,
                            (existing, replacement) -> existing));

            Map<String, Integer> skillsByName = skillDTOs.stream()
                    .filter(s -> s.getSkillName() != null)
                    .collect(Collectors.toMap(
                            EmployeeSkillDTO::getSkillName,
                            EmployeeSkillDTO::getProficiencyLevel,
                            (existing, replacement) -> existing));

            return ResponseEntity.ok(Map.of(
                    "skills", skillDTOs,
                    "skillsById", skillsById,
                    "skillsByName", skillsByName));
        }
        return ResponseEntity.ok(skillDTOs);
    }

    /**
     * Supports fetching mapped skills concurrently for multiple employees.
     * Ensures employees belong to user's company before evaluating.
     *
     * @param employeeIds The string IDs for employees.
     * @param format      Data response template requested.
     * @param currentUser Logged-in principal providing company boundaries.
     * @return ResponseEntity with mapping of employee ID to proficiency hashes.
     */
    @GetMapping("/skills/batch")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Map<String, Map<String, Integer>>> getEmployeeSkillsBatch(
            @RequestParam List<String> employeeIds,
            @RequestParam(defaultValue = "simple") String format,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        try {
            UUID companyId = currentUser.getCompanyId();
            Map<String, Map<String, Integer>> result = new HashMap<>();
            boolean returnSkillIds = "id".equalsIgnoreCase(format) || "ids".equalsIgnoreCase(format);

            log.info("Batch fetching skills for {} employees using format '{}'", employeeIds.size(), format);

            // Convert string IDs to UUIDs
            List<UUID> employeeUUIDs = employeeIds.stream()
                    .map(UUID::fromString)
                    .toList();

            // Use repository method
            List<EmployeeSkill> allSkills = employeeSkillRepository
                    .findByEmployeeIdIn(employeeUUIDs);

            log.info("Found {} total skills across {} employees", allSkills.size(), employeeIds.size());

            // Group skills by employee
            Map<UUID, List<EmployeeSkill>> skillsByEmployee = allSkills.stream()
                    .collect(Collectors.groupingBy(skill -> skill.getEmployee().getId()));

            // Build response map
            for (String empIdStr : employeeIds) {
                try {
                    UUID empId = UUID.fromString(empIdStr);

                    // Security check: verify employee belongs to this company
                    Employee employee = employeeRepository.findById(empId).orElse(null);

                    if (employee == null) {
                        log.warn("Employee {} not found", empId);
                        result.put(empIdStr, new HashMap<>()); // Empty map for missing employee
                        continue;
                    }

                    if (!employee.getUser().getCompany().getId().equals(companyId)) {
                        log.warn("Employee {} not in company {}", empId, companyId);
                        continue; // Skip - don't expose cross-company data
                    }

                    // Get this employee's skills
                    List<EmployeeSkill> employeeSkills = skillsByEmployee.getOrDefault(empId, List.of());

                        // Convert to {skillName: proficiency} or {skillId: proficiency} map.
                    Map<String, Integer> skillMap = employeeSkills.stream()
                            .filter(es -> es.getSkill() != null)
                            .collect(Collectors.toMap(
                                es -> returnSkillIds
                                    ? es.getSkill().getId().toString()
                                    : es.getSkill().getName(),
                                    EmployeeSkill::getProficiencyLevel,
                                    (existing, replacement) -> existing // Keep first if duplicate
                            ));

                    result.put(empIdStr, skillMap);

                } catch (IllegalArgumentException e) {
                    log.warn("Invalid employee ID format: {}", empIdStr);
                    result.put(empIdStr, new HashMap<>());
                }
            }

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("Error in batch skills fetch", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new HashMap<>());
        }
    }

    /**
     * Unassigns a skill from an existing employee profile.
     *
     * @param employeeId  Target employee ID.
     * @param skillId     Target relation to drop.
     * @param currentUser Acting user credential evaluating access permission.
     * @return ResponseEntity completing detachment.
     */
    @DeleteMapping("/{employeeId}/skills/{skillId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Void> removeSkillFromEmployee(
            @PathVariable UUID employeeId,
            @PathVariable UUID skillId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        boolean isOwnProfile = employee.getUser().getId().equals(currentUser.getId());
        boolean isAdminOrManager = currentUser.getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_ADMIN") ||
                        auth.getAuthority().equals("ROLE_MANAGER"));

        if (!isOwnProfile && !isAdminOrManager) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        employeeService.removeSkillFromEmployee(employeeId, skillId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Marks availability restrictions/blocks for a given employee.
     *
     * @param id              Core ID referring to the employee setting
     *                        availability.
     * @param availabilityDTO Structured start/end payload detailing duration rules.
     * @return ResponseEntity indicating successfully configured timeline span.
     */
    @PostMapping("/{id}/availability")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<EmployeeAvailabilityDTO> setEmployeeAvailability(
            @PathVariable UUID id,
            @Valid @RequestBody EmployeeAvailabilityDTO availabilityDTO) {
        availabilityDTO.setEmployeeId(id);
        EmployeeAvailabilityDTO availability = employeeService.setEmployeeAvailability(availabilityDTO);
        return ResponseEntity.ok(availability);
    }

    /**
     * Interrogates database for an employee's recorded unavailability spans
     * covering bounds.
     *
     * @param id        Target employee identifying UUID.
     * @param startDate Scan boundaries starting margin.
     * @param endDate   Scan boundaries concluding margin.
     * @return ResponseEntity returning series of recognized blocked limits.
     */
    @GetMapping("/{id}/availability")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<EmployeeAvailabilityDTO>> getEmployeeAvailability(
            @PathVariable UUID id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<EmployeeAvailabilityDTO> availability = employeeService.getEmployeeAvailability(id, startDate, endDate);
        return ResponseEntity.ok(availability);
    }
}