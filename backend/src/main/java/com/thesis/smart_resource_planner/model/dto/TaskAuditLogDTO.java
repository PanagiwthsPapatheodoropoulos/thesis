package com.thesis.smart_resource_planner.model.dto;

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
public class TaskAuditLogDTO {
    private UUID id;
    private UUID taskId;
    private UUID userId;
    private String userName;
    private String action;
    private String fieldName;
    private String oldValue;
    private String newValue;
    private String description;
    private LocalDateTime createdAt;
}