// src/main/java/com/thesis/smart_resource_planner/model/dto/EmployeeWorkloadDTO.java
package com.thesis.smart_resource_planner.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeWorkloadDTO {
    private UUID employeeId;
    private String employeeName;
    private String department;
    private Integer activeTasks;
    private Integer completedTasks;
    private Integer pendingTasks;
    private Double workloadPercentage;
    private Integer availableHours;
    private String status; // "UNDERLOADED", "OPTIMAL", "OVERLOADED"
}