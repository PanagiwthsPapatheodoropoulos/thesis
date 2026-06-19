package com.thesis.smart_resource_planner.enums;

/**
 * Defines the visual severity level of a notification displayed to the user.
 * Values are ordered from least to most critical: INFO, SUCCESS, WARNING,
 * ERROR.
 */
public enum NotificationSeverity {

    /** Informational message with no action required. */
    INFO("INFO"),
    /** Indicates a warning condition that may need attention. */
    WARNING("WARNING"),
    /** Indicates a failure or critical error that requires immediate action. */
    ERROR("ERROR"),
    /** Confirms a successful operation. */
    SUCCESS("SUCCESS");

    private final String value;

    NotificationSeverity(String value) {
        this.value = value;
    }

    /**
     * @return The string representation stored in the database.
     */
    public String getValue() {
        return this.value;
    }
}
