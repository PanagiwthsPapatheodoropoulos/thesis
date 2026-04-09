// src/main/java/com/thesis/smart_resource_planner/model/dto/ai/BulkAssignmentRequestDTO.java
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
public class BulkAssignmentRequestDTO {
    private List<String> taskIds;
    private Boolean optimizeWorkload;
}