package com.thesis.smart_resource_planner.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompanyDTO {
    private UUID id;
    private String name;
    private String joinCode;
    private String domain;
    private String subscriptionTier;
    private Boolean isActive;
    private Integer employeeCount;
    private Integer departmentCount;
    private Integer teamCount;
    private LocalDateTime createdAt;
}