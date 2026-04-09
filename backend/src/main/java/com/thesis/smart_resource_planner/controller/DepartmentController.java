package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.DepartmentCreateDTO;
import com.thesis.smart_resource_planner.model.dto.DepartmentDTO;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.DepartmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller for managing departments.
 * Provides endpoints for creating, retrieving, and deleting department records.
 */
@RestController
@RequestMapping("/api/departments")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class DepartmentController {

    private final DepartmentService departmentService;
    private final EmployeeRepository employeeRepository;

    /**
     * Creates a new department.
     *
     * @param createDTO   Data for the new department.
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with the created department details.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<DepartmentDTO> createDepartment(
            @Valid @RequestBody DepartmentCreateDTO createDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        DepartmentDTO created = departmentService.createDepartment(createDTO, currentUser.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Retrieves all departments or limits to user's assigned department if employee
     * role.
     *
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with the list of departments.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<DepartmentDTO>> getAllDepartments(
            @AuthenticationPrincipal UserPrincipal currentUser) {

        // Check if user is an employee to limit visibility
        if (currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_EMPLOYEE"))) {

            Employee emp = employeeRepository.findByUserId(currentUser.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Employee profile not found"));

            if (emp.getDepartment() != null) {
                DepartmentDTO dept = departmentService.getDepartmentByName(emp.getDepartment(), currentUser.getId());
                return ResponseEntity.ok(List.of(dept));
            }
            return ResponseEntity.ok(List.of());
        }

        List<DepartmentDTO> departments = departmentService.getAllDepartments(currentUser.getId());
        return ResponseEntity.ok(departments);
    }

    /**
     * Retrieves a department by its name.
     *
     * @param name        The name of the department.
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with the department details.
     */
    @GetMapping("/{name}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<DepartmentDTO> getDepartmentByName(
            @PathVariable String name,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        DepartmentDTO department = departmentService.getDepartmentByName(name, currentUser.getId());
        return ResponseEntity.ok(department);
    }

    /**
     * Retrieves a list of all department names.
     *
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with a list of department names.
     */
    @GetMapping("/list")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<String>> getDepartmentNames(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<String> departmentNames = departmentService.getDepartmentNames(currentUser.getId());
        return ResponseEntity.ok(departmentNames);
    }

    /**
     * Deletes a department by its name.
     *
     * @param name        The name of the department to delete.
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity indicating a successful deletion.
     */
    @DeleteMapping("/{name}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> deleteDepartment(
            @PathVariable String name,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        // Execute deletion
        departmentService.deleteDepartment(name, currentUser.getId());
        return ResponseEntity.noContent().build();
    }
}