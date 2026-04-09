package com.thesis.smart_resource_planner.enums;

/**
 * Indicates how a task was assigned to an employee.
 * AI assignments are made by the recommendation engine; MANUAL assignments
 * are made directly by a manager or administrator.
 */
public enum AssignedByType {
    /** Assignment was suggested and confirmed via the AI recommendation system. */
    AI("AI"),
    /** Assignment was made directly by a human manager or admin. */
    MANUAL("MANUAL");

    private final String value;

    AssignedByType(String value) {
        this.value = value;
    }

    /**
     * @return The string representation stored in the database.
     */
    public String getValue() {
        return this.value;
    }
}
