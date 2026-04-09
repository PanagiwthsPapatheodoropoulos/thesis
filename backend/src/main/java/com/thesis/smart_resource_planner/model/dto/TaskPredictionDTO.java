package com.thesis.smart_resource_planner.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskPredictionDTO {
    private UUID id;

    private UUID taskId;

    private BigDecimal predictedHours;

    private BigDecimal confidenceIntervalLower;

    private BigDecimal confidenceIntervalUpper;

    private String modelVersion;

    private LocalDateTime predictionDate;

    private String featuresUsed;
}
