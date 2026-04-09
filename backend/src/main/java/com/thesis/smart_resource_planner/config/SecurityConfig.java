// src/main/java/com/thesis/smart_resource_planner/config/SecurityConfig.java
package com.thesis.smart_resource_planner.config;

import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.security.JwtAuthenticationFilter;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Central Spring Security configuration for the application.
 * Defines authentication providers, JWT filter placement, URL access rules,
 * CORS policy, and stateless session management.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

    private final UserDetailsService userDetailsService;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final EmployeeRepository employeeRepository;

    /**
     * Provides a BCrypt password encoder bean used for hashing and verifying
     * passwords.
     *
     * @return A {@link BCryptPasswordEncoder} instance.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Configures the DAO-based authentication provider with the application's
     * {@link UserDetailsService} and the BCrypt password encoder.
     *
     * @return A configured {@link DaoAuthenticationProvider}.
     */
    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    /**
     * Exposes the default {@link AuthenticationManager} as a Spring bean.
     * Required by the login endpoint to authenticate credentials.
     *
     * @param authConfig Spring's authentication configuration.
     * @return The application's {@link AuthenticationManager}.
     * @throws Exception if the manager cannot be initialized.
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig)
            throws Exception {
        return authConfig.getAuthenticationManager();
    }

    /**
     * Constructs the main HTTP security filter chain.
     * Disables CSRF (stateless JWT), configures CORS, sets stateless session
     * policy,
     * defines URL-level access rules, and places the JWT filter before the default
     * username/password filter.
     *
     * @param http The {@link HttpSecurity} builder.
     * @return The configured {@link SecurityFilterChain}.
     * @throws Exception if the chain cannot be built.
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/public/**").permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        .requestMatchers("/api/ai/**").authenticated()

                        // Safe principal casting with type check
                        .requestMatchers("/api/notifications/user/{userId}/**").access(
                                (authentication, context) -> {
                                    String userId = context.getVariables().get("userId");
                                    Authentication authInstance = authentication.get();

                                    // Check type before casting
                                    if (!(authInstance.getPrincipal() instanceof UserPrincipal)) {
                                        return new AuthorizationDecision(false);
                                    }

                                    UserPrincipal principal = (UserPrincipal) authInstance.getPrincipal();
                                    return new AuthorizationDecision(
                                            principal.getId().toString().equals(userId));
                                })
                        .requestMatchers("/api/employees/user/{userId}").access(
                                (authentication, context) -> {
                                    String userId = context.getVariables().get("userId");
                                    Authentication authInstance = authentication.get();

                                    // Check type before casting
                                    if (!(authInstance.getPrincipal() instanceof UserPrincipal)) {
                                        return new AuthorizationDecision(false);
                                    }

                                    UserPrincipal principal = (UserPrincipal) authInstance.getPrincipal();
                                    return new AuthorizationDecision(
                                            principal.getId().toString().equals(userId));
                                })

                        // Safe principal casting
                        .requestMatchers(HttpMethod.PUT, "/api/employees/{id}").access(
                                (authentication, context) -> {
                                    String employeeId = context.getVariables().get("id");
                                    Authentication authInstance = authentication.get();

                                    // Check type before casting
                                    if (!(authInstance.getPrincipal() instanceof UserPrincipal)) {
                                        return new AuthorizationDecision(false);
                                    }

                                    UserPrincipal principal = (UserPrincipal) authInstance.getPrincipal();

                                    // Admins and managers can update ANY employee
                                    if (principal.getAuthorities().stream()
                                            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") ||
                                                    a.getAuthority().equals("ROLE_MANAGER"))) {
                                        return new AuthorizationDecision(true);
                                    }

                                    // EMPLOYEES can update THEIR OWN profile
                                    try {
                                        UUID requestedEmployeeId = UUID.fromString(employeeId);
                                        Employee emp = employeeRepository.findById(requestedEmployeeId).orElse(null);

                                        if (emp == null) {
                                            return new AuthorizationDecision(false);
                                        }

                                        UUID employeeUserId = emp.getUser() != null ? emp.getUser().getId() : null;

                                        if (employeeUserId == null) {
                                            return new AuthorizationDecision(false);
                                        }

                                        boolean isOwnProfile = employeeUserId.equals(principal.getId());

                                        return new AuthorizationDecision(isOwnProfile);

                                    } catch (Exception e) {
                                        return new AuthorizationDecision(false);
                                    }
                                })

                        .requestMatchers("/api/chat/**").hasAnyRole("ADMIN", "MANAGER", "EMPLOYEE")
                        .anyRequest().authenticated())

                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Defines the CORS policy applied across all endpoints.
     * Allows localhost and the Docker frontend container as origins, permits all
     * standard
     * HTTP methods, and exposes relevant response headers for client-side
     * consumption.
     *
     * @return A {@link CorsConfigurationSource} applied globally.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOriginPatterns(Arrays.asList(
                "http://localhost:*",
                "http://127.0.0.1:*",
                "http://frontend:*"));

        configuration.setAllowedOrigins(Arrays.asList(
                "http://localhost:3000",
                "http://localhost:5173",
                "http://localhost:8080",
                "http://127.0.0.1:3000"));

        configuration.setAllowedMethods(Arrays.asList(
                "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"));

        configuration.setAllowedHeaders(List.of("*"));

        configuration.setExposedHeaders(Arrays.asList(
                "Authorization",
                "Content-Type",
                "X-Requested-With"));

        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}