package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.EmployeeSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for managing {@link EmployeeSkill} entities.
 * Allows managing the mapping between employees and their specific skills and
 * proficiencies.
 */
@Repository
public interface EmployeeSkillRepository extends JpaRepository<EmployeeSkill, UUID> {
    List<EmployeeSkill> findByEmployeeId(UUID employeeId);

    Optional<EmployeeSkill> findByEmployeeIdAndSkillId(UUID employeeId, UUID skillId);

    void deleteByEmployeeId(UUID employeeId);

    @Query("SELECT es FROM EmployeeSkill es " +
            "LEFT JOIN FETCH es.skill " +
            "WHERE es.employee.id IN :employeeIds")
    List<EmployeeSkill> findByEmployeeIdIn(@Param("employeeIds") List<UUID> employeeIds);
}
