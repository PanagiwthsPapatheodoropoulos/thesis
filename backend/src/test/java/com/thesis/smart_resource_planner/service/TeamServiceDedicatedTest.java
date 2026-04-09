package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.model.dto.TeamDTO;
import com.thesis.smart_resource_planner.model.entity.ChatMessage;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Team;
import com.thesis.smart_resource_planner.model.entity.User;
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
import org.springframework.data.domain.PageRequest;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TeamServiceDedicatedTest {

    @Mock private TeamRepository teamRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;
    @Mock private ModelMapper modelMapper;
    @Mock private ChatMessageRepository chatMessageRepository;

    @InjectMocks private TeamService teamService;

    private UUID userId;
    private UUID teamId;
    private User admin;
    private Company company;

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
    @DisplayName("createTeam throws duplicate for existing name")
    void createTeam_duplicateName() {
        TeamDTO dto = new TeamDTO();
        dto.setName("Core");
        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        when(teamRepository.existsByName("Core")).thenReturn(true);
        assertThrows(DuplicateResourceException.class, () -> teamService.createTeam(dto, userId));
    }

    @Test
    @DisplayName("deleteTeam throws security exception for cross-company team")
    void deleteTeam_crossCompany_forbidden() {
        Team otherCompanyTeam = new Team();
        Company other = new Company();
        other.setId(UUID.randomUUID());
        otherCompanyTeam.setId(teamId);
        otherCompanyTeam.setCompany(other);

        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(otherCompanyTeam));

        assertThrows(SecurityException.class, () -> teamService.deleteTeam(teamId, userId));
    }

    @Test
    @DisplayName("getTeamsForUser returns empty when user has no team")
    void getTeamsForUser_empty() {
        admin.setTeam(null);
        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        assertTrue(teamService.getTeamsForUser(userId).isEmpty());
    }

    @Test
    @DisplayName("getTeamsPaginated maps projection rows")
    void getTeamsPaginated_projection() {
        Object[] row = new Object[] { teamId, "Alpha", "Desc", null, null, null, 3L };
        org.springframework.data.domain.Page<Object[]> page =
                new org.springframework.data.domain.PageImpl<Object[]>(
                        java.util.Collections.singletonList(row),
                        PageRequest.of(0, 10),
                        1);
        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        when(teamRepository.findTeamsWithMemberCountByCompanyIdPaginated(eq(company.getId()), any())).thenReturn(page);
        var result = teamService.getTeamsPaginated(userId, PageRequest.of(0, 10));
        assertEquals(1, result.getContent().size());
        assertEquals("Alpha", result.getContent().get(0).getName());
    }

    @Test
    @DisplayName("addMemberToTeam assigns user to team")
    void addMemberToTeam_success() {
        Team team = new Team();
        team.setId(teamId);
        team.setName("Alpha");

        User user = new User();
        UUID memberId = UUID.randomUUID();
        user.setId(memberId);
        user.setCompany(company);

        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(userRepository.findById(memberId)).thenReturn(Optional.of(user));

        teamService.addMemberToTeam(teamId, memberId);

        assertNotNull(user.getTeam());
        assertEquals(teamId, user.getTeam().getId());
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("removeMemberFromTeam throws when user is not member")
    void removeMemberFromTeam_notMember_throws() {
        User user = new User();
        UUID memberId = UUID.randomUUID();
        user.setId(memberId);
        user.setCompany(company);
        user.setTeam(null);

        when(userRepository.findById(memberId)).thenReturn(Optional.of(user));

        assertThrows(IllegalArgumentException.class, () -> teamService.removeMemberFromTeam(teamId, memberId));
    }

    @Test
    @DisplayName("removeMemberFromTeam clears team when user is member")
    void removeMemberFromTeam_success() {
        Team team = new Team();
        team.setId(teamId);
        team.setName("Alpha");

        User user = new User();
        UUID memberId = UUID.randomUUID();
        user.setId(memberId);
        user.setCompany(company);
        user.setTeam(team);

        when(userRepository.findById(memberId)).thenReturn(Optional.of(user));

        teamService.removeMemberFromTeam(teamId, memberId);

        assertNull(user.getTeam());
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("getUserTeamChats returns current team chat for regular member")
    void getUserTeamChats_regularUser_singleTeam() {
        Team team = new Team();
        team.setId(teamId);
        team.setName("Alpha");

        User member = new User();
        member.setId(UUID.randomUUID());
        member.setRole(UserRole.EMPLOYEE);
        member.setCompany(company);
        member.setTeam(team);

        ChatMessage last = new ChatMessage();
        last.setMessage("latest");
        last.setCreatedAt(java.time.LocalDateTime.now());

        when(userRepository.findById(member.getId())).thenReturn(Optional.of(member));
        when(chatMessageRepository.findByTeamIdOrderByCreatedAtDesc(teamId)).thenReturn(List.of(last));
        when(userRepository.countByTeamId(teamId)).thenReturn(2L);

        var chats = teamService.getUserTeamChats(member.getId());
        assertEquals(1, chats.size());
        assertEquals("Alpha", chats.get(0).getTeamName());
        assertEquals("latest", chats.get(0).getLastMessage());
    }

    @Test
    @DisplayName("isUserMemberOfTeam returns true when team matches")
    void isUserMemberOfTeam_true() {
        Team team = new Team();
        team.setId(teamId);
        User member = new User();
        UUID memberId = UUID.randomUUID();
        member.setId(memberId);
        member.setTeam(team);

        when(userRepository.findById(memberId)).thenReturn(Optional.of(member));
        assertTrue(teamService.isUserMemberOfTeam(teamId, memberId));
    }

    @Test
    @DisplayName("getTeamsForUser returns team when assigned")
    void getTeamsForUser_withTeam_returnsOne() {
        Team team = new Team();
        team.setId(teamId);
        team.setName("Alpha");
        admin.setTeam(team);

        TeamDTO mapped = new TeamDTO();
        mapped.setId(teamId);
        mapped.setName("Alpha");
        mapped.setMembers(List.of());

        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        when(teamRepository.findByIdWithMembers(teamId)).thenReturn(Optional.of(team));
        when(userRepository.findByTeamId(teamId)).thenReturn(List.of());
        when(modelMapper.map(eq(team), eq(TeamDTO.class))).thenReturn(mapped);

        var result = teamService.getTeamsForUser(userId);
        assertEquals(1, result.size());
        assertEquals("Alpha", result.get(0).getName());
    }

    @Test
    @DisplayName("updateTeam throws duplicate when renaming to existing name")
    void updateTeam_duplicateName_throws() {
        Team team = new Team();
        team.setId(teamId);
        team.setName("Old");

        TeamDTO dto = new TeamDTO();
        dto.setName("New");

        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(teamRepository.existsByName("New")).thenReturn(true);

        assertThrows(DuplicateResourceException.class, () -> teamService.updateTeam(teamId, dto));
    }
}

