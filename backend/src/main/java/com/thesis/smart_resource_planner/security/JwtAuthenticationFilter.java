package com.thesis.smart_resource_planner.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Servlet filter that intercepts every incoming HTTP request exactly once
 * and authenticates the caller using a JWT Bearer token.
 *
 * <p>
 * If the {@code Authorization} header contains a valid Bearer token,
 * the filter resolves the corresponding
 * {@link org.springframework.security.core.userdetails.UserDetails},
 * constructs a
 * {@link org.springframework.security.authentication.UsernamePasswordAuthenticationToken},
 * and stores it in the {@link SecurityContextHolder} so that the rest of
 * the request processing pipeline can access the authenticated principal.
 * </p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final CustomUserDetailsService customUserDetailsService;

    /**
     * Extracts the JWT from the request, validates it, and — when valid —
     * populates the security context with the authenticated user.
     * Authentication errors are logged and swallowed so that the filter chain
     * continues; downstream security rules will reject unauthenticated requests.
     *
     * @param request     the incoming HTTP request
     * @param response    the HTTP response
     * @param filterChain the remaining filter chain to invoke after processing
     * @throws ServletException if a servlet error occurs
     * @throws IOException      if an I/O error occurs during filtering
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);

            if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)) {
                String username = tokenProvider.getUsernameFromToken(jwt);

                UserDetails userDetails = customUserDetailsService.loadUserByUsername(username);

                if (!(userDetails instanceof UserPrincipal)) {
                    log.error("CRITICAL: UserDetails is NOT UserPrincipal! Type: {}",
                            userDetails.getClass().getName());
                }

                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());

                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authentication);

            }
        } catch (Exception ex) {
            log.error("Could not set user authentication in security context", ex);
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Extracts the raw JWT string from the {@code Authorization} header.
     * Returns {@code null} if the header is absent or does not start with
     * {@code "Bearer "}, so that the filter can safely skip token validation.
     *
     * @param request the incoming HTTP request
     * @return the JWT string, or {@code null} if not present
     */
    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}