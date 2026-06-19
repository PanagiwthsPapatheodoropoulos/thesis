package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.exception.BadRequestException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.CompanyBlocklistCreateDTO;
import com.thesis.smart_resource_planner.model.dto.CompanyBlocklistEntryDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.CompanyBlocklistEntry;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.CompanyBlocklistRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for managing the per-company email blocklist.
 * Blocked emails cannot register with that company's join code.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class CompanyBlocklistService {

    private final CompanyBlocklistRepository blocklistRepository;
    private final UserRepository userRepository;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Checks whether the given email is blocked from the specified company.
     *
     * @param companyId target company UUID
     * @param email     the email to check (case-insensitive)
     * @return true if blocked
     */
    @Transactional(readOnly = true)
    public boolean isBlocked(UUID companyId, String email) {
        if (email == null || companyId == null) return false;
        return blocklistRepository.existsByCompanyIdAndEmailIgnoreCase(companyId, email.trim());
    }

    /**
     * Returns all blocklist entries for the requesting user's company.
     *
     * @param requestingUserId UUID of the admin/manager
     * @return list of {@link CompanyBlocklistEntryDTO}
     */
    @Transactional(readOnly = true)
    public List<CompanyBlocklistEntryDTO> getBlocklist(UUID requestingUserId) {
        Company company = resolveCompany(requestingUserId);
        return blocklistRepository.findByCompanyIdOrderByCreatedAtDesc(company.getId())
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Adds an email to the blocklist for the requesting user's company.
     *
     * @param requestingUserId UUID of the admin/manager
     * @param createDTO        DTO containing the email to block
     * @return the created {@link CompanyBlocklistEntryDTO}
     */
    public CompanyBlocklistEntryDTO blockEmail(UUID requestingUserId, CompanyBlocklistCreateDTO createDTO) {
        Company company = resolveCompany(requestingUserId);
        String normalised = createDTO.getEmail().trim().toLowerCase();

        if (blocklistRepository.existsByCompanyIdAndEmailIgnoreCase(company.getId(), normalised)) {
            throw new BadRequestException("Email is already blocked: " + normalised);
        }

        CompanyBlocklistEntry entry = CompanyBlocklistEntry.builder()
                .company(company)
                .email(normalised)
                .build();

        CompanyBlocklistEntry saved = blocklistRepository.save(entry);
        log.info("Blocked email '{}' from company '{}'", normalised, company.getName());
        return toDTO(saved);
    }

    /**
     * Removes a blocklist entry, ensuring it belongs to the requesting user's company.
     *
     * @param requestingUserId UUID of the admin/manager
     * @param entryId          UUID of the blocklist entry to remove
     */
    public void unblock(UUID requestingUserId, UUID entryId) {
        Company company = resolveCompany(requestingUserId);

        CompanyBlocklistEntry entry = blocklistRepository.findById(entryId)
                .orElseThrow(() -> new ResourceNotFoundException("Blocklist entry not found"));

        if (!entry.getCompany().getId().equals(company.getId())) {
            throw new BadRequestException("Entry does not belong to your company");
        }

        blocklistRepository.delete(entry);
        log.info("Unblocked entry '{}' (email='{}') from company '{}'", entryId, entry.getEmail(), company.getName());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Company resolveCompany(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Company company = user.getCompany();
        if (company == null) throw new BadRequestException("User has no company assigned");
        return company;
    }

    private CompanyBlocklistEntryDTO toDTO(CompanyBlocklistEntry entry) {
        return CompanyBlocklistEntryDTO.builder()
                .id(entry.getId())
                .email(entry.getEmail())
                .createdAt(entry.getCreatedAt())
                .build();
    }
}
