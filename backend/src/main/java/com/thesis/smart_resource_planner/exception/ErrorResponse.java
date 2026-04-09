package com.thesis.smart_resource_planner.exception;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Data transfer object representing an error response.
 * Used for standardizing exception responses across the application.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ErrorResponse {
    /** The timestamp when the error occurred. */
    private LocalDateTime timestamp;
    /** The HTTP status code of the error. */
    private int status;
    /** The error title or concise description. */
    private String error;
    /** Detailed error message. */
    private String message;
    /** The request path that triggered the error. */
    private String path;
    /** Map of field-specific validation errors. */
    private Map<String, String> validationErrors;
}
