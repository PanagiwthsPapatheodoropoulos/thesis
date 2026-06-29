// src/main/java/com/thesis/smart_resource_planner/model/dto/ai/AssignmentSuggestionDTO.java
package com.thesis.smart_resource_planner.model.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentSuggestionDTO {
    private String employeeId;
    private String employeeName;
    private String position;
    private BigDecimal fitScore;
    private BigDecimal confidenceScore;
    private String reasoning;
    private Integer availableHours;
}