package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.CompanyBlocklistCreateDTO;
import com.thesis.smart_resource_planner.model.dto.CompanyBlocklistEntryDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.CompanyBlocklistService;
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

import java.time.LocalDateTime;
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
@DisplayName("CompanyBlocklistController Dedicated Tests")
@SuppressWarnings("removal")
class CompanyBlocklistControllerDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CompanyBlocklistService blocklistService;

    private CompanyBlocklistEntryDTO entryDTO;
    private CompanyBlocklistCreateDTO createDTO;
    private UserPrincipal adminPrincipal;
    private UUID adminUserId;
    private UUID entryId;

    @BeforeEach
    void setUp() {
        adminUserId = UUID.randomUUID();
        entryId = UUID.randomUUID();

        entryDTO = CompanyBlocklistEntryDTO.builder()
                .id(entryId)
                .email("blocked@example.com")
                .createdAt(LocalDateTime.now())
                .build();

        createDTO = new CompanyBlocklistCreateDTO();
        createDTO.setEmail("blocked@example.com");

        Company company = new Company();
        company.setId(UUID.randomUUID());

        User admin = new User();
        admin.setId(adminUserId);
        admin.setUsername("adminUser");
        admin.setEmail("admin@example.com");
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);
        adminPrincipal = UserPrincipal.create(admin);
    }

    @Test
    @DisplayName("Should retrieve blocklist entries successfully")
    void testGetBlocklist_Success() throws Exception {
        when(blocklistService.getBlocklist(adminUserId)).thenReturn(Arrays.asList(entryDTO));

        mockMvc.perform(get("/api/blocklist")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value("blocked@example.com"))
                .andExpect(jsonPath("$[0].id").value(entryId.toString()));

        verify(blocklistService, times(1)).getBlocklist(adminUserId);
    }

    @Test
    @DisplayName("Should block an email successfully")
    void testBlockEmail_Success() throws Exception {
        when(blocklistService.blockEmail(eq(adminUserId), any(CompanyBlocklistCreateDTO.class))).thenReturn(entryDTO);

        mockMvc.perform(post("/api/blocklist")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("blocked@example.com"));

        verify(blocklistService, times(1)).blockEmail(eq(adminUserId), any(CompanyBlocklistCreateDTO.class));
    }

    @Test
    @DisplayName("Should unblock an email successfully")
    void testUnblockEmail_Success() throws Exception {
        doNothing().when(blocklistService).unblock(adminUserId, entryId);

        mockMvc.perform(delete("/api/blocklist/{id}", entryId)
                        .with(user(adminPrincipal)))
                .andExpect(status().isNoContent());

        verify(blocklistService, times(1)).unblock(adminUserId, entryId);
    }
}
