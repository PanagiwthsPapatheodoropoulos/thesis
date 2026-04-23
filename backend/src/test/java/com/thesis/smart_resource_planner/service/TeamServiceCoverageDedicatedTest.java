package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.TeamDTO;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.ChatMessageRepository;
import com.thesis.smart_resource_planner.repository.TeamRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TeamService Coverage - Gap Tests")
class TeamServiceCoverageDedicatedTest {

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

    private UUID userId;
    private UUID teamId;
    private Company company;
    private User admin;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        teamId = UUID.randomUUID();
        company = new Company();
        company.setId(UUID.randomUUID());
        admin = new User();
        admin.setId(userId);
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);
    }

    @Test
    @DisplayName("createTeam saves team with company from user")
    void createTeam_success() {
        TeamDTO dto = new TeamDTO();
        dto.setName("NewTeam");
        dto.setDescription("Desc");

        Team mapped = new Team();
        Team saved = new Team();
        saved.setId(teamId);
        TeamDTO result = new TeamDTO();
        result.setId(teamId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        when(teamRepository.existsByName("NewTeam")).thenReturn(false);
        when(modelMapper.map(dto, Team.class)).thenReturn(mapped);
        when(teamRepository.save(mapped)).thenReturn(saved);
        when(modelMapper.map(saved, TeamDTO.class)).thenReturn(result);

        TeamDTO created = teamService.createTeam(dto, userId);
        assertNotNull(created);
        assertEquals(teamId, created.getId());
        verify(teamRepository).save(mapped);
    }

    @Test
    @DisplayName("createTeam throws when user not found")
    void createTeam_userNotFound_throws() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> teamService.createTeam(new TeamDTO(), userId));
    }

    @Test
    @DisplayName("getTeamById returns mapped DTO")
    void getTeamById_success() {
        Team team = new Team();
        team.setId(teamId);
        TeamDTO dto = new TeamDTO();
        dto.setId(teamId);

        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(modelMapper.map(team, TeamDTO.class)).thenReturn(dto);

        assertEquals(teamId, teamService.getTeamById(teamId).getId());
    }

    @Test
    @DisplayName("getTeamById throws when not found")
    void getTeamById_notFound_throws() {
        when(teamRepository.findById(teamId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> teamService.getTeamById(teamId));
    }

    @Test
    @DisplayName("getTeamWithMembers returns DTO with member list and count")
    void getTeamWithMembers_returnsMembersAndCount() {
        Team team = new Team();
        team.setId(teamId);
        TeamDTO dto = new TeamDTO();
        dto.setId(teamId);

        User member1 = new User();
        member1.setId(UUID.randomUUID());
        member1.setUsername("u1");
        member1.setEmail("u1@x.com");
        member1.setRole(UserRole.EMPLOYEE);

        User member2 = new User();
        member2.setId(UUID.randomUUID());
        member2.setUsername("u2");
        member2.setEmail("u2@x.com");
        member2.setRole(UserRole.MANAGER);

        when(teamRepository.findByIdWithMembers(teamId)).thenReturn(Optional.of(team));
        when(modelMapper.map(team, TeamDTO.class)).thenReturn(dto);
        when(userRepository.findByTeamId(teamId)).thenReturn(List.of(member1, member2));

        TeamDTO result = teamService.getTeamWithMembers(teamId);
        assertEquals(2, result.getMemberCount());
        assertEquals(2, result.getMembers().size());
    }

    @Test
    @DisplayName("getAllTeams maps projection rows correctly")
    void getAllTeams_mapsProjectionRows() {
        LocalDateTime now = LocalDateTime.now();
        Object[] row1 = new Object[] { teamId, "Team1", "Desc1", null, now, now, 5L };
        Object[] row2 = new Object[] { UUID.randomUUID(), "Team2", "Desc2", null, now, now, 3L };

        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        when(teamRepository.findTeamsWithMemberCountByCompanyId(company.getId())).thenReturn(List.of(row1, row2));

        List<TeamDTO> result = teamService.getAllTeams(userId);
        assertEquals(2, result.size());
        assertEquals("Team1", result.get(0).getName());
        assertEquals(5, result.get(0).getMemberCount());
    }

    @Test
    @DisplayName("isUserMemberOfTeam returns false when user has no team")
    void isUserMemberOfTeam_noTeam_false() {
        User user = new User();
        user.setId(userId);
        user.setTeam(null);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        assertFalse(teamService.isUserMemberOfTeam(teamId, userId));
    }

    @Test
    @DisplayName("isUserMemberOfTeam returns false when team IDs differ")
    void isUserMemberOfTeam_differentTeam_false() {
        Team otherTeam = new Team();
        otherTeam.setId(UUID.randomUUID());
        User user = new User();
        user.setId(userId);
        user.setTeam(otherTeam);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        assertFalse(teamService.isUserMemberOfTeam(teamId, userId));
    }

    @Test
    @DisplayName("getUserTeamChats admin sees all company teams with empty messages")
    void getUserTeamChats_admin_emptyMessages() {
        Team team = new Team();
        team.setId(teamId);
        team.setName("Alpha");

        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        when(teamRepository.findByCompanyId(company.getId())).thenReturn(List.of(team));
        when(chatMessageRepository.findByTeamIdOrderByCreatedAtDesc(teamId)).thenReturn(List.of());
        when(userRepository.countByTeamId(teamId)).thenReturn(0L);

        var chats = teamService.getUserTeamChats(userId);
        assertEquals(1, chats.size());
        assertEquals("", chats.get(0).getLastMessage());
        assertNull(chats.get(0).getLastMessageTime());
    }

    @Test
    @DisplayName("getUserTeamChats regular user with no team returns empty list")
    void getUserTeamChats_noTeam_empty() {
        User user = new User();
        user.setId(userId);
        user.setRole(UserRole.EMPLOYEE);
        user.setCompany(company);
        user.setTeam(null);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        assertTrue(teamService.getUserTeamChats(userId).isEmpty());
    }

    @Test
    @DisplayName("addMemberToTeam continues when notification fails")
    void addMemberToTeam_notificationFails_recovers() {
        Team team = new Team();
        team.setId(teamId);
        team.setName("Alpha");

        User user = new User();
        UUID memberId = UUID.randomUUID();
        user.setId(memberId);

        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(userRepository.findById(memberId)).thenReturn(Optional.of(user));
        doThrow(new RuntimeException("notification error")).when(notificationService).createNotification(any());

        assertDoesNotThrow(() -> teamService.addMemberToTeam(teamId, memberId));
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("removeMemberFromTeam continues when notification fails")
    void removeMemberFromTeam_notificationFails_recovers() {
        Team team = new Team();
        team.setId(teamId);
        team.setName("Alpha");

        User user = new User();
        UUID memberId = UUID.randomUUID();
        user.setId(memberId);
        user.setTeam(team);

        when(userRepository.findById(memberId)).thenReturn(Optional.of(user));
        doThrow(new RuntimeException("notification error")).when(notificationService).createNotification(any());

        assertDoesNotThrow(() -> teamService.removeMemberFromTeam(teamId, memberId));
        assertNull(user.getTeam());
    }

    @Test
    @DisplayName("updateTeam updates name and description when valid")
    void updateTeam_updatesNameAndDescription() {
        Team team = new Team();
        team.setId(teamId);
        team.setName("OldName");
        team.setDescription("OldDesc");

        TeamDTO dto = new TeamDTO();
        dto.setName("NewName");
        dto.setDescription("NewDesc");

        Team saved = new Team();
        saved.setId(teamId);
        TeamDTO mapped = new TeamDTO();
        mapped.setId(teamId);

        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(teamRepository.existsByName("NewName")).thenReturn(false);
        when(teamRepository.save(team)).thenReturn(saved);
        when(modelMapper.map(saved, TeamDTO.class)).thenReturn(mapped);

        TeamDTO result = teamService.updateTeam(teamId, dto);
        assertNotNull(result);
        assertEquals("NewName", team.getName());
        assertEquals("NewDesc", team.getDescription());
    }

    @Test
    @DisplayName("updateTeam keeps same name when name unchanged")
    void updateTeam_sameName_skipsNameCheck() {
        Team team = new Team();
        team.setId(teamId);
        team.setName("Same");

        TeamDTO dto = new TeamDTO();
        dto.setName("Same");
        dto.setDescription("Updated desc");

        Team saved = new Team();
        TeamDTO mapped = new TeamDTO();

        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(teamRepository.save(team)).thenReturn(saved);
        when(modelMapper.map(saved, TeamDTO.class)).thenReturn(mapped);

        teamService.updateTeam(teamId, dto);
        verify(teamRepository, never()).existsByName(anyString());
    }

    @Test
    @DisplayName("deleteTeam removes members and deletes team")
    void deleteTeam_removesMembers() {
        Team team = new Team();
        team.setId(teamId);
        team.setCompany(company);

        User member = new User();
        member.setId(UUID.randomUUID());
        member.setTeam(team);

        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(userRepository.findByTeamId(teamId)).thenReturn(List.of(member));

        teamService.deleteTeam(teamId, userId);

        assertNull(member.getTeam());
        verify(userRepository).save(member);
        verify(teamRepository).deleteById(teamId);
    }
}
