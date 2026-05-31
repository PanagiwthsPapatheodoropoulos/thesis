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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("UserController Tests")
@SuppressWarnings("removal")
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserService userService;
    @MockBean
    private com.thesis.smart_resource_planner.repository.UserRepository userRepository;
    @MockBean
    private org.modelmapper.ModelMapper modelMapper;
    @MockBean
    private PasswordEncoder passwordEncoder;

    private UserDTO testUserDTO;
    private UUID userId;
    private UserUpdateDTO updateDTO;
    private UserPrincipal principal;
    private UserPrincipal selfPrincipal;

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

        User self = new User();
        self.setId(userId);
        self.setUsername("self");
        self.setEmail("self@example.com");
        self.setPasswordHash("hash");
        self.setRole(UserRole.USER);
        self.setCompany(company);
        selfPrincipal = UserPrincipal.create(self);
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

    @Test
    @DisplayName("Should remove user from company with reason")
    void testRemoveFromCompany_WithReason() throws Exception {
        doNothing().when(userService).removeUserFromCompany(userId, "BLOCKED");

        mockMvc.perform(patch("/api/users/{id}/remove-from-company?reason=BLOCKED", userId)
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNoContent());

        verify(userService, times(1)).removeUserFromCompany(userId, "BLOCKED");
    }

    @Test
    @DisplayName("Should remove user from company without reason")
    void testRemoveFromCompany_NoReason() throws Exception {
        doNothing().when(userService).removeUserFromCompany(userId, null);

        mockMvc.perform(patch("/api/users/{id}/remove-from-company", userId)
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNoContent());

        verify(userService, times(1)).removeUserFromCompany(eq(userId), isNull());
    }

    @Test
    @DisplayName("Should join company with status 200")
    void testJoinCompany_Success() throws Exception {
        UserDTO dto = new UserDTO();
        dto.setId(userId);
        when(userService.joinCompany(eq(userId), eq("CODE123"))).thenReturn(dto);

        mockMvc.perform(post("/api/users/{id}/join-company", userId)
                .with(user(selfPrincipal))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of("companyCode", "CODE123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(userId.toString()));

        verify(userService, times(1)).joinCompany(eq(userId), eq("CODE123"));
    }

    @Test
    @DisplayName("Should return 400 when company code missing")
    void testJoinCompany_MissingCode() throws Exception {
        mockMvc.perform(post("/api/users/{id}/join-company", userId)
                .with(user(selfPrincipal))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isBadRequest());

        verify(userService, never()).joinCompany(any(UUID.class), any(String.class));
    }

    @Test
    @DisplayName("Should retrieve user by username with status 200")
    void testGetUserByUsername_Success() throws Exception {
        when(userService.getUserByUsername("testuser")).thenReturn(testUserDTO);

        mockMvc.perform(get("/api/users/username/{username}", "testuser")
                        .with(user(principal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("testuser"));
    }

    @Test
    @DisplayName("Should retrieve user by email with status 200")
    void testGetUserByEmail_Success() throws Exception {
        when(userService.getUserByEmail("test@example.com")).thenReturn(testUserDTO);

        mockMvc.perform(get("/api/users/email/{email}", "test@example.com")
                        .with(user(principal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("test@example.com"));
    }

    @Test
    @DisplayName("Should retrieve users by role with status 200")
    void testGetUsersByRole_Success() throws Exception {
        when(userService.getUsersByRole(UserRole.EMPLOYEE)).thenReturn(Arrays.asList(testUserDTO));

        mockMvc.perform(get("/api/users/role/{role}", UserRole.EMPLOYEE)
                        .with(user(principal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        verify(userService).getUsersByRole(UserRole.EMPLOYEE);
    }

    @Test
    @DisplayName("Should reject update username when payload is empty")
    void testUpdateUsername_EmptyPayload() throws Exception {
        mockMvc.perform(patch("/api/users/{id}/username", userId)
                        .with(user(principal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Username cannot be empty"));
    }

    @Test
    @DisplayName("Should reject update username when duplicate username exists")
    void testUpdateUsername_Duplicate() throws Exception {
        User existing = new User();
        existing.setId(userId);
        existing.setUsername("current");
        when(userRepository.findById(userId)).thenReturn(java.util.Optional.of(existing));
        when(userRepository.existsByUsername("other")).thenReturn(true);

        mockMvc.perform(patch("/api/users/{id}/username", userId)
                        .with(user(principal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("username", "other"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Username already exists"));
    }

    @Test
    @DisplayName("Should update password with valid current password")
    void testUpdatePassword_Success() throws Exception {
        User existing = new User();
        existing.setId(userId);
        existing.setPasswordHash("hash");
        when(userRepository.findById(userId)).thenReturn(java.util.Optional.of(existing));
        when(passwordEncoder.matches("old", "hash")).thenReturn(true);
        when(passwordEncoder.encode("new")).thenReturn("encoded");

        mockMvc.perform(patch("/api/users/{id}/password", userId)
                        .with(user(principal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "currentPassword", "old",
                                "newPassword", "new"))))
                .andExpect(status().isOk());

        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("Should return bad request when current password is invalid")
    void testUpdatePassword_InvalidCurrentPassword() throws Exception {
        User existing = new User();
        existing.setId(userId);
        existing.setPasswordHash("hash");
        when(userRepository.findById(userId)).thenReturn(java.util.Optional.of(existing));
        when(passwordEncoder.matches("wrong", "hash")).thenReturn(false);

        mockMvc.perform(patch("/api/users/{id}/password", userId)
                        .with(user(principal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "currentPassword", "wrong",
                                "newPassword", "new"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Current password is incorrect"));
    }

    @Test
    @DisplayName("Should update preferences with status 200")
    void testUpdatePreferences_Success() throws Exception {
        mockMvc.perform(put("/api/users/{id}/preferences", userId)
                        .with(user(selfPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("preferences", "{\"email\":true}"))))
                .andExpect(status().isOk());

        verify(userService).updatePreferences(eq(userId), eq("{\"email\":true}"));
    }

    @Test
    @DisplayName("Should forbid non-admin role update attempt")
    void testUpdateUser_RoleChangeForbiddenForNonAdmin() throws Exception {
        User nonAdmin = new User();
        nonAdmin.setId(userId);
        nonAdmin.setUsername("emp");
        nonAdmin.setEmail("emp@example.com");
        nonAdmin.setPasswordHash("hash");
        nonAdmin.setRole(UserRole.EMPLOYEE);
        UserPrincipal employeePrincipal = UserPrincipal.create(nonAdmin);

        UserUpdateDTO roleUpdate = new UserUpdateDTO();
        roleUpdate.setRole(UserRole.ADMIN);

        mockMvc.perform(put("/api/users/{id}", userId)
                        .with(user(employeePrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(roleUpdate)))
                .andExpect(status().isForbidden());

        verify(userService, never()).updateUser(any(UUID.class), any(UserUpdateDTO.class));
    }
}
