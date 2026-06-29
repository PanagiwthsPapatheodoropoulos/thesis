package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.CompanyBlocklistRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
@Slf4j
public class PublicController {

    private final UserRepository userRepository;
    private final CompanyBlocklistRepository blocklistRepository;

    @GetMapping("/approval-status")
    public ResponseEntity<Map<String, Object>> getApprovalStatus(
            @RequestParam("identifier") String identifier) {
        String trimmed = identifier == null ? "" : identifier.trim();
        if (trimmed.isEmpty()) {
            return ResponseEntity.ok(Map.of("status", "NOT_FOUND"));
        }

        Optional<User> userOpt = userRepository.findByUsernameOrEmail(trimmed, trimmed);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            String status = "APPROVED";
            String companyName = user.getCompany() != null ? user.getCompany().getName() : null;
            return ResponseEntity.ok(Map.of(
                    "status", status,
                    "companyName", companyName));
        }

        if (trimmed.contains("@") && blocklistRepository.existsByEmailIgnoreCase(trimmed)) {
            return ResponseEntity.ok(Map.of("status", "BLOCKED"));
        }

        return ResponseEntity.ok(Map.of("status", "NOT_FOUND"));
    }
}
