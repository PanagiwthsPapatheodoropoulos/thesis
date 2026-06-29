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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
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
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final JwtTokenProvider tokenProvider;
    private final ModelMapper modelMapper;

    @Value("${server.ssl.enabled:false}")
    private boolean sslEnabled;

    private HttpHeaders getCookieHeaders(String token, String refreshToken) {
        HttpHeaders headers = new HttpHeaders();
        ResponseCookie jwtCookie = ResponseCookie.from("jwt", token)
                .httpOnly(true)
                .secure(sslEnabled)
                .path("/")
                .maxAge(tokenProvider.getJwtExpirationMs() / 1000)
                .sameSite("Lax")
                .build();
        headers.add(HttpHeaders.SET_COOKIE, jwtCookie.toString());

        if (refreshToken != null) {
            ResponseCookie refreshCookie = ResponseCookie.from("refreshToken", refreshToken)
                    .httpOnly(true)
                    .secure(sslEnabled)
                    .path("/")
                    .maxAge(tokenProvider.getJwtRefreshExpirationMs() / 1000)
                    .sameSite("Lax")
                    .build();
            headers.add(HttpHeaders.SET_COOKIE, refreshCookie.toString());
        }
        return headers;
    }

    private HttpHeaders getCleanCookieHeaders() {
        HttpHeaders headers = new HttpHeaders();
        ResponseCookie jwtCookie = ResponseCookie.from("jwt", "")
                .httpOnly(true)
                .secure(sslEnabled)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        headers.add(HttpHeaders.SET_COOKIE, jwtCookie.toString());

        ResponseCookie refreshCookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(sslEnabled)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        headers.add(HttpHeaders.SET_COOKIE, refreshCookie.toString());
        return headers;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(@Valid @RequestBody LoginRequestDTO loginRequest) {
        LoginResponseDTO response = authService.login(loginRequest);
        HttpHeaders headers = getCookieHeaders(response.getToken(), response.getRefreshToken());

        // Remove tokens from response body for security
        response.setToken(null);
        response.setRefreshToken(null);

        return ResponseEntity.ok().headers(headers).body(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal UserPrincipal currentUser) {
        if (currentUser != null) {
            authService.logout(currentUser.getId());
        }
        return ResponseEntity.ok().headers(getCleanCookieHeaders()).build();
    }

    @PostMapping("/register")
    public ResponseEntity<UserDTO> register(@Valid @RequestBody UserRegistrationDTO registrationDTO) {
        UserDTO user = authService.register(registrationDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    @PostMapping("/register-company")
    public ResponseEntity<CompanyRegistrationResponseDTO> registerCompany(
            @Valid @RequestBody CompanyRegistrationDTO registrationDTO) {
        CompanyRegistrationResponseDTO response = authService.registerCompany(registrationDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponseDTO> refreshToken(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @CookieValue(name = "refreshToken", required = false) String refreshTokenCookie) {

        String username = null;

        // Use refresh token from HttpOnly cookie
        if (refreshTokenCookie != null && !refreshTokenCookie.isEmpty()) {
            if (tokenProvider.validateToken(refreshTokenCookie)) {
                username = tokenProvider.getUsernameFromToken(refreshTokenCookie);
            } else {
                throw new UnauthorizedException("Invalid or expired refresh token");
            }
        }
        // Use the currently authenticated user (existing behavior)
        else if (currentUser != null) {
            username = currentUser.getUsername();
        }

        if (username == null) {
            throw new UnauthorizedException("No valid authentication provided for token refresh");
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        String newAccessToken = tokenProvider.generateTokenFromUsername(user.getUsername());
        String newRefreshToken = tokenProvider.generateRefreshToken(user.getUsername());
        UserDTO userDTO = modelMapper.map(user, UserDTO.class);

        HttpHeaders headers = getCookieHeaders(newAccessToken, newRefreshToken);

        return ResponseEntity.ok().headers(headers).body(LoginResponseDTO.builder()
                .tokenType("Bearer")
                .user(userDTO)
                .build());
    }

    /**
     * Fetch current user based on the HTTP-only cookie.
     */
    @GetMapping("/me")
    public ResponseEntity<UserDTO> getCurrentUser(@AuthenticationPrincipal UserPrincipal currentUser) {
        if (currentUser == null) {
            throw new UnauthorizedException("Not authenticated");
        }
        User user = userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return ResponseEntity.ok(modelMapper.map(user, UserDTO.class));
    }
}