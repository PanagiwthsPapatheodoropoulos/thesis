package com.thesis.smart_resource_planner.enums;

/**
 * Represents the lifecycle stages of a task.
 * A task progresses from PENDING through IN_PROGRESS to COMPLETED,
 * and may be halted (BLOCKED) or abandoned (CANCELLED) at any stage.
 */
public enum TaskStatus {

    /** Task has been created but work has not yet started. */
    PENDING("PENDING"),
    /** Task is actively being worked on. */
    IN_PROGRESS("IN_PROGRESS"),
    /** Task has been finished. */
    COMPLETED("COMPLETED"),
    /** Task cannot proceed due to an external dependency or issue. */
    BLOCKED("BLOCKED"),
    /** Task has been abandoned and will not be completed. */
    CANCELLED("CANCELLED");

    private final String value;

    TaskStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return this.value;
    }
}
