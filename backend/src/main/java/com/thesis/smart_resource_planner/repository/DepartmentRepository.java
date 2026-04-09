package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for managing {@link Department} entities in the database.
 * Provides operations to list, search, and validate departments within a
 * company.
 */
@Repository
public interface DepartmentRepository extends JpaRepository<Department, UUID> {

    List<Department> findByCompanyId(UUID companyId);

    Optional<Department> findByNameAndCompanyId(String name, UUID companyId);

    boolean existsByNameAndCompanyId(String name, UUID companyId);
}