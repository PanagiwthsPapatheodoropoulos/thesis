package com.thesis.smart_resource_planner.enums;

/**
 * Enumeration representing the severity levels.
 * Defines the priority or impact level of an entity.
 */
public enum Severity {

    /** Low severity level. */
    LOW("LOW"),
    /** Medium severity level. */
    MEDIUM("MEDIUM"),
    /** High severity level. */
    HIGH("HIGH"),
    /** Critical severity level. */
    CRITICAL("CRITICAL");

    // The string value representing the severity
    private final String value;

    /**
     * Constructor for the Severity enum.
     * 
     * @param value The string representation of the severity.
     */
    Severity(String value) {
        this.value = value;
    }

    /**
     * Retrieves the string representation of the severity level.
     * 
     * @return The severity string value.
     */
    public String getValue() {
        return this.value;
    }
}
