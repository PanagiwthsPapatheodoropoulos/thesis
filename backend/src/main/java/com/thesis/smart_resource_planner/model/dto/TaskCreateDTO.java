package com.thesis.smart_resource_planner.model.dto;

import com.thesis.smart_resource_planner.enums.TaskPriority;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskCreateDTO {

    @NotBlank(message = "Title is required")
    @Size(max = 255)
    private String title;

    private String description;

    @NotNull(message = "Priority is required")
    private TaskPriority priority;

    @DecimalMin(value = "0.0", inclusive = false)
    private BigDecimal estimatedHours;

    private LocalDateTime startDate;

    @NotNull(message = "Due date is required")
    @Future
    private LocalDateTime dueDate;

    private UUID teamId;

    // Optional employee assignment
    private UUID assignedEmployeeId;

    @DecimalMin("0.0")
    @DecimalMax("1.0")
    private BigDecimal complexityScore;

    private List<UUID> requiredSkillIds;
}
