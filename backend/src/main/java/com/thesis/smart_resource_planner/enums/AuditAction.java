package com.thesis.smart_resource_planner.enums;

/**
 * Identifies the type of action recorded in the task audit trail.
 * Each value represents a distinct lifecycle event on a task.
 */
public enum AuditAction {

    /** A new task was created. */
    TASK_CREATED("TASK_CREATED"),
    /** One or more task fields were modified. */
    FIELD_UPDATED("FIELD_UPDATED"),
    /** The task's workflow status changed (e.g., PENDING → IN_PROGRESS). */
    STATUS_CHANGED("STATUS_CHANGED"),
    /** An employee was assigned to the task. */
    TASK_ASSIGNED("TASK_ASSIGNED"),
    /** The task has been marked as completed. */
    TASK_COMPLETED("TASK_COMPLETED"),
    /** A new file attachment was added to the task. */
    ATTACHMENT_ADDED("ATTACHMENT_ADDED"),
    /** A file attachment was deleted from the task. */
    ATTACHMENT_DELETED("ATTACHMENT_DELETED");

    private final String value;

    AuditAction(String value) {
        this.value = value;
    }

    public String getValue() {
        return this.value;
    }
}
