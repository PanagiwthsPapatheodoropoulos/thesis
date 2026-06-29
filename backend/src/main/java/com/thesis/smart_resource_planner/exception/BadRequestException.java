package com.thesis.smart_resource_planner.exception;

/**
 * Thrown when a client request is syntactically valid but semantically invalid.
 * Maps to HTTP 400 Bad Request via {@link GlobalExceptionHandler}.
 */
public class BadRequestException extends RuntimeException {
    /**
     * @param message A human-readable description of the invalid request.
     */
    public BadRequestException(String message) {
        super(message);
    }

    /**
     * @param message A human-readable description of the invalid request.
     * @param cause   The underlying cause of this exception.
     */
    public BadRequestException(String message, Throwable cause) {
        super(message, cause);
    }
}
