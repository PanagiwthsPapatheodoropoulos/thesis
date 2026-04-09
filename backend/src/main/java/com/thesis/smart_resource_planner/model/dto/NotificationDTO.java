package com.thesis.smart_resource_planner.model.dto;

import com.thesis.smart_resource_planner.enums.EntityType;
import com.thesis.smart_resource_planner.enums.NotificationSeverity;
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
public class NotificationDTO {
    private UUID id;


    private UUID userId;

    private String type;

    private String title;

    private String message;

    private NotificationSeverity severity;

    private Boolean isRead;

    private EntityType relatedEntityType;

    private UUID relatedEntityId;

    private LocalDateTime createdAt;

    private LocalDateTime readAt;
}

