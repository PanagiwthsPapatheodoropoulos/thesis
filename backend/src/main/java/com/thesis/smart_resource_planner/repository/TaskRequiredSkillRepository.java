package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.TaskRequiredSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link TaskRequiredSkill} entities.
 *
 * <p>
 * Manages the many-to-many relationship between tasks and the skills that
 * are required to complete them. Provides lookup, existence checks, and a
 * batch-fetch query with eager skill join to avoid N+1 issues.
 * </p>
 */
@Repository
public interface TaskRequiredSkillRepository extends JpaRepository<TaskRequiredSkill, UUID> {

    /**
     * Retrieves all required-skill records associated with a given task.
     *
     * @param taskId the UUID of the task whose required skills are requested
     * @return list of {@link TaskRequiredSkill} entries for the task (may be empty)
     */
    List<TaskRequiredSkill> findByTaskId(UUID taskId);

    /**
     * Checks whether a specific skill has already been linked to a specific task.
     *
     * @param taskId  the UUID of the task
     * @param skillId the UUID of the skill
     * @return {@code true} if the task–skill relationship exists, {@code false}
     *         otherwise
     */
    boolean existsByTaskIdAndSkillId(UUID taskId, UUID skillId);

    /**
     * Retrieves all required-skill records for a batch of tasks, eagerly fetching
     * the associated {@code Skill} entity to avoid N+1 queries.
     *
     * @param taskIds list of task UUIDs to load required skills for
     * @return list of {@link TaskRequiredSkill} entries with their {@code Skill}
     *         eagerly loaded
     */
    @Query("SELECT trs FROM TaskRequiredSkill trs " +
            "LEFT JOIN FETCH trs.skill " +
            "WHERE trs.task.id IN :taskIds")
    List<TaskRequiredSkill> findByTaskIdIn(@Param("taskIds") List<UUID> taskIds);
}
