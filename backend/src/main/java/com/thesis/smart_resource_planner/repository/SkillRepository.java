package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.Skill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for managing {@link Skill} entities in the database.
 * Provides query methods to validate existence and find skills by category or
 * name.
 */
@Repository
public interface SkillRepository extends JpaRepository<Skill, UUID> {
    Optional<Skill> findByName(String name);

    List<Skill> findByCategory(String category);

    Boolean existsByName(String name);

    @Query("SELECT s.id FROM Skill s WHERE s.id IN :skillIds")
    List<UUID> findExistingSkillIds(@Param("skillIds") List<UUID> skillIds);

    Optional<Skill> findByNameIgnoreCase(String name);
}