package com.thesis.smart_resource_planner.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Utility component for creating, parsing, and validating JSON Web Tokens
 * (JWTs).
 *
 * <p>
 * Supports a two-token system: short-lived <em>access tokens</em> for API
 * authorization and long-lived <em>refresh tokens</em> for obtaining new
 * access tokens without re-authentication. Tokens are signed with
 * HMAC-SHA512 using a secret key configured via the {@code JWT_SECRET}
 * environment variable.
 * </p>
 */
@Component
@Slf4j
public class JwtTokenProvider {

    @Value("${JWT_SECRET}")
    private String jwtSecret;

    @Value("${JWT_EXPIRATION_MS}")
    private long jwtExpirationMs;

    @Value("${JWT_REFRESH_EXPIRATION_MS:604800000}")
    private long jwtRefreshExpirationMs;

    public long getJwtExpirationMs() {
        return jwtExpirationMs;
    }

    public long getJwtRefreshExpirationMs() {
        return jwtRefreshExpirationMs;
    }

    /**
     * Derives the HMAC-SHA512 signing key from the configured JWT secret.
     *
     * @return the {@link SecretKey} used to sign and verify tokens
     */
    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * Generates a signed access JWT for the authenticated principal.
     *
     * @param authentication the Spring Security authentication object
     *                       whose principal must be a {@link UserDetails}
     * @return the compact, URL-safe JWT string
     */
    public String generateToken(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationMs);

        return Jwts.builder()
                .setSubject(userDetails.getUsername())
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .claim("type", "access")
                .signWith(getSigningKey(), SignatureAlgorithm.HS512)
                .compact();
    }

    /**
     * Generates a signed access JWT directly from a username string.
     * Useful when a full {@link Authentication} object is not available
     * (e.g., programmatic token refresh scenarios).
     *
     * @param username the username to embed as the token subject
     * @return the compact, URL-safe JWT string
     */
    public String generateTokenFromUsername(String username) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationMs);

        return Jwts.builder()
                .setSubject(username)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .claim("type", "access")
                .signWith(getSigningKey(), SignatureAlgorithm.HS512)
                .compact();
    }

    /**
     * Generates a long-lived refresh token for the given username.
     * Refresh tokens carry a {@code "type": "refresh"} claim and use
     * the separate {@code JWT_REFRESH_EXPIRATION_MS} expiry window.
     *
     * @param username the username to embed as the token subject
     * @return the compact, URL-safe refresh JWT string
     */
    public String generateRefreshToken(String username) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtRefreshExpirationMs);

        return Jwts.builder()
                .setSubject(username)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .claim("type", "refresh")
                .signWith(getSigningKey(), SignatureAlgorithm.HS512)
                .compact();
    }

    /**
     * Extracts the username (subject claim) from a JWT.
     *
     * @param token the compact JWT string
     * @return the username stored in the token's subject claim
     * @throws io.jsonwebtoken.JwtException if the token is invalid or expired
     */
    public String getUsernameFromToken(String token) {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();

        return claims.getSubject();
    }

    /**
     * Validates a JWT by verifying its signature, structure, and expiry.
     * Specific failure reasons are logged at ERROR level.
     *
     * @param authToken the compact JWT string to validate
     * @return {@code true} if the token is valid; {@code false} otherwise
     */
    public boolean validateToken(String authToken) {
        try {
            Jwts.parserBuilder()
                    .setSigningKey(getSigningKey())
                    .build()
                    .parseClaimsJws(authToken);
            return true;
        } catch (SecurityException ex) {
            log.error("Invalid JWT signature");
        } catch (MalformedJwtException ex) {
            log.error("Invalid JWT token");
        } catch (ExpiredJwtException ex) {
            log.error("Expired JWT token");
        } catch (UnsupportedJwtException ex) {
            log.error("Unsupported JWT token");
        } catch (IllegalArgumentException ex) {
            log.error("JWT claims string is empty");
        }
        return false;
    }
}