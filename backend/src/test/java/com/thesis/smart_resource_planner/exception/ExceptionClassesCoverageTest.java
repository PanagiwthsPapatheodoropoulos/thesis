package com.thesis.smart_resource_planner.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Exception Classes Coverage Tests")
class ExceptionClassesCoverageTest {

    @Test
    @DisplayName("ResourceNotFoundException - default constructor and message")
    void resourceNotFoundException_constructors() {
        ResourceNotFoundException ex1 = new ResourceNotFoundException("Not found");
        assertEquals("Not found", ex1.getMessage());

        ResourceNotFoundException ex2 = new ResourceNotFoundException("User id 123 not found", new RuntimeException("cause"));
        assertTrue(ex2.getMessage().contains("User"));
        assertTrue(ex2.getCause() != null);
    }

    @Test
    @DisplayName("DuplicateResourceException - message constructor")
    void duplicateResourceException_message() {
        DuplicateResourceException ex = new DuplicateResourceException("Already exists");
        assertEquals("Already exists", ex.getMessage());

        DuplicateResourceException ex2 = new DuplicateResourceException("Email already taken", new RuntimeException());
        assertTrue(ex2.getMessage().contains("Email"));
    }

    @Test
    @DisplayName("BadRequestException - message constructor")
    void badRequestException_message() {
        BadRequestException ex = new BadRequestException("Bad request");
        assertEquals("Bad request", ex.getMessage());
    }

    @Test
    @DisplayName("UnauthorizedException - message constructor")
    void unauthorizedException_message() {
        UnauthorizedException ex = new UnauthorizedException("Unauthorized");
        assertEquals("Unauthorized", ex.getMessage());
    }

    @Test
    @DisplayName("ErrorResponse - builder and getters")
    void errorResponse_builderAndGetters() {
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        java.util.Map<String, String> validationErrors = java.util.Map.of("field", "error");

        ErrorResponse response = ErrorResponse.builder()
                .timestamp(now)
                .status(400)
                .error("Bad Request")
                .message("Validation failed")
                .path("/api/test")
                .validationErrors(validationErrors)
                .build();

        assertEquals(now, response.getTimestamp());
        assertEquals(400, response.getStatus());
        assertEquals("Bad Request", response.getError());
        assertEquals("Validation failed", response.getMessage());
        assertEquals("/api/test", response.getPath());
        assertEquals(validationErrors, response.getValidationErrors());
    }

    @Test
    @DisplayName("GlobalExceptionHandler - IllegalStateException handler")
    void globalExceptionHandler_illegalState() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        org.springframework.mock.web.MockHttpServletRequest req =
                new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/test");
        org.springframework.web.context.request.WebRequest webRequest =
                new org.springframework.web.context.request.ServletWebRequest(req);

        var resp = handler.handleIllegalStateException(new IllegalStateException("state conflict"), webRequest);
        assertEquals(org.springframework.http.HttpStatus.CONFLICT, resp.getStatusCode());
        assertEquals("state conflict", resp.getBody().getMessage());
    }

    @Test
    @DisplayName("GlobalExceptionHandler - IllegalArgumentException handler")
    void globalExceptionHandler_illegalArgument() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        org.springframework.mock.web.MockHttpServletRequest req =
                new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/test");
        org.springframework.web.context.request.WebRequest webRequest =
                new org.springframework.web.context.request.ServletWebRequest(req);

        var resp = handler.handleIllegalArgumentException(new IllegalArgumentException("bad arg"), webRequest);
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, resp.getStatusCode());
        assertEquals("bad arg", resp.getBody().getMessage());
    }
}
