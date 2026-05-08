package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.CompanyBlocklistCreateDTO;
import com.thesis.smart_resource_planner.model.dto.CompanyBlocklistEntryDTO;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.CompanyBlocklistService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/blocklist")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class CompanyBlocklistController {

    private final CompanyBlocklistService blocklistService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<CompanyBlocklistEntryDTO>> getBlocklist(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<CompanyBlocklistEntryDTO> entries = blocklistService.getBlocklist(currentUser.getId());
        return ResponseEntity.ok(entries);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<CompanyBlocklistEntryDTO> blockEmail(
            @Valid @RequestBody CompanyBlocklistCreateDTO createDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        CompanyBlocklistEntryDTO created = blocklistService.blockEmail(currentUser.getId(), createDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> unblock(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        blocklistService.unblock(currentUser.getId(), id);
        return ResponseEntity.noContent().build();
    }
}
