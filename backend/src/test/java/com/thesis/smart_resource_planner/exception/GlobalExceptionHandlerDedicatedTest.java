package com.thesis.smart_resource_planner.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerDedicatedTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final WebRequest request = new ServletWebRequest(new MockHttpServletRequest("GET", "/api/test"));

    @Test
    void handlesDomainAndSecurityExceptions() {
        ResponseEntity<ErrorResponse> nf = handler.handleResourceNotFoundException(
                new ResourceNotFoundException("missing"), request);
        assertEquals(HttpStatus.NOT_FOUND, nf.getStatusCode());
        assertEquals("missing", nf.getBody().getMessage());

        ResponseEntity<ErrorResponse> dup = handler.handleDuplicateResourceException(
                new DuplicateResourceException("dup"), request);
        assertEquals(HttpStatus.CONFLICT, dup.getStatusCode());

        ResponseEntity<ErrorResponse> bad = handler.handleBadRequestException(
                new BadRequestException("bad"), request);
        assertEquals(HttpStatus.BAD_REQUEST, bad.getStatusCode());

        ResponseEntity<ErrorResponse> unauth = handler.handleUnauthorizedException(
                new UnauthorizedException("unauth"), request);
        assertEquals(HttpStatus.UNAUTHORIZED, unauth.getStatusCode());

        ResponseEntity<ErrorResponse> creds = handler.handleBadCredentialsException(
                new BadCredentialsException("x"), request);
        assertEquals("Invalid username or password", creds.getBody().getMessage());

        ResponseEntity<ErrorResponse> denied = handler.handleAccessDeniedException(
                new AccessDeniedException("nope"), request);
        assertEquals(HttpStatus.FORBIDDEN, denied.getStatusCode());
    }

    @Test
    void handlesValidationAndFallbackException() throws Exception {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "obj");
        bindingResult.addError(new FieldError("obj", "title", "must not be blank"));
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(null, bindingResult);

        ResponseEntity<ErrorResponse> validation = handler.handleValidationExceptions(ex, request);
        assertEquals(HttpStatus.BAD_REQUEST, validation.getStatusCode());
        assertEquals("Validation failed", validation.getBody().getMessage());
        assertEquals("must not be blank", validation.getBody().getValidationErrors().get("title"));

        ResponseEntity<ErrorResponse> fallback = handler.handleGlobalException(new RuntimeException("boom"), request);
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, fallback.getStatusCode());
        assertEquals("An unexpected error occurred", fallback.getBody().getMessage());
    }
}
