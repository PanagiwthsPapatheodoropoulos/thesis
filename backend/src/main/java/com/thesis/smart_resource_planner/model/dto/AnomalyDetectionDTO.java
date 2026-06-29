package com.thesis.smart_resource_planner.model.dto;


import com.thesis.smart_resource_planner.enums.EntityType;
import com.thesis.smart_resource_planner.enums.Severity;
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
public class AnomalyDetectionDTO {
    private UUID id;

    private EntityType entityType;

    private UUID entityId;

    private String anomalyType;

    private Severity severity;

    private BigDecimal anomalyScore;

    private String description;

    private LocalDateTime detectedAt;

    private Boolean resolved;

    private LocalDateTime resolvedAt;

    private UUID resolvedBy;

    private String metadata;
}