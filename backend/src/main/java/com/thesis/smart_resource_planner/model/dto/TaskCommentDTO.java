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
public class TaskCommentDTO {
    private UUID id;
    private UUID taskId;
    private UUID userId;
    private String userName;
    private String comment;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}