package com.thesis.smart_resource_planner.model.dto;

import com.thesis.smart_resource_planner.enums.TaskStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskApprovalDTO {
    private UUID id;
    private UUID taskId;
    private String taskTitle;
    private UUID requestedBy;
    private String requestedByName;
    private UUID approvedBy;
    private String approvedByName;
    private TaskStatus status; // PENDING, APPROVED, REJECTED
    private String requestNotes;
    private String approvalNotes;
    private LocalDateTime requestedAt;
    private LocalDateTime reviewedAt;
}