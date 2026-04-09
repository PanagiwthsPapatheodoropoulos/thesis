package com.thesis.smart_resource_planner.model.dto;

import com.thesis.smart_resource_planner.enums.TaskPriority;
import com.thesis.smart_resource_planner.enums.TaskStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskUpdateDTO {
    private String title;

    private String description;

    private TaskStatus status;

    private TaskPriority priority;

    private BigDecimal estimatedHours;

    private BigDecimal actualHours;

    private LocalDateTime startDate;

    private LocalDateTime dueDate;

    private LocalDateTime completedDate;

    private BigDecimal complexityScore;
}
