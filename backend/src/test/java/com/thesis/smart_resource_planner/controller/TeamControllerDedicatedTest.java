package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.TeamDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TeamService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
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
@DisplayName("TeamController Dedicated Tests")
@SuppressWarnings("removal")
class TeamControllerDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TeamService teamService;

    private TeamDTO testTeamDTO;
    private UserPrincipal adminPrincipal;
    private UserPrincipal employeePrincipal;
    private UUID teamId;
    private UUID adminUserId;
    private UUID employeeUserId;

    @BeforeEach
    void setUp() {
        teamId = UUID.randomUUID();
        adminUserId = UUID.randomUUID();
        employeeUserId = UUID.randomUUID();

        testTeamDTO = new TeamDTO();
        testTeamDTO.setId(teamId);
        testTeamDTO.setName("Alpha Team");
        testTeamDTO.setDescription("Core development team");

        Company company = new Company();
        company.setId(UUID.randomUUID());

        User admin = new User();
        admin.setId(adminUserId);
        admin.setUsername("adminUser");
        admin.setEmail("admin@example.com");
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);
        adminPrincipal = UserPrincipal.create(admin);

        User employee = new User();
        employee.setId(employeeUserId);
        employee.setUsername("employeeUser");
        employee.setEmail("emp@example.com");
        employee.setRole(UserRole.EMPLOYEE);
        employee.setCompany(company);
        employeePrincipal = UserPrincipal.create(employee);
    }

    @Test
    @DisplayName("Should create team successfully when requested by ADMIN")
    void testCreateTeam_Success() throws Exception {
        when(teamService.createTeam(any(TeamDTO.class), eq(adminUserId))).thenReturn(testTeamDTO);

        mockMvc.perform(post("/api/teams")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testTeamDTO)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Alpha Team"));

        verify(teamService, times(1)).createTeam(any(TeamDTO.class), eq(adminUserId));
    }

    @Test
    @DisplayName("Should retrieve team details for EMPLOYEE if they are a member")
    void testGetTeamById_Employee_Success() throws Exception {
        when(teamService.isUserMemberOfTeam(teamId, employeeUserId)).thenReturn(true);
        when(teamService.getTeamWithMembers(teamId)).thenReturn(testTeamDTO);

        mockMvc.perform(get("/api/teams/{id}", teamId)
                        .with(user(employeePrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Alpha Team"));

        verify(teamService, times(1)).isUserMemberOfTeam(teamId, employeeUserId);
        verify(teamService, times(1)).getTeamWithMembers(teamId);
    }

    @Test
    @DisplayName("Should return 403 Forbidden for EMPLOYEE if they are not a member")
    void testGetTeamById_Employee_Forbidden() throws Exception {
        when(teamService.isUserMemberOfTeam(teamId, employeeUserId)).thenReturn(false);

        mockMvc.perform(get("/api/teams/{id}", teamId)
                        .with(user(employeePrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());

        verify(teamService, times(1)).isUserMemberOfTeam(teamId, employeeUserId);
        verify(teamService, never()).getTeamWithMembers(any(UUID.class));
    }

    @Test
    @DisplayName("Should add member to team successfully")
    void testAddMemberToTeam_Success() throws Exception {
        UUID newUserId = UUID.randomUUID();
        doNothing().when(teamService).addMemberToTeam(teamId, newUserId);

        mockMvc.perform(post("/api/teams/{teamId}/members/{userId}", teamId, newUserId)
                        .with(user(adminPrincipal)))
                .andExpect(status().isOk());

        verify(teamService, times(1)).addMemberToTeam(teamId, newUserId);
    }

    @Test
    @DisplayName("Should remove member from team successfully")
    void testRemoveMemberFromTeam_Success() throws Exception {
        UUID memberId = UUID.randomUUID();
        doNothing().when(teamService).removeMemberFromTeam(teamId, memberId);

        mockMvc.perform(delete("/api/teams/{teamId}/members/{userId}", teamId, memberId)
                        .with(user(adminPrincipal)))
                .andExpect(status().isOk());

        verify(teamService, times(1)).removeMemberFromTeam(teamId, memberId);
    }

    @Test
    @DisplayName("Should retrieve teams for current authenticated user")
    void testGetMyTeams_Success() throws Exception {
        when(teamService.getTeamsForUser(employeeUserId)).thenReturn(Arrays.asList(testTeamDTO));

        mockMvc.perform(get("/api/teams/my-teams")
                        .with(user(employeePrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Alpha Team"));

        verify(teamService, times(1)).getTeamsForUser(employeeUserId);
    }

    @Test
    @DisplayName("Should retrieve all teams for ADMIN")
    void testGetAllTeams_Success() throws Exception {
        when(teamService.getAllTeams(adminUserId)).thenReturn(Arrays.asList(testTeamDTO));

        mockMvc.perform(get("/api/teams")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Alpha Team"));

        verify(teamService, times(1)).getAllTeams(adminUserId);
    }

    @Test
    @DisplayName("Should retrieve paginated list of teams for ADMIN")
    void testGetTeamsPaginated_Success() throws Exception {
        Page<TeamDTO> teamPage = new PageImpl<>(Arrays.asList(testTeamDTO));
        when(teamService.getTeamsPaginated(eq(adminUserId), any(Pageable.class))).thenReturn(teamPage);

        mockMvc.perform(get("/api/teams/paginated")
                        .param("page", "0")
                        .param("size", "10")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("Alpha Team"));

        verify(teamService, times(1)).getTeamsPaginated(eq(adminUserId), any(Pageable.class));
    }

    @Test
    @DisplayName("Should update team successfully")
    void testUpdateTeam_Success() throws Exception {
        when(teamService.updateTeam(eq(teamId), any(TeamDTO.class))).thenReturn(testTeamDTO);

        mockMvc.perform(put("/api/teams/{id}", teamId)
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testTeamDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Alpha Team"));

        verify(teamService, times(1)).updateTeam(eq(teamId), any(TeamDTO.class));
    }

    @Test
    @DisplayName("Should delete team successfully")
    void testDeleteTeam_Success() throws Exception {
        doNothing().when(teamService).deleteTeam(teamId, adminUserId);

        mockMvc.perform(delete("/api/teams/{id}", teamId)
                        .with(user(adminPrincipal)))
                .andExpect(status().isNoContent());

        verify(teamService, times(1)).deleteTeam(teamId, adminUserId);
    }
}
