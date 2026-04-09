package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Super administrator controller handling global queries and operations.
 * Allows global system management spanning across all registered companies and
 * features.
 */
@RestController
@RequestMapping("/api/super-admin")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminController {

    private final CompanyService companyService;
    private final SuperAdminService superAdminService;

    // COMPANY OPERATIONS

    /**
     * Retrieves all companies in the platform.
     *
     * @return ResponseEntity with the list of all companies.
     */
    @GetMapping("/companies")
    public ResponseEntity<List<CompanyDTO>> getAllCompanies() {
        List<CompanyDTO> companies = superAdminService.getAllCompanies();
        return ResponseEntity.ok(companies);
    }

    /**
     * Retrieves specific details for a targeted company by its ID.
     *
     * @param companyId Target company UUID.
     * @return ResponseEntity revealing targeted business group's parameters.
     */
    @GetMapping("/companies/{companyId}")
    public ResponseEntity<CompanyDTO> getCompanyById(@PathVariable UUID companyId) {
        CompanyDTO company = superAdminService.getCompanyById(companyId);
        return ResponseEntity.ok(company);
    }

    /**
     * Initiates teardown erasing an entire business profile and its entities.
     *
     * @param companyId Organization root UUID to be destroyed.
     * @return Success status upon complete removal.
     */
    @DeleteMapping("/companies/{companyId}")
    public ResponseEntity<Void> deleteCompany(@PathVariable UUID companyId) {
        companyService.deleteCompany(companyId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Toggles the active/inactive state of a business profile, locking out users if
     * inactive.
     *
     * @param companyId The organization to toggle.
     * @return Updated organization status details.
     */
    @PatchMapping("/companies/{companyId}/toggle-active")
    public ResponseEntity<CompanyDTO> toggleCompanyActive(@PathVariable UUID companyId) {
        CompanyDTO company = superAdminService.toggleCompanyActive(companyId);
        return ResponseEntity.ok(company);
    }

    // USER OPERATIONS

    /**
     * Lists out users attached strictly under a targeted company.
     *
     * @param companyId The parent company filtering the lookup.
     * @return Result mapped response detailing matching user properties.
     */
    @GetMapping("/companies/{companyId}/users")
    public ResponseEntity<List<UserDTO>> getCompanyUsers(@PathVariable UUID companyId) {
        List<UserDTO> users = superAdminService.getUsersByCompany(companyId);
        return ResponseEntity.ok(users);
    }

    // TASK OPERATIONS

    /**
     * Fetches globally active/completed tasks managed internally across an
     * organization.
     *
     * @param companyId Target company grouping all activities.
     * @return Payload array bearing detailed internal operations.
     */
    @GetMapping("/companies/{companyId}/tasks")
    public ResponseEntity<List<TaskDTO>> getCompanyTasks(@PathVariable UUID companyId) {
        List<TaskDTO> tasks = superAdminService.getTasksByCompany(companyId);
        return ResponseEntity.ok(tasks);
    }

    // EMPLOYEE OPERATIONS

    /**
     * Evaluates employees working specifically within bounds of the parent company
     * specified.
     *
     * @param companyId UUID limiting scope to a singular corporation.
     * @return Data collection reflecting standard employee specifics.
     */
    @GetMapping("/companies/{companyId}/employees")
    public ResponseEntity<List<EmployeeDTO>> getCompanyEmployees(@PathVariable UUID companyId) {
        List<EmployeeDTO> employees = superAdminService.getEmployeesByCompany(companyId);
        return ResponseEntity.ok(employees);
    }

    // DEPARTMENT OPERATIONS

    /**
     * Retrieves the structural segmentations defined specifically for a company
     * constraint.
     *
     * @param companyId Identifies parent company.
     * @return Validated subsets categorizing organizational hierarchy.
     */
    @GetMapping("/companies/{companyId}/departments")
    public ResponseEntity<List<DepartmentDTO>> getCompanyDepartments(@PathVariable UUID companyId) {
        List<DepartmentDTO> departments = superAdminService.getDepartmentsByCompany(companyId);
        return ResponseEntity.ok(departments);
    }

    // TEAM OPERATIONS

    /**
     * Surveys structured workforce teams established internally per targeted firm.
     *
     * @param companyId Operating parent ID.
     * @return Configured subsets describing operational groups.
     */
    @GetMapping("/companies/{companyId}/teams")
    public ResponseEntity<List<TeamDTO>> getCompanyTeams(@PathVariable UUID companyId) {
        List<TeamDTO> teams = superAdminService.getTeamsByCompany(companyId);
        return ResponseEntity.ok(teams);
    }

    // STATISTICS & ANALYTICS

    /**
     * Computes holistic insights measuring all system resource allocations and
     * usage data.
     *
     * @return Arbitrary payload summarizing comprehensive top-level figures.
     */
    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Object>> getSystemStatistics() {
        Map<String, Object> stats = superAdminService.getSystemStatistics();
        return ResponseEntity.ok(stats);
    }

    /**
     * Formats contextual figures focusing exclusively at localized organization
     * metrics.
     *
     * @param companyId Operating organization identifier.
     * @return Local payload summarizing the designated subsidiary metrics.
     */
    @GetMapping("/companies/{companyId}/statistics")
    public ResponseEntity<Map<String, Object>> getCompanyStatistics(@PathVariable UUID companyId) {
        Map<String, Object> stats = superAdminService.getCompanyStatistics(companyId);
        return ResponseEntity.ok(stats);
    }
}