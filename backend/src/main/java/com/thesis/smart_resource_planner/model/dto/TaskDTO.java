package com.thesis.smart_resource_planner.model.dto;

import com.thesis.smart_resource_planner.enums.TaskPriority;
import com.thesis.smart_resource_planner.enums.TaskStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@AllArgsConstructor
@Builder
@NoArgsConstructor
public class TaskDTO {
    private UUID id;
    private String title;
    private String description;
    private TaskStatus status;
    private TaskPriority priority;
    private BigDecimal estimatedHours;
    private BigDecimal actualHours;
    private LocalDateTime startDate;
    private LocalDateTime dueDate;
    private LocalDateTime completedDate;
    private UUID assignedEmployeeId;
    private UUID teamId;
    private String teamName;

    @Builder.Default
    private List<UUID> requiredSkillIds = new ArrayList<>();

    private UUID createdBy;
    private String createdByName;
    private BigDecimal complexityScore;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Builder.Default
    private List<TaskAssignmentDTO> assignments = new ArrayList<>();

    @Builder.Default
    private Boolean isArchived = false;

    @Builder.Default
    private Boolean isEmployeeRequest = false;

    @Builder.Default
    private Boolean requiresApproval = false;
}