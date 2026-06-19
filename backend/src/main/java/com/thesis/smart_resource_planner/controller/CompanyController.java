package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.CompanyDTO;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.CompanyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

import com.thesis.smart_resource_planner.service.BrevoEmailService;
import java.util.Map;

/**
 * Controller for handling company-related operations.
 * Allows users to fetch their own company, manage all companies, and regenerate
 * join codes.
 */
@RestController
@RequestMapping("/api/companies")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class CompanyController {

    private final CompanyService companyService;
    private final BrevoEmailService brevoEmailService;

    /**
     * Retrieves the company associated with the current user.
     *
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity containing the company details.
     */
    @GetMapping("/my-company")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<CompanyDTO> getMyCompany(@AuthenticationPrincipal UserPrincipal currentUser) {
        // Fetch specific company by user ID map logic
        CompanyDTO company = companyService.getCompanyById(currentUser.getId());
        return ResponseEntity.ok(company);
    }

    /**
     * Retrieves all companies in the system. Required for super admin level.
     *
     * @return ResponseEntity with the list of all companies.
     */
    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<CompanyDTO>> getAllCompanies() {
        // Retrieve large list of companies
        List<CompanyDTO> companies = companyService.getAllCompanies();
        return ResponseEntity.ok(companies);
    }

    /**
     * Regenerates the join code for a specific company to restrict/refresh access.
     *
     * @param companyId   The ID of the company to update.
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity containing the new configuration code.
     */
    @PostMapping("/{companyId}/regenerate-code")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> regenerateJoinCode(
            @PathVariable UUID companyId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        // Handle join code generation process
        String newCode = companyService.regenerateJoinCode(companyId);
        try {
            CompanyDTO company = companyService.getCompanyById(currentUser.getId());
            brevoEmailService.sendJoinCodeRegeneratedEmail(
                currentUser.getEmail(),
                currentUser.getUsername(),
                company.getName(),
                newCode
            );
        } catch (Exception e) {
            log.error("Failed to send join code regenerated email to admin", e);
        }
        return ResponseEntity.ok(newCode);
    }

    @PostMapping("/email-join-code")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> emailJoinCode(
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        String toEmail = payload.get("email");
        if (toEmail == null || toEmail.isEmpty()) {
            return ResponseEntity.badRequest().body("Email is required");
        }
        
        CompanyDTO company = companyService.getCompanyById(currentUser.getId());
        brevoEmailService.sendCompanyJoinCode(toEmail, currentUser.getUsername(), company.getName(), company.getJoinCode());
        
        return ResponseEntity.ok("Join code sent successfully");
    }
}