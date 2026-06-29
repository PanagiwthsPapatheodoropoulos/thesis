package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.TaskComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Repository for managing {@link TaskComment} entities in the database.
 * Provides query methods to fetch and count comments associated with specific
 * tasks.
 */
@Repository
public interface TaskCommentRepository extends JpaRepository<TaskComment, UUID> {
    List<TaskComment> findByTaskIdOrderByCreatedAtDesc(UUID taskId);

    Long countByTaskId(UUID taskId);

}