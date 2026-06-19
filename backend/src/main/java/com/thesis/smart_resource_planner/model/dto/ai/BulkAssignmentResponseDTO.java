// src/main/java/com/thesis/smart_resource_planner/model/dto/ai/BulkAssignmentResponseDTO.java
package com.thesis.smart_resource_planner.model.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkAssignmentResponseDTO {
    private Integer totalTasks;
    private List<AssignmentSuggestionDTO> assignments;
    private String optimizationMethod;
}