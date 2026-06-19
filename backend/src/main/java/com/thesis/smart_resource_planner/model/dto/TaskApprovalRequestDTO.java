package com.thesis.smart_resource_planner.model.dto;

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
public class TaskApprovalRequestDTO {
    @NotNull
    private UUID taskId;
    private String requestNotes;
}