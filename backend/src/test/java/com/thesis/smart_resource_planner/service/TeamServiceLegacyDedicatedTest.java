package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.TeamDTO;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Team;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.ChatMessageRepository;
import com.thesis.smart_resource_planner.repository.TeamRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TeamService Tests")
class TeamServiceLegacyDedicatedTest {

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private ModelMapper modelMapper;

    @Mock
    private ChatMessageRepository chatMessageRepository;

    @InjectMocks
    private TeamService teamService;

    private Team testTeam;
    private TeamDTO testTeamDTO;
    private UUID teamId;
    private UUID userId;
    private Company company;
    private User user;

    @BeforeEach
    void setUp() {
        teamId = UUID.randomUUID();
        userId = UUID.randomUUID();
        company = new Company();
        company.setId(UUID.randomUUID());
        user = new User();
        user.setId(userId);
        user.setCompany(company);
        user.setRole(UserRole.EMPLOYEE);

        testTeam = new Team();
        testTeam.setId(teamId);
        testTeam.setName("Development Team");
        testTeam.setDescription("Main development team");

        testTeamDTO = new TeamDTO();
        testTeamDTO.setId(teamId);
        testTeamDTO.setName("Development Team");
        testTeamDTO.setDescription("Main development team");
    }

    @Test
    @DisplayName("Should retrieve team by ID successfully")
    void testGetTeamById_Success() {
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(testTeam));
        when(modelMapper.map(testTeam, TeamDTO.class)).thenReturn(testTeamDTO);

        TeamDTO result = teamService.getTeamById(teamId);

        assertNotNull(result);
        assertEquals(testTeamDTO.getId(), result.getId());
        verify(teamRepository, times(1)).findById(teamId);
    }

    @Test
    @DisplayName("Should throw exception when team not found")
    void testGetTeamById_NotFound() {
        when(teamRepository.findById(teamId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> teamService.getTeamById(teamId));
    }

    @Test
    @DisplayName("Should create team successfully scoped to user's company")
    void testCreateTeam_Success() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(teamRepository.existsByName("Development Team")).thenReturn(false);
        when(modelMapper.map(testTeamDTO, Team.class)).thenReturn(testTeam);
        when(teamRepository.save(any(Team.class))).thenReturn(testTeam);
        when(modelMapper.map(testTeam, TeamDTO.class)).thenReturn(testTeamDTO);

        TeamDTO result = teamService.createTeam(testTeamDTO, userId);

        assertNotNull(result);
        verify(teamRepository).save(any(Team.class));
    }

    @Test
    @DisplayName("createTeam throws on duplicate name")
    void testCreateTeam_Duplicate() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(teamRepository.existsByName("Development Team")).thenReturn(true);

        assertThrows(DuplicateResourceException.class, () -> teamService.createTeam(testTeamDTO, userId));
    }

    @Test
    @DisplayName("getAllTeams uses member-count projection")
    void testGetAllTeams_Success() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        Object[] row = new Object[] { teamId, "Development Team", "Main development team", company.getId(),
                LocalDateTime.now(), LocalDateTime.now(), 2 };
        when(teamRepository.findTeamsWithMemberCountByCompanyId(company.getId())).thenReturn(List.<Object[]>of(row));

        List<TeamDTO> result = teamService.getAllTeams(userId);
        assertEquals(1, result.size());
        assertEquals(2, result.get(0).getMemberCount());
    }

    @Test
    @DisplayName("getTeamWithMembers populates members and count")
    void testGetTeamWithMembers_Success() {
        when(teamRepository.findByIdWithMembers(teamId)).thenReturn(Optional.of(testTeam));
        when(modelMapper.map(testTeam, TeamDTO.class)).thenReturn(new TeamDTO());
        when(userRepository.findByTeamId(teamId)).thenReturn(List.of(user));

        TeamDTO result = teamService.getTeamWithMembers(teamId);
        assertNotNull(result.getMembers());
        assertEquals(1, result.getMemberCount());
        assertEquals(userId, result.getMembers().get(0).getUserId());
    }

    @Test
    @DisplayName("deleteTeam throws when user unauthorized")
    void deleteTeam_unauthorized() {
        UUID otherCompanyTeamId = UUID.randomUUID();
        Team otherTeam = new Team();
        otherTeam.setId(otherCompanyTeamId);
        Company otherCompany = new Company();
        otherCompany.setId(UUID.randomUUID());
        otherTeam.setCompany(otherCompany);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(teamRepository.findById(otherCompanyTeamId)).thenReturn(Optional.of(otherTeam));

        assertThrows(SecurityException.class, () -> teamService.deleteTeam(otherCompanyTeamId, userId));
    }

    @Test
    @DisplayName("deleteTeam removes members and deletes team")
    void deleteTeam_success() {
        testTeam.setCompany(company);
        user.setTeam(testTeam);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(testTeam));
        when(userRepository.findByTeamId(teamId)).thenReturn(List.of(user));

        teamService.deleteTeam(teamId, userId);

        verify(userRepository, atLeastOnce()).save(any(User.class));
        verify(teamRepository).deleteById(teamId);
    }
}
