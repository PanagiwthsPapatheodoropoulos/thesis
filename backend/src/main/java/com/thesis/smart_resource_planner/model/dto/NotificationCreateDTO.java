package com.thesis.smart_resource_planner.model.dto;

import com.thesis.smart_resource_planner.enums.EntityType;
import com.thesis.smart_resource_planner.enums.NotificationSeverity;
import com.thesis.smart_resource_planner.enums.NotificationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationCreateDTO {

    @NotNull(message = "User ID is required")
    private UUID userId;

    @NotNull(message = "Type is required")
    private NotificationType type;

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Message is required")
    private String message;

    private NotificationSeverity severity;

    private EntityType relatedEntityType;

    private UUID relatedEntityId;
}
