package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.TaskAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TaskAttachmentRepository extends JpaRepository<TaskAttachment, UUID> {
    List<TaskAttachment> findByTaskIdOrderByUploadedAtDesc(UUID taskId);
}
