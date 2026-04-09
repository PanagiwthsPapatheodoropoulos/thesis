package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.TaskPermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for managing {@link TaskPermission} entities in the database.
 * Provides methods for checking and retrieving custom permissions granted to
 * users on specific tasks.
 */
@Repository
public interface TaskPermissionRepository extends JpaRepository<TaskPermission, UUID> {

    Optional<TaskPermission> findByTaskIdAndUserId(UUID taskId, UUID userId);

    List<TaskPermission> findByUserId(UUID userId);

}
