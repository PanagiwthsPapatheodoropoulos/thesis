package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.model.dto.LoginRequestDTO;
import com.thesis.smart_resource_planner.model.dto.LoginResponseDTO;
import com.thesis.smart_resource_planner.model.dto.UserDTO;
import com.thesis.smart_resource_planner.model.dto.UserRegistrationDTO;
import com.thesis.smart_resource_planner.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("AuthController Tests")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    private LoginRequestDTO loginRequest;
    private LoginResponseDTO loginResponse;
    private UserDTO registeredUser;

    @BeforeEach
    void setUp() {
        loginRequest = new LoginRequestDTO();
        loginRequest.setUsernameOrEmail("testuser");
        loginRequest.setPassword("password123");

        loginResponse = new LoginResponseDTO();
        loginResponse.setToken("jwt-token");

        registeredUser = new UserDTO();
        registeredUser.setUsername("newuser");
        registeredUser.setEmail("new@example.com");
    }

    @Test
    @DisplayName("Should login successfully with status 200")
    void testLogin_Success() throws Exception {
        when(authService.login(any())).thenReturn(loginResponse);

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-token"));

        verify(authService, times(1)).login(any());
    }

    @Test
    @DisplayName("Should return 400 for invalid login credentials")
    void testLogin_BadCredentials() throws Exception {
        when(authService.login(any())).thenThrow(new org.springframework.security.authentication.BadCredentialsException("Invalid credentials"));

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isUnauthorized());

        verify(authService, times(1)).login(any());
    }

    @Test
    @DisplayName("Should register user successfully with status 201")
    void testRegister_Success() throws Exception {
        UserRegistrationDTO registrationDTO = new UserRegistrationDTO();
        registrationDTO.setUsername("newuser");
        registrationDTO.setEmail("new@example.com");
        registrationDTO.setPassword("password123");

        when(authService.register(any())).thenReturn(registeredUser);

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(registrationDTO)))
                .andExpect(status().isCreated());

        verify(authService, times(1)).register(any());
    }

    @Test
    @DisplayName("Should return 409 for duplicate username")
    void testRegister_DuplicateUsername() throws Exception {
        UserRegistrationDTO registrationDTO = new UserRegistrationDTO();
        registrationDTO.setUsername("testuser");
        registrationDTO.setEmail("new@example.com");
        registrationDTO.setPassword("password123");

        when(authService.register(any()))
                .thenThrow(new com.thesis.smart_resource_planner.exception.DuplicateResourceException("Username already exists"));

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(registrationDTO)))
                .andExpect(status().isConflict());

        verify(authService, times(1)).register(any());
    }
}
