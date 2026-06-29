package com.thesis.smart_resource_planner.model.dto;

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
public class TaskCommentCreateDTO {

    @NotNull(message = "Task ID is required")
    private UUID taskId;

    @NotBlank(message = "Comment cannot be empty")
    private String comment;
}