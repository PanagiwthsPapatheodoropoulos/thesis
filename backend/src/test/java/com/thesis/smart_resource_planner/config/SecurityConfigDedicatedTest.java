package com.thesis.smart_resource_planner.config;

import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Objects;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SecurityConfigDedicatedTest {

    private SecurityConfig config;

    @BeforeEach
    void setUp() {
        UserDetailsService userDetailsService = mock(UserDetailsService.class);
        JwtAuthenticationFilter jwtFilter = mock(JwtAuthenticationFilter.class);
        EmployeeRepository employeeRepository = mock(EmployeeRepository.class);
        config = new SecurityConfig(userDetailsService, jwtFilter, employeeRepository);
    }

    @Test
    void passwordEncoderAndAuthenticationProviderBeans() {
        assertTrue(config.passwordEncoder() instanceof BCryptPasswordEncoder);

        DaoAuthenticationProvider provider = config.authenticationProvider();
        assertNotNull(provider);
    }

    @Test
    void corsConfigurationSourceContainsExpectedRules() {
        CorsConfigurationSource source = config.corsConfigurationSource();
        assertTrue(source instanceof UrlBasedCorsConfigurationSource);
        CorsConfiguration cors = ((UrlBasedCorsConfigurationSource) source)
                .getCorsConfiguration(new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/x"));
        assertNotNull(cors);
        assertTrue(Objects.requireNonNull(cors.getAllowedMethods()).contains("PATCH"));
        assertTrue(Objects.requireNonNull(cors.getAllowedOrigins()).contains("http://localhost:5173"));
        assertTrue(Objects.requireNonNull(cors.getAllowedOriginPatterns()).contains("http://localhost:*"));
        assertTrue(Objects.requireNonNull(cors.getExposedHeaders()).contains("Authorization"));
        assertTrue(Boolean.TRUE.equals(cors.getAllowCredentials()));
        assertEquals(3600L, cors.getMaxAge());
    }

    @Test
    void authenticationManagerBeanDelegatesToConfiguration() throws Exception {
        AuthenticationConfiguration authConfig = mock(AuthenticationConfiguration.class);
        AuthenticationManager authManager = mock(AuthenticationManager.class);
        when(authConfig.getAuthenticationManager()).thenReturn(authManager);

        AuthenticationManager result = config.authenticationManager(authConfig);
        assertSame(authManager, result);
    }
}
