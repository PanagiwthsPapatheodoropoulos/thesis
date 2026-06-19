package com.thesis.smart_resource_planner.enums;

/**
 * Defines the access roles available within the application.
 * Roles are checked by Spring Security at both the URL and method level.
 * SUPER_ADMIN is a platform-wide role that crosses company boundaries.
 */
public enum UserRole {
    /** Default authenticated user with minimal permissions. */
    USER("USER"),
    /** Company administrator with full control over their organization. */
    ADMIN("ADMIN"),
    /** Team lead with elevated task management and reporting capabilities. */
    MANAGER("MANAGER"),
    /** Standard team member who can view and work on assigned tasks. */
    EMPLOYEE("EMPLOYEE"),
    /** Platform-level administrator with cross-company access. */
    SUPER_ADMIN("SUPER_ADMIN");

    private final String value;

    UserRole(String value) {
        this.value = value;
    }

    /**
     * @return The string representation stored in the database.
     */
    public String getValue() {
        return this.value;
    }
}
