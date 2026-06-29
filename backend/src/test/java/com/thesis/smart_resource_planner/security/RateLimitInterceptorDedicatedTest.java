package com.thesis.smart_resource_planner.security;

import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import io.github.bucket4j.distributed.proxy.RemoteBucketBuilder;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("RateLimitInterceptor Dedicated Tests")
class RateLimitInterceptorDedicatedTest {

    @Mock
    private LettuceBasedProxyManager<byte[]> proxyManager;

    @Mock
    private RemoteBucketBuilder<byte[]> proxyBuilder;

    @Mock
    private io.github.bucket4j.distributed.BucketProxy bucket;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private SecurityContext securityContext;

    @Mock
    private Authentication authentication;

    @InjectMocks
    private RateLimitInterceptor interceptor;

    private StringWriter responseWriter;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() throws Exception {
        lenient().when(proxyManager.builder()).thenReturn(proxyBuilder);
        lenient().when(proxyBuilder.build(any(byte[].class), any(BucketConfiguration.class))).thenReturn(bucket);

        responseWriter = new StringWriter();
        PrintWriter writer = new PrintWriter(responseWriter);
        lenient().when(response.getWriter()).thenReturn(writer);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Should bypass rate limiting for non-API endpoints")
    void testPreHandleBypassNonApi() throws Exception {
        when(request.getRequestURI()).thenReturn("/index.html");

        boolean result = interceptor.preHandle(request, response, new Object());

        assertTrue(result);
        verifyNoInteractions(proxyManager);
    }

    @Test
    @DisplayName("Should allow request when bucket has tokens for authenticated user")
    void testPreHandleAuthenticatedSuccess() throws Exception {
        UUID userId = UUID.randomUUID();
        UserPrincipal principal = mock(UserPrincipal.class);
        when(principal.getId()).thenReturn(userId);

        when(request.getRequestURI()).thenReturn("/api/tasks");
        when(securityContext.getAuthentication()).thenReturn(authentication);
        when(authentication.getPrincipal()).thenReturn(principal);
        SecurityContextHolder.setContext(securityContext);

        when(bucket.tryConsume(1)).thenReturn(true);

        boolean result = interceptor.preHandle(request, response, new Object());

        assertTrue(result);

        byte[] expectedKey = ("rate_limit:user:" + userId).getBytes(StandardCharsets.UTF_8);
        verify(proxyBuilder).build(eq(expectedKey), any(BucketConfiguration.class));
        verify(bucket).tryConsume(1);
    }

    @Test
    @DisplayName("Should block request and return 429 when authenticated user limit exceeded")
    void testPreHandleAuthenticatedLimitExceeded() throws Exception {
        UUID userId = UUID.randomUUID();
        UserPrincipal principal = mock(UserPrincipal.class);
        when(principal.getId()).thenReturn(userId);

        when(request.getRequestURI()).thenReturn("/api/tasks");
        when(securityContext.getAuthentication()).thenReturn(authentication);
        when(authentication.getPrincipal()).thenReturn(principal);
        SecurityContextHolder.setContext(securityContext);

        when(bucket.tryConsume(1)).thenReturn(false);

        boolean result = interceptor.preHandle(request, response, new Object());

        assertFalse(result);
        verify(response).setStatus(429);
        verify(response).setContentType("application/json");
        assertTrue(responseWriter.toString().contains("Rate limit exceeded"));
    }

    @Test
    @DisplayName("Should fall back to X-Forwarded-For IP address for unauthenticated traffic")
    void testPreHandleUnauthenticatedXForwardedFor() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/public/status");
        when(request.getHeader("X-Forwarded-For")).thenReturn("192.168.1.100, 10.0.0.1");

        // No authentication in context
        SecurityContextHolder.setContext(securityContext);
        when(securityContext.getAuthentication()).thenReturn(null);

        when(bucket.tryConsume(1)).thenReturn(true);

        boolean result = interceptor.preHandle(request, response, new Object());

        assertTrue(result);
        byte[] expectedKey = "rate_limit:ip:192.168.1.100".getBytes(StandardCharsets.UTF_8);
        verify(proxyBuilder).build(eq(expectedKey), any(BucketConfiguration.class));
    }

    @Test
    @DisplayName("Should fall back to remote address when X-Forwarded-For is missing")
    void testPreHandleUnauthenticatedRemoteAddr() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/public/status");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");

        SecurityContextHolder.setContext(securityContext);
        when(securityContext.getAuthentication()).thenReturn(null);

        when(bucket.tryConsume(1)).thenReturn(true);

        boolean result = interceptor.preHandle(request, response, new Object());

        assertTrue(result);
        byte[] expectedKey = "rate_limit:ip:127.0.0.1".getBytes(StandardCharsets.UTF_8);
        verify(proxyBuilder).build(eq(expectedKey), any(BucketConfiguration.class));
    }
}
