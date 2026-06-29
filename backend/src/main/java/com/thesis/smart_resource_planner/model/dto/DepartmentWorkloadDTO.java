package com.thesis.smart_resource_planner.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentWorkloadDTO {
    private String departmentName;
    private int totalCapacityHours;
    private double publicTaskHours;
    private double departmentTaskHours;
    private double employeeAssignedHours;
    private double usedHours;
    private double workloadPercentage;
    
    // For counting number of active/pending tasks (optional, good for UI info)
    private int activeTasks;
    private int completedTasks;
    private int pendingTasks;
}
