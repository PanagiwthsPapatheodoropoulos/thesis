package com.thesis.smart_resource_planner.enums;

/**
 * Represents the urgency level of a task within the planning system.
 * Used by the AI assignment engine and workload analysis to prioritize work.
 */
public enum TaskPriority {
    /** Low urgency; can be addressed in the regular backlog rotation. */
    LOW("LOW"),
    /** Standard priority for routine work items. */
    MEDIUM("MEDIUM"),
    /** Elevated priority requiring prompt attention. */
    HIGH("HIGH"),
    /** Maximum urgency; must be handled immediately by experienced staff. */
    CRITICAL("CRITICAL");

    private final String value;

    TaskPriority(String value) {
        this.value = value;
    }

    /**
     * @return The string representation stored in the database.
     */
    public String getValue() {
        return this.value;
    }
}
