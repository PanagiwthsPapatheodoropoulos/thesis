package com.thesis.smart_resource_planner.model.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskTimeEntryDTO {
    private UUID id;

    @NotNull(message = "Task ID is required")
    private UUID taskId;

    private UUID employeeId;
    private String employeeName;

    @NotNull(message = "Hours spent is required")
    @DecimalMin(value = "0.1", message = "Hours must be at least 0.1")
    private BigDecimal hoursSpent;

    @NotNull(message = "Work date is required")
    private LocalDateTime workDate;

    private String description;
    private LocalDateTime createdAt;
}