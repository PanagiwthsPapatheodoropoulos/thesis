package com.thesis.smart_resource_planner.model.dto;

import jakarta.validation.constraints.*;
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
public class EmployeeCreateDTO {
    @NotNull(message = "User ID is required")
    private UUID userId;

    @NotBlank(message = "First name is required")
    @Size(max = 100)
    private String firstName;

    @NotBlank(message = "Last name is required")
    @Size(max = 100)
    private String lastName;

    private String position;

    private String department;

    private LocalDate hireDate;

    @DecimalMin(value = "0.0", inclusive = false)
    private BigDecimal hourlyRate;

    @Min(1)
    @Max(168)
    private Integer maxWeeklyHours;

    private String timezone;
    private String profileImageUrl;
}
