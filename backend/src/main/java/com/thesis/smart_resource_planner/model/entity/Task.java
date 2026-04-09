package com.thesis.smart_resource_planner.model.entity;

import com.thesis.smart_resource_planner.enums.TaskPriority;
import com.thesis.smart_resource_planner.enums.TaskStatus;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.GenericGenerator;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * JPA entity representing a work item within the system.
 * A task belongs to a company and optionally a team. It tracks planning data
 * (estimated hours, complexity, required skills), execution data (actual hours,
 * status, assignment), and ML prediction metadata (predicted hours, confidence,
 * model version, error, and feedback quality).
 */
@Entity
@Table(name = "tasks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Task {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private TaskStatus status = TaskStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskPriority priority = TaskPriority.MEDIUM;

    @Column(name = "estimated_hours", precision = 10, scale = 2)
    private BigDecimal estimatedHours;

    @Column(name = "actual_hours", precision = 10, scale = 2)
    private BigDecimal actualHours;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id")
    private Company company;

    @Column(name = "predicted_hours", precision = 10, scale = 2)
    private BigDecimal predictedHours;

    @Column(name = "prediction_confidence", precision = 5, scale = 4)
    private BigDecimal predictionConfidence;

    @Column(name = "prediction_error", precision = 10, scale = 2)
    private BigDecimal predictionError;

    @Column(name = "prediction_model_version", length = 50)
    private String predictionModelVersion;

    @Column(name = "feedback_submitted")
    private Boolean feedbackSubmitted = false;

    @Column(name = "feedback_quality_score", precision = 3, scale = 2)
    private BigDecimal feedbackQualityScore;

    // Optional: Track task modifications that affect feedback quality
    @Column(name = "scope_change_count")
    private Integer scopeChangeCount = 0;

    @Column(name = "reassignment_count")
    private Integer reassignmentCount = 0;

    @Column(name = "task_category", length = 50)
    private String taskCategory;

    @Column(name = "complexity_factors", columnDefinition = "TEXT")
    private String complexityFactors;

    @Column(name = "start_date")
    private LocalDateTime startDate;

    @Column(name = "due_date", nullable = false)
    private LocalDateTime dueDate;

    @Column(name = "completed_date")
    private LocalDateTime completedDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    private Team team;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "complexity_score", precision = 3, scale = 2)
    private BigDecimal complexityScore; // 0-1

    @Column(name = "is_employee_request")
    private Boolean isEmployeeRequest = false;

    @Column(name = "is_archived")
    private Boolean isArchived = false;

    // Requires approval flag
    @Column(name = "requires_approval")
    private Boolean requiresApproval = false;

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TaskAssignment> assignments = new ArrayList<>();

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TaskPrediction> predictions = new ArrayList<>();

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TaskRequiredSkill> requiredSkills = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "assigned_employee_id")
    private UUID assignedEmployeeId;

    /**
     * Sets {@code createdAt} and {@code updatedAt} timestamps on first persist and
     * ensures boolean flags have defaults.
     */
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();

        // Set defaults if null
        if (isArchived == null) {
            isArchived = false;
        }
        if (isEmployeeRequest == null) {
            isEmployeeRequest = false;
        }
        if (requiresApproval == null) {
            requiresApproval = false;
        }
    }

    /**
     * Refreshes the {@code updatedAt} timestamp whenever the entity is modified.
     */
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}