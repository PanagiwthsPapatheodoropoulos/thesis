package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.UserDTO;
import com.thesis.smart_resource_planner.model.dto.UserUpdateDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.UserService;
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

import java.util.Arrays;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("UserController Tests")
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserService userService;

    private UserDTO testUserDTO;
    private UUID userId;
    private UserUpdateDTO updateDTO;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        testUserDTO = new UserDTO();
        testUserDTO.setId(userId);
        testUserDTO.setUsername("testuser");
        testUserDTO.setEmail("test@example.com");

        updateDTO = new UserUpdateDTO();
        updateDTO.setEmail("updated@example.com");

        Company company = new Company();
        company.setId(UUID.randomUUID());
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setUsername("admin");
        u.setEmail("admin@example.com");
        u.setPasswordHash("hash");
        u.setRole(UserRole.ADMIN);
        u.setCompany(company);
        principal = UserPrincipal.create(u);
    }

    @Test
    @DisplayName("Should retrieve user by ID with status 200")
    void testGetUserById_Success() throws Exception {
        when(userService.getUserById(userId)).thenReturn(testUserDTO);

        mockMvc.perform(get("/api/users/{id}", userId)
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(userId.toString()))
                .andExpect(jsonPath("$.username").value("testuser"));

        verify(userService, times(1)).getUserById(userId);
    }

    @Test
    @DisplayName("Should return 404 when user not found")
    void testGetUserById_NotFound() throws Exception {
        when(userService.getUserById(userId)).thenThrow(new com.thesis.smart_resource_planner.exception.ResourceNotFoundException("User not found"));

        mockMvc.perform(get("/api/users/{id}", userId)
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());

        verify(userService, times(1)).getUserById(userId);
    }

    @Test
    @DisplayName("Should retrieve all users with status 200")
    void testGetAllUsers_Success() throws Exception {
        when(userService.getAllUsers(any(UUID.class))).thenReturn(Arrays.asList(testUserDTO));

        mockMvc.perform(get("/api/users")
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        verify(userService, times(1)).getAllUsers(any(UUID.class));
    }

    @Test
    @DisplayName("Should update user with status 200")
    void testUpdateUser_Success() throws Exception {
        when(userService.updateUser(eq(userId), any(UserUpdateDTO.class))).thenReturn(testUserDTO);

        mockMvc.perform(put("/api/users/{id}", userId)
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateDTO)))
                .andExpect(status().isOk());

        verify(userService, times(1)).updateUser(eq(userId), any(UserUpdateDTO.class));
    }

    @Test
    @DisplayName("Should delete user with status 204")
    void testDeleteUser_Success() throws Exception {
        doNothing().when(userService).deleteUser(userId);

        mockMvc.perform(delete("/api/users/{id}", userId).with(user(principal)))
                .andExpect(status().isNoContent());

        verify(userService, times(1)).deleteUser(userId);
    }
}
