package com.thesis.smart_resource_planner.enums;

/**
 * Represents the content type of a chat message sent through the system.
 */
public enum MessageType {
    /** A plain-text chat message from a user. */
    TEXT("TEXT"),
    /** A message containing a file attachment. */
    FILE("FILE"),
    /** An automated system-generated message, such as a join or leave notice. */
    SYSTEM("SYSTEM");

    private final String value;

    MessageType(String value) {
        this.value = value;
    }

    /**
     * @return The string representation stored in the database.
     */
    public String getValue() {
        return this.value;
    }
}