package com.thesis.smart_resource_planner.exception;

/**
 * Thrown when a create or update operation would violate a uniqueness
 * constraint.
 * For example, registering a user with an already-taken email or username.
 * Maps to HTTP 409 Conflict via {@link GlobalExceptionHandler}.
 */
public class DuplicateResourceException extends RuntimeException {
    /**
     * @param message A human-readable explanation of the conflict.
     */
    public DuplicateResourceException(String message) {
        super(message);
    }

    /**
     * @param message A human-readable explanation of the conflict.
     * @param cause   The underlying cause of this exception.
     */
    public DuplicateResourceException(String message, Throwable cause) {
        super(message, cause);
    }
}
