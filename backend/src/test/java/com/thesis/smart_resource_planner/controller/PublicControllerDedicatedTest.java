package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.CompanyBlocklistRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
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

import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("PublicController Dedicated Tests")
@SuppressWarnings("removal")
class PublicControllerDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private CompanyBlocklistRepository blocklistRepository;

    private User testUser;
    private Company testCompany;

    @BeforeEach
    void setUp() {
        testCompany = new Company();
        testCompany.setId(UUID.randomUUID());
        testCompany.setName("Acme Inc");

        testUser = new User();
        testUser.setId(UUID.randomUUID());
        testUser.setUsername("testuser");
        testUser.setEmail("testuser@example.com");
        testUser.setStatus(com.thesis.smart_resource_planner.model.enums.UserStatus.ONLINE);
        testUser.setCompany(testCompany);
    }

    @Test
    @DisplayName("Should return NOT_FOUND if identifier is empty or whitespace")
    void testGetApprovalStatus_EmptyIdentifier() throws Exception {
        mockMvc.perform(get("/api/public/approval-status")
                        .param("identifier", "   "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("Should return APPROVED and companyName if user exists and is active")
    void testGetApprovalStatus_UserApproved() throws Exception {
        when(userRepository.findByUsernameOrEmail("testuser", "testuser")).thenReturn(Optional.of(testUser));

        mockMvc.perform(get("/api/public/approval-status")
                        .param("identifier", "testuser"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.companyName").value("Acme Inc"));

        verify(userRepository, times(1)).findByUsernameOrEmail("testuser", "testuser");
    }

    // User pending test removed because isActive no longer exists and users are always APPROVED if present.

    @Test
    @DisplayName("Should return BLOCKED if identifier is email and blocklisted")
    void testGetApprovalStatus_UserBlocked() throws Exception {
        when(userRepository.findByUsernameOrEmail("blocked@example.com", "blocked@example.com"))
                .thenReturn(Optional.empty());
        when(blocklistRepository.existsByEmailIgnoreCase("blocked@example.com")).thenReturn(true);

        mockMvc.perform(get("/api/public/approval-status")
                        .param("identifier", "blocked@example.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BLOCKED"));

        verify(blocklistRepository, times(1)).existsByEmailIgnoreCase("blocked@example.com");
    }

    @Test
    @DisplayName("Should return NOT_FOUND if user not found and not blocked")
    void testGetApprovalStatus_UserNotFound() throws Exception {
        when(userRepository.findByUsernameOrEmail("unknown", "unknown")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/public/approval-status")
                        .param("identifier", "unknown"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_FOUND"));
    }
}
