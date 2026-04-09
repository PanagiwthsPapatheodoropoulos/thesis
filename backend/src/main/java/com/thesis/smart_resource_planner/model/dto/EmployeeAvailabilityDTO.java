package com.thesis.smart_resource_planner.model.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
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
public class EmployeeAvailabilityDTO {
    private UUID id;
    private UUID employeeId;

    @NotNull
    private LocalDate date;

    @DecimalMin("0.0")
    @DecimalMax("24.0")
    private BigDecimal availableHours;

    private Boolean isAvailable;
    private String notes;
}
