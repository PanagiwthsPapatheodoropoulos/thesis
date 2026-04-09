package com.thesis.smart_resource_planner.exception;

/**
 * Thrown when a requested resource (user, task, company, etc.) cannot be found.
 * Maps to HTTP 404 Not Found via {@link GlobalExceptionHandler}.
 */
public class ResourceNotFoundException extends RuntimeException {
    /**
     * @param message A human-readable description identifying the missing resource.
     */
    public ResourceNotFoundException(String message) {
        super(message);
    }

    /**
     * @param message A human-readable description identifying the missing resource.
     * @param cause   The underlying cause of this exception.
     */
    public ResourceNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}
