package com.thesis.smart_resource_planner.enums;

/**
 * Categorizes the domain objects that can be referenced in audit logs,
 * notifications, and anomaly detection results.
 */
public enum EntityType {
    /** Refers to a task record. */
    TASK("TASK"),
    /** Refers to an employee profile. */
    EMPLOYEE("EMPLOYEE"),
    /** Refers to a team. */
    TEAM("TEAM");

    private final String value;

    EntityType(String value) {
        this.value = value;
    }

    /**
     * @return The string representation stored in the database.
     */
    public String getValue() {
        return this.value;
    }
}
