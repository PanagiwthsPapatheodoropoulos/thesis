package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository for managing {@link Company} entities in the database.
 * Provides basic queries for company lookup and validation by join code and
 * name.
 */
@Repository
public interface CompanyRepository extends JpaRepository<Company, UUID> {

    Optional<Company> findByJoinCode(String joinCode);

    boolean existsByJoinCode(String joinCode);

    boolean existsByName(String name);
}