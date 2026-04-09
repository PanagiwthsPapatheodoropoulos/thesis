package com.thesis.smart_resource_planner.model.dto.ai;

import com.thesis.smart_resource_planner.enums.AssignedByType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskAssignmentRequestDTO {
    // CRITICAL: Changed from String to UUID
    private UUID taskId;
    private UUID employeeId;
    private UUID assignedByUserId;

    private String taskTitle;
    private String description;
    private String priority;
    private BigDecimal estimatedHours;
    private List<String> requiredSkillIds;
    private BigDecimal complexityScore;
    private Integer topN = 5;


    private AssignedByType assignedBy; // "AI" or "MANUAL"
    private BigDecimal fitScore;
    private BigDecimal confidenceScore;
    private String notes;
}