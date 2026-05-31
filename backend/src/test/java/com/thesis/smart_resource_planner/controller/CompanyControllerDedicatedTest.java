package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.CompanyDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.BrevoEmailService;
import com.thesis.smart_resource_planner.service.CompanyService;
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
import java.util.Map;
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
@DisplayName("CompanyController Dedicated Tests")
@SuppressWarnings("removal")
class CompanyControllerDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CompanyService companyService;

    @MockBean
    private BrevoEmailService brevoEmailService;

    private CompanyDTO testCompanyDTO;
    private UserPrincipal adminPrincipal;
    private UserPrincipal superAdminPrincipal;
    private UUID companyId;
    private UUID adminUserId;

    @BeforeEach
    void setUp() {
        companyId = UUID.randomUUID();
        adminUserId = UUID.randomUUID();

        testCompanyDTO = new CompanyDTO();
        testCompanyDTO.setId(companyId);
        testCompanyDTO.setName("Acme Corp");
        testCompanyDTO.setJoinCode("JOIN123456");

        Company company = new Company();
        company.setId(companyId);
        company.setName("Acme Corp");

        User admin = new User();
        admin.setId(adminUserId);
        admin.setUsername("adminUser");
        admin.setEmail("admin@example.com");
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);
        adminPrincipal = UserPrincipal.create(admin);

        User superAdmin = new User();
        superAdmin.setId(UUID.randomUUID());
        superAdmin.setUsername("superAdmin");
        superAdmin.setEmail("super@example.com");
        superAdmin.setRole(UserRole.SUPER_ADMIN);
        superAdminPrincipal = UserPrincipal.create(superAdmin);
    }

    @Test
    @DisplayName("Should retrieve current user's company successfully")
    void testGetMyCompany_Success() throws Exception {
        when(companyService.getCompanyById(adminUserId)).thenReturn(testCompanyDTO);

        mockMvc.perform(get("/api/companies/my-company")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Acme Corp"))
                .andExpect(jsonPath("$.joinCode").value("JOIN123456"));

        verify(companyService, times(1)).getCompanyById(adminUserId);
    }

    @Test
    @DisplayName("Should retrieve all companies when user is SUPER_ADMIN")
    void testGetAllCompanies_Success() throws Exception {
        when(companyService.getAllCompanies()).thenReturn(Arrays.asList(testCompanyDTO));

        mockMvc.perform(get("/api/companies")
                        .with(user(superAdminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Acme Corp"));

        verify(companyService, times(1)).getAllCompanies();
    }

    @Test
    @DisplayName("Should regenerate join code successfully")
    void testRegenerateJoinCode_Success() throws Exception {
        when(companyService.regenerateJoinCode(companyId)).thenReturn("NEWCODE999");

        mockMvc.perform(post("/api/companies/{companyId}/regenerate-code", companyId)
                        .with(user(adminPrincipal)))
                .andExpect(status().isOk())
                .andExpect(content().string("NEWCODE999"));

        verify(companyService, times(1)).regenerateJoinCode(companyId);
    }

    @Test
    @DisplayName("Should email join code successfully")
    void testEmailJoinCode_Success() throws Exception {
        when(companyService.getCompanyById(adminUserId)).thenReturn(testCompanyDTO);
        doNothing().when(brevoEmailService).sendCompanyJoinCode("invitee@test.com", "adminUser", "Acme Corp", "JOIN123456");

        mockMvc.perform(post("/api/companies/email-join-code")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "invitee@test.com"))))
                .andExpect(status().isOk())
                .andExpect(content().string("Join code sent successfully"));

        verify(brevoEmailService, times(1))
                .sendCompanyJoinCode("invitee@test.com", "adminUser", "Acme Corp", "JOIN123456");
    }

    @Test
    @DisplayName("Should return 400 when email is missing from email-join-code payload")
    void testEmailJoinCode_MissingEmail() throws Exception {
        mockMvc.perform(post("/api/companies/email-join-code")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("Email is required"));

        verifyNoInteractions(companyService, brevoEmailService);
    }
}
