package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.CompanyBlocklistEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CompanyBlocklistRepository extends JpaRepository<CompanyBlocklistEntry, UUID> {
    boolean existsByCompanyIdAndEmailIgnoreCase(UUID companyId, String email);

    boolean existsByEmailIgnoreCase(String email);

    Optional<CompanyBlocklistEntry> findByCompanyIdAndEmailIgnoreCase(UUID companyId, String email);

    List<CompanyBlocklistEntry> findByCompanyIdOrderByCreatedAtDesc(UUID companyId);
}
