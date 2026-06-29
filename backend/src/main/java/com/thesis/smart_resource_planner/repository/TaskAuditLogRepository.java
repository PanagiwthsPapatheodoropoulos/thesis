package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.TaskAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Repository for managing {@link TaskAuditLog} entities in the database.
 * Provides query methods to fetch the audit history for specific tasks.
 */
@Repository
public interface TaskAuditLogRepository extends JpaRepository<TaskAuditLog, UUID> {
    List<TaskAuditLog> findByTaskIdOrderByCreatedAtDesc(UUID taskId);

}