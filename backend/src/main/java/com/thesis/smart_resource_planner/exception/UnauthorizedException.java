package com.thesis.smart_resource_planner.exception;

/**
 * Thrown when an operation is attempted by a caller who lacks valid
 * authentication.
 * Maps to HTTP 401 Unauthorized via {@link GlobalExceptionHandler}.
 */
public class UnauthorizedException extends RuntimeException {
    /**
     * @param message A human-readable reason for the unauthorized access.
     */
    public UnauthorizedException(String message) {
        super(message);
    }

    /**
     * @param message A human-readable reason for the unauthorized access.
     * @param cause   The underlying cause of this exception.
     */
    public UnauthorizedException(String message, Throwable cause) {
        super(message, cause);
    }
}