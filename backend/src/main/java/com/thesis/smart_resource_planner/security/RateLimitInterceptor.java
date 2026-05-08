package com.thesis.smart_resource_planner.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

@SuppressWarnings("deprecation")
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnBean(LettuceBasedProxyManager.class)
public class RateLimitInterceptor implements HandlerInterceptor {

    private final LettuceBasedProxyManager<byte[]> proxyManager;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String requestURI = request.getRequestURI();
        
        // Only rate limit /api/ endpoints
        if (!requestURI.startsWith("/api/")) {
            return true;
        }

        String key = resolveKey(request);
        BucketConfiguration config = resolveBucketConfig(key);

        Bucket bucket = proxyManager.builder().build(key.getBytes(StandardCharsets.UTF_8), config);

        if (bucket.tryConsume(1)) {
            return true;
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.getWriter().write("{\"error\": \"Too Many Requests\", \"message\": \"Rate limit exceeded. Please try again later.\"}");
            response.setContentType("application/json");
            log.warn("Rate limit exceeded for key: {}", key);
            return false;
        }
    }

    private String resolveKey(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal) {
            UserPrincipal principal = (UserPrincipal) auth.getPrincipal();
            return "rate_limit:user:" + principal.getId();
        }
        
        // Fallback to IP address for unauthenticated endpoints
        String clientIp = request.getHeader("X-Forwarded-For");
        if (clientIp == null || clientIp.isEmpty()) {
            clientIp = request.getRemoteAddr();
        } else {
            clientIp = clientIp.split(",")[0].trim();
        }
        return "rate_limit:ip:" + clientIp;
    }

    private BucketConfiguration resolveBucketConfig(String key) {
        if (key.startsWith("rate_limit:user:")) {
            // Authenticated users: 100 requests per minute
            return BucketConfiguration.builder()
                    .addLimit(Bandwidth.simple(100, Duration.ofMinutes(1)))
                    .build();
        } else {
            // Unauthenticated: 20 requests per minute
            return BucketConfiguration.builder()
                    .addLimit(Bandwidth.simple(20, Duration.ofMinutes(1)))
                    .build();
        }
    }
}
