package com.thesis.smart_resource_planner.enums;

/**
 * Categorizes the kind of notification sent to a user.
 * Each value corresponds to a specific system event that triggers a user-visible alert.
 */
public enum NotificationType {

    /** A task has been assigned to the user. */
    TASK_ASSIGNED("TASK_ASSIGNED"),
    /** An employee has submitted a task request for approval. */
    TASK_REQUEST("TASK_REQUEST"),
    /** A previously submitted task request has been approved. */
    TASK_APPROVED("TASK_APPROVED"),
    /** A previously submitted task request has been rejected. */
    TASK_REJECTED("TASK_REJECTED"),
    /** The status of a task the user is involved in has changed. */
    TASK_STATUS_CHANGED("TASK_STATUS_CHANGED"),
    /** A task the user is involved in has been completed. */
    TASK_COMPLETED("TASK_COMPLETED"),
    /** A task is approaching its due date. */
    DEADLINE_REMINDER("DEADLINE_REMINDER"),
    /** The user has been added to a team. */
    TEAM_ASSIGNMENT("TEAM_ASSIGNMENT"),
    /** The user has been removed from a team. */
    TEAM_REMOVAL("TEAM_REMOVAL"),
    /** A team the user belongs to has been updated. */
    TEAM_UPDATE("TEAM_UPDATE"),
    /** The user's role has been promoted (e.g., EMPLOYEE → MANAGER). */
    ROLE_PROMOTION("ROLE_PROMOTION"),
    /** A new user is requesting approval to join a company. */
    JOIN_REQUEST("JOIN_REQUEST"),
    /** A join request was declined or access was removed. */
    JOIN_REJECTED("JOIN_REJECTED");

    private final String value;

    NotificationType(String value) {
        this.value = value;
    }

    public String getValue() {
        return this.value;
    }
}
