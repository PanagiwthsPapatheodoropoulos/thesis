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
public class TaskAttachmentDTO {
    private UUID id;
    private UUID taskId;
    private String filename;
    private String fileType;
    private Long fileSize;
    private UUID uploadedByUserId;
    private String uploadedByUserName;
    private LocalDateTime uploadedAt;
}
