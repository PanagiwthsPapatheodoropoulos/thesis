package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.SkillDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.SkillService;
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
@DisplayName("SkillController Dedicated Tests")
@SuppressWarnings("removal")
class SkillControllerDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SkillService skillService;

    private SkillDTO testSkillDTO;
    private UserPrincipal adminPrincipal;
    private UUID skillId;

    @BeforeEach
    void setUp() {
        skillId = UUID.randomUUID();

        testSkillDTO = new SkillDTO();
        testSkillDTO.setId(skillId);
        testSkillDTO.setName("Java");
        testSkillDTO.setCategory("Backend");
        testSkillDTO.setDescription("Java programming skill");

        Company company = new Company();
        company.setId(UUID.randomUUID());

        User admin = new User();
        admin.setId(UUID.randomUUID());
        admin.setUsername("adminUser");
        admin.setEmail("admin@example.com");
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);
        adminPrincipal = UserPrincipal.create(admin);
    }

    @Test
    @DisplayName("Should create skill successfully")
    void testCreateSkill_Success() throws Exception {
        when(skillService.createSkill(any(SkillDTO.class))).thenReturn(testSkillDTO);

        mockMvc.perform(post("/api/skills")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testSkillDTO)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Java"))
                .andExpect(jsonPath("$.category").value("Backend"));

        verify(skillService, times(1)).createSkill(any(SkillDTO.class));
    }

    @Test
    @DisplayName("Should return 409 Conflict if skill creation fails but skill already exists")
    void testCreateSkill_Conflict() throws Exception {
        when(skillService.createSkill(any(SkillDTO.class))).thenThrow(new RuntimeException("Duplicate skill"));
        when(skillService.getSkillByName("Java")).thenReturn(testSkillDTO);

        mockMvc.perform(post("/api/skills")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testSkillDTO)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.name").value("Java"));

        verify(skillService, times(1)).createSkill(any(SkillDTO.class));
        verify(skillService, times(1)).getSkillByName("Java");
    }

    @Test
    @DisplayName("Should retrieve skill by ID")
    void testGetSkillById_Success() throws Exception {
        when(skillService.getSkillById(skillId)).thenReturn(testSkillDTO);

        mockMvc.perform(get("/api/skills/{id}", skillId)
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Java"));

        verify(skillService, times(1)).getSkillById(skillId);
    }

    @Test
    @DisplayName("Should retrieve skill by name")
    void testGetSkillByName_Success() throws Exception {
        when(skillService.getSkillByName("Java")).thenReturn(testSkillDTO);

        mockMvc.perform(get("/api/skills/name/{name}", "Java")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Java"));

        verify(skillService, times(1)).getSkillByName("Java");
    }

    @Test
    @DisplayName("Should retrieve all skills")
    void testGetAllSkills_Success() throws Exception {
        when(skillService.getAllSkills()).thenReturn(Arrays.asList(testSkillDTO));

        mockMvc.perform(get("/api/skills")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Java"));

        verify(skillService, times(1)).getAllSkills();
    }

    @Test
    @DisplayName("Should retrieve skills by category")
    void testGetSkillsByCategory_Success() throws Exception {
        when(skillService.getSkillsByCategory("Backend")).thenReturn(Arrays.asList(testSkillDTO));

        mockMvc.perform(get("/api/skills/category/{category}", "Backend")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Java"));

        verify(skillService, times(1)).getSkillsByCategory("Backend");
    }

    @Test
    @DisplayName("Should get or create skill dynamically")
    void testGetOrCreateSkill_Success() throws Exception {
        when(skillService.getOrCreateSkill("Java")).thenReturn(testSkillDTO);

        mockMvc.perform(post("/api/skills/get-or-create")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Java"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Java"));

        verify(skillService, times(1)).getOrCreateSkill("Java");
    }

    @Test
    @DisplayName("Should return 400 Bad Request on getOrCreateSkill when name is missing")
    void testGetOrCreateSkill_MissingName() throws Exception {
        mockMvc.perform(post("/api/skills/get-or-create")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(skillService);
    }

    @Test
    @DisplayName("Should update skill successfully")
    void testUpdateSkill_Success() throws Exception {
        when(skillService.updateSkill(eq(skillId), any(SkillDTO.class))).thenReturn(testSkillDTO);

        mockMvc.perform(put("/api/skills/{id}", skillId)
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testSkillDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Java"));

        verify(skillService, times(1)).updateSkill(eq(skillId), any(SkillDTO.class));
    }

    @Test
    @DisplayName("Should delete skill successfully")
    void testDeleteSkill_Success() throws Exception {
        doNothing().when(skillService).deleteSkill(skillId);

        mockMvc.perform(delete("/api/skills/{id}", skillId)
                        .with(user(adminPrincipal)))
                .andExpect(status().isNoContent());

        verify(skillService, times(1)).deleteSkill(skillId);
    }
}
