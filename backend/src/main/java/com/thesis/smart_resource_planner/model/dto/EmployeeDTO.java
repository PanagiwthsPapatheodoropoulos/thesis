package com.thesis.smart_resource_planner.model.dto;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeDTO {
    private UUID id;
    private UUID userId;
    private String firstName;
    private String lastName;
    private String position;
    private String department;
    private LocalDate hireDate;
    private BigDecimal hourlyRate;
    private Integer maxWeeklyHours;
    private String timezone;
    private String profileImageUrl;


    @Builder.Default
    private List<EmployeeSkillDTO> skills = new ArrayList<>();

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}