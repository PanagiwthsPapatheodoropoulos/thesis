package com.thesis.smart_resource_planner.enums;

/**
 * Enumeration for task assignment statuses.
 * Defines the lifecycle states of a task assignment.
 */
public enum TaskAssignmentStatus {
    /** Assignment is pending response. */
    PENDING("PENDING"),
    /** Assignment has been accepted by the user. */
    ACCEPTED("ACCEPTED"),
    /** Assignment has been rejected by the user. */
    REJECTED("REJECTED"),
    /** Task is currently being worked on. */
    IN_PROGRESS("IN_PROGRESS"),
    /** Task has been marked as completed. */
    COMPLETED("COMPLETED");

    // Display name for the status
    private final String displayName;

    /**
     * Constructor for TaskAssignmentStatus enum.
     * 
     * @param displayName The display name string.
     */
    TaskAssignmentStatus(String displayName) {
        this.displayName = displayName;
    }

    /**
     * Gets the display name of the status.
     * 
     * @return The status display name.
     */
    public String getDisplayName() {
        return displayName;
    }
}