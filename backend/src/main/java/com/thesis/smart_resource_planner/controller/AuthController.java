package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.exception.UnauthorizedException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.UserRepository;
import com.thesis.smart_resource_planner.security.JwtTokenProvider;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller for handling authentication and registration operations.
 * Provides endpoints for login, user registration, company registration, and
 * token refresh.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final JwtTokenProvider tokenProvider;
    private final ModelMapper modelMapper;

    /**
     * Authenticates a user and generates a JWT.
     *
     * @param loginRequest The login credentials.
     * @return ResponseEntity containing the authentication token and user details.
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(@Valid @RequestBody LoginRequestDTO loginRequest) {
        // Process user login
        LoginResponseDTO response = authService.login(loginRequest);
        return ResponseEntity.ok(response);
    }

    /**
     * Registers a new user.
     *
     * @param registrationDTO Data for the new user.
     * @return ResponseEntity containing the registered user details.
     */
    @PostMapping("/register")
    public ResponseEntity<UserDTO> register(@Valid @RequestBody UserRegistrationDTO registrationDTO) {
        // Register standard user
        UserDTO user = authService.register(registrationDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    /**
     * Registers a new company along with its primary administrator.
     *
     * @param registrationDTO Data for the new company and admin user.
     * @return ResponseEntity containing the registered company and admin details.
     */
    @PostMapping("/register-company")
    public ResponseEntity<CompanyRegistrationResponseDTO> registerCompany(
            @Valid @RequestBody CompanyRegistrationDTO registrationDTO) {
        // Register company and its initial admin
        CompanyRegistrationResponseDTO response = authService.registerCompany(registrationDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Refreshes the authentication token using either the current session
     * (authenticated user) or a refresh token sent in the request body.
     * Issues both a new access token and a new refresh token (rotation).
     *
     * @param currentUser   The currently authenticated user principal (may be null
     *                      if using refresh token).
     * @param body          Optional request body containing a "refreshToken" field.
     * @return ResponseEntity containing the new access and refresh tokens.
     */
    @PostMapping("/refresh")
    public ResponseEntity<LoginResponseDTO> refreshToken(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestBody(required = false) Map<String, String> body) {

        String username = null;

        // Strategy 1: Use refresh token from request body
        if (body != null && body.containsKey("refreshToken")) {
            String refreshToken = body.get("refreshToken");
            if (tokenProvider.validateToken(refreshToken)) {
                username = tokenProvider.getUsernameFromToken(refreshToken);
            } else {
                throw new UnauthorizedException("Invalid or expired refresh token");
            }
        }
        // Strategy 2: Use the currently authenticated user (existing behavior)
        else if (currentUser != null) {
            username = currentUser.getUsername();
        }

        if (username == null) {
            throw new UnauthorizedException("No valid authentication provided for token refresh");
        }

        // Fetch current user from DB
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Generate new access + refresh token pair (rotation)
        String newAccessToken = tokenProvider.generateTokenFromUsername(user.getUsername());
        String newRefreshToken = tokenProvider.generateRefreshToken(user.getUsername());
        UserDTO userDTO = modelMapper.map(user, UserDTO.class);

        return ResponseEntity.ok(LoginResponseDTO.builder()
                .token(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .user(userDTO)
                .build());
    }
}