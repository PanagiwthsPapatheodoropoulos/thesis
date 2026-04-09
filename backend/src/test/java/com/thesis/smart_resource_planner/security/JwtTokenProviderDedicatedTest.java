package com.thesis.smart_resource_planner.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.util.ReflectionTestUtils.setField;

@ExtendWith(MockitoExtension.class)
@DisplayName("JwtTokenProvider Tests")
class JwtTokenProviderTest {

    @Mock
    private Authentication authentication;

    @InjectMocks
    private JwtTokenProvider tokenProvider;

    private final long testExpiration = 86400000;
    private UserDetails principal;

    @BeforeEach
    void setUp() {
        // HS512 requires >= 64 bytes secret
        setField(tokenProvider, "jwtSecret", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
        setField(tokenProvider, "jwtExpirationMs", testExpiration);

        Collection<GrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
        principal = org.springframework.security.core.userdetails.User
                .withUsername("testuser")
                .password("pw")
                .authorities(authorities)
                .build();
    }

    @Test
    @DisplayName("Should generate valid JWT token")
    void testGenerateToken_Success() {
        when(authentication.getPrincipal()).thenReturn(principal);
        String token = tokenProvider.generateToken(authentication);

        assertNotNull(token);
        assertFalse(token.isEmpty());
    }

    @Test
    @DisplayName("Should extract username from valid token")
    void testGetUsernameFromToken_Success() {
        when(authentication.getPrincipal()).thenReturn(principal);
        String token = tokenProvider.generateToken(authentication);
        String username = tokenProvider.getUsernameFromToken(token);

        assertNotNull(username);
        assertEquals("testuser", username);
    }

    @Test
    @DisplayName("Should validate valid token")
    void testValidateToken_Success() {
        when(authentication.getPrincipal()).thenReturn(principal);
        String token = tokenProvider.generateToken(authentication);
        boolean isValid = tokenProvider.validateToken(token);

        assertTrue(isValid);
    }

    @Test
    @DisplayName("Should invalidate malformed token")
    void testValidateToken_InvalidToken() {
        String invalidToken = "invalid.token.string";
        boolean isValid = tokenProvider.validateToken(invalidToken);

        assertFalse(isValid);
    }

    @Test
    @DisplayName("Should generate token directly from username")
    void testGenerateTokenFromUsername_Success() {
        String token = tokenProvider.generateTokenFromUsername("direct-user");
        assertNotNull(token);
        assertEquals("direct-user", tokenProvider.getUsernameFromToken(token));
    }

    @Test
    @DisplayName("Should invalidate expired token")
    void testValidateToken_ExpiredToken() {
        // Force immediate expiration in the past
        setField(tokenProvider, "jwtExpirationMs", -1L);
        String token = tokenProvider.generateTokenFromUsername("expired-user");

        boolean isValid = tokenProvider.validateToken(token);
        assertFalse(isValid);
    }

    @Test
    @DisplayName("Should invalidate token signed with different secret")
    void testValidateToken_BadSignature() {
        JwtTokenProvider otherProvider = new JwtTokenProvider();
        setField(otherProvider, "jwtSecret", "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789");
        setField(otherProvider, "jwtExpirationMs", testExpiration);
        String token = otherProvider.generateTokenFromUsername("foreign-user");

        assertThrows(io.jsonwebtoken.security.SignatureException.class, () -> tokenProvider.validateToken(token));
    }

    @Test
    @DisplayName("Should invalidate empty token string")
    void testValidateToken_EmptyString() {
        assertFalse(tokenProvider.validateToken(""));
    }
}
