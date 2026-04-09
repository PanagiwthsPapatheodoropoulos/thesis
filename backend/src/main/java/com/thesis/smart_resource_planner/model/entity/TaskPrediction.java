package com.thesis.smart_resource_planner.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.GenericGenerator;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "task_predictions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskPrediction {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @Column(name = "predicted_hours", nullable = false, precision = 10, scale = 2)
    private BigDecimal predictedHours;

    @Column(name = "confidence_interval_lower", precision = 10, scale = 2)
    private BigDecimal confidenceIntervalLower;

    @Column(name = "confidence_interval_upper", precision = 10, scale = 2)
    private BigDecimal confidenceIntervalUpper;

    @Column(name = "model_version", length = 50)
    private String modelVersion;

    @Column(name = "prediction_date", nullable = false)
    private LocalDateTime predictionDate;

    @Column(name = "features_used", columnDefinition = "jsonb")
    private String featuresUsed; // JSON string

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (predictionDate == null) {
            predictionDate = LocalDateTime.now();
        }
    }
}
