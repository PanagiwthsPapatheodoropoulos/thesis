package com.thesis.smart_resource_planner.model.dto;

import com.thesis.smart_resource_planner.enums.AssignedByType;
import com.thesis.smart_resource_planner.enums.TaskAssignmentStatus;
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
public class TaskAssignmentDTO {
    private UUID id;
    private UUID taskId;
    private String taskTitle;
    private UUID employeeId;
    private String employeeName;
    private AssignedByType assignedBy;
    private TaskAssignmentStatus status;
    private BigDecimal fitScore;
    private BigDecimal confidenceScore;
    private LocalDateTime assignedDate;
    private String notes;
}
