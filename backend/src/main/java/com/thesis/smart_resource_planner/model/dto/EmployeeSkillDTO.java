package com.thesis.smart_resource_planner.model.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeSkillDTO {
    private UUID id;
    private UUID skillId;
    private String skillName;
    private String skillCategory;

    @Min(1)
    @Max(5)
    private Integer proficiencyLevel;

    private BigDecimal yearsOfExperience;
    private LocalDate lastUsed;
}
