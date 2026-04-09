package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.NotificationSeverity;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.ChatMessage;
import com.thesis.smart_resource_planner.model.entity.Team;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.ChatMessageRepository;
import com.thesis.smart_resource_planner.repository.TeamRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service layer for team management operations.
 *
 * <p>
 * Handles creation, retrieval, update, and deletion of teams, as well as
 * member management (adding/removing users from teams) and chat-room
 * listing. Dispatches notifications whenever a user's team membership
 * changes.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class TeamService {

    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ModelMapper modelMapper;
    private final ChatMessageRepository chatMessageRepository;

    /**
     * Creates a new team scoped to the requesting user's company.
     *
     * @param teamDTO the team data (name, description, etc.) to persist
     * @param userId  the UUID of the user performing the creation (determines
     *                company scope)
     * @return a {@link TeamDTO} representing the newly created team
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException  if
     *                                                                                the
     *                                                                                user
     *                                                                                does
     *                                                                                not
     *                                                                                exist
     * @throws com.thesis.smart_resource_planner.exception.DuplicateResourceException if
     *                                                                                a
     *                                                                                team
     *                                                                                with
     *                                                                                the
     *                                                                                same
     *                                                                                name
     *                                                                                already
     *                                                                                exists
     */
    @Transactional
    public TeamDTO createTeam(TeamDTO teamDTO, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (teamRepository.existsByName(teamDTO.getName())) {
            throw new DuplicateResourceException("Team name already exists");
        }

        Team team = modelMapper.map(teamDTO, Team.class);
        team.setCompany(user.getCompany());

        Team saved = teamRepository.save(team);
        return modelMapper.map(saved, TeamDTO.class);
    }

    /**
     * Retrieves a team by its unique identifier.
     *
     * @param id the UUID of the team
     * @return the matching {@link TeamDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               no
     *                                                                               team
     *                                                                               with
     *                                                                               the
     *                                                                               given
     *                                                                               ID
     *                                                                               exists
     */
    @Transactional(readOnly = true)
    public TeamDTO getTeamById(UUID id) {
        Team team = teamRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found"));
        return modelMapper.map(team, TeamDTO.class);
    }

    /**
     * Retrieves a team together with its full member list, using a JOIN FETCH
     * to avoid the N+1 problem.
     *
     * @param id the UUID of the team
     * @return a {@link TeamDTO} populated with a list of {@link TeamMemberDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               no
     *                                                                               team
     *                                                                               with
     *                                                                               the
     *                                                                               given
     *                                                                               ID
     *                                                                               exists
     */
    @Transactional(readOnly = true)
    public TeamDTO getTeamWithMembers(UUID id) {
        // Use JOIN FETCH to avoid N+1
        Team team = teamRepository.findByIdWithMembers(id)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

        TeamDTO teamDTO = modelMapper.map(team, TeamDTO.class);

        List<User> actualMembers = userRepository.findByTeamId(id);
        List<TeamMemberDTO> memberDTOs = actualMembers.stream()
                .map(user -> new TeamMemberDTO(
                        user.getId(),
                        user.getUsername(),
                        user.getEmail(),
                        user.getRole().toString()))
                .toList();

        teamDTO.setMembers(memberDTOs);
        teamDTO.setMemberCount(actualMembers.size());

        return teamDTO;
    }

    /**
     * Returns all teams that belong to the same company as the requesting user.
     * Uses a raw-projection query to include member counts without loading full
     * user entities.
     *
     * @param userId the UUID of the requesting user (determines company scope)
     * @return list of {@link TeamDTO} objects, each containing a member count
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               user
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<TeamDTO> getAllTeams(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        UUID companyId = user.getCompany().getId();

        // Use projection to avoid loading full entities
        List<Object[]> results = teamRepository.findTeamsWithMemberCountByCompanyId(companyId);

        return results.stream()
                .map(row -> {
                    TeamDTO dto = new TeamDTO();
                    dto.setId((UUID) row[0]);
                    dto.setName((String) row[1]);
                    dto.setDescription((String) row[2]);
                    dto.setCreatedAt((LocalDateTime) row[4]);
                    dto.setUpdatedAt((LocalDateTime) row[5]);
                    dto.setMemberCount(((Number) row[6]).intValue());
                    return dto;
                })
                .toList();
    }

    /**
     * Returns a paginated slice of teams belonging to the requesting user's
     * company.
     *
     * @param userId   the UUID of the requesting user
     * @param pageable pagination parameters (page number, size, sort)
     * @return a {@link Page} of {@link TeamDTO} objects
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               user
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public Page<TeamDTO> getTeamsPaginated(UUID userId, Pageable pageable) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        UUID companyId = user.getCompany().getId();

        // Fetch paginated teams with member count
        Page<Object[]> results = teamRepository.findTeamsWithMemberCountByCompanyIdPaginated(
                companyId,
                pageable);

        List<TeamDTO> teamDTOs = results.getContent().stream()
                .map(row -> {
                    TeamDTO dto = new TeamDTO();
                    dto.setId((UUID) row[0]);
                    dto.setName((String) row[1]);
                    dto.setDescription((String) row[2]);
                    dto.setCreatedAt((LocalDateTime) row[4]);
                    dto.setUpdatedAt((LocalDateTime) row[5]);
                    dto.setMemberCount(((Number) row[6]).intValue());
                    return dto;
                })
                .toList();

        return new PageImpl<>(teamDTOs, pageable, results.getTotalElements());
    }

    /**
     * Returns the single team to which the requesting user belongs, if any.
     *
     * @param userId the UUID of the user
     * @return a list containing the user's team (with members), or an empty list if
     *         the user has no team
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               user
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<TeamDTO> getTeamsForUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (user.getTeam() != null) {
            TeamDTO teamDTO = getTeamWithMembers(user.getTeam().getId());
            return List.of(teamDTO);
        }

        return List.of();
    }

    /**
     * Checks whether a specific user is currently a member of a specific team.
     *
     * @param teamId the UUID of the team
     * @param userId the UUID of the user
     * @return {@code true} if the user's current team matches {@code teamId}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               user
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public boolean isUserMemberOfTeam(UUID teamId, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return user.getTeam() != null && user.getTeam().getId().equals(teamId);
    }

    /**
     * Returns the chat-room summaries visible to the requesting user.
     * Admins see all teams in their company; regular users see only their own team.
     * Each entry includes the team name, member count, and the latest message.
     *
     * @param userId the UUID of the requesting user
     * @return list of {@link TeamChatDTO} objects representing accessible chat
     *         rooms
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               user
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<TeamChatDTO> getUserTeamChats(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<TeamChatDTO> teamChats = new ArrayList<>();

        // Admins see ALL teams (for chat access)
        if (user.getRole() == UserRole.ADMIN) {
            List<Team> allTeams = teamRepository.findByCompanyId(user.getCompany().getId());
            for (Team team : allTeams) {
                List<ChatMessage> teamMessages = chatMessageRepository
                        .findByTeamIdOrderByCreatedAtDesc(team.getId());
                ChatMessage latestMessage = teamMessages.isEmpty() ? null : teamMessages.get(0);

                // Correct member count (without counting admin)
                long memberCount = userRepository.countByTeamId(team.getId());

                teamChats.add(TeamChatDTO.builder()
                        .teamId(team.getId())
                        .teamName(team.getName())
                        .memberCount((int) memberCount)
                        .lastMessage(latestMessage != null ? latestMessage.getMessage() : "")
                        .lastMessageTime(latestMessage != null ? latestMessage.getCreatedAt() : null)
                        .build());
            }

        } else if (user.getTeam() != null) {
            // Regular users see only their team
            List<ChatMessage> teamMessages = chatMessageRepository
                    .findByTeamIdOrderByCreatedAtDesc(user.getTeam().getId());
            ChatMessage latestMessage = teamMessages.isEmpty() ? null : teamMessages.get(0);
            long memberCount = userRepository.countByTeamId(user.getTeam().getId());

            teamChats.add(TeamChatDTO.builder()
                    .teamId(user.getTeam().getId())
                    .teamName(user.getTeam().getName())
                    .memberCount((int) memberCount)
                    .lastMessage(latestMessage != null ? latestMessage.getMessage() : "")
                    .lastMessageTime(latestMessage != null ? latestMessage.getCreatedAt() : null)
                    .build());
        }

        return teamChats;
    }

    /**
     * Adds a user to a team and sends an informational notification to that user.
     *
     * @param teamId the UUID of the team to join
     * @param userId the UUID of the user to add
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               team
     *                                                                               or
     *                                                                               user
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    public void addMemberToTeam(UUID teamId, UUID userId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        user.setTeam(team);
        userRepository.save(user);

        try {
            NotificationCreateDTO notification = new NotificationCreateDTO();
            notification.setUserId(userId);
            notification.setType("TEAM_ASSIGNMENT");
            notification.setTitle("Added to Team");
            notification.setMessage("You have been added to the team: " + team.getName());
            notification.setSeverity(NotificationSeverity.INFO);

            notificationService.createNotification(notification);
        } catch (Exception e) {
            log.warn("Failed to send team assignment notification: {}", e.getMessage());
        }
    }

    /**
     * Removes a user from a team and sends a warning notification to that user.
     *
     * @param teamId the UUID of the team to leave
     * @param userId the UUID of the user to remove
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               user
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     * @throws IllegalArgumentException                                              if
     *                                                                               the
     *                                                                               user
     *                                                                               is
     *                                                                               not
     *                                                                               a
     *                                                                               member
     *                                                                               of
     *                                                                               the
     *                                                                               specified
     *                                                                               team
     */
    public void removeMemberFromTeam(UUID teamId, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (user.getTeam() == null || !user.getTeam().getId().equals(teamId)) {
            throw new IllegalArgumentException("User is not a member of this team");
        }

        String teamName = user.getTeam().getName();
        user.setTeam(null);
        userRepository.save(user);

        // Send IMMEDIATE notification to user
        try {
            NotificationCreateDTO notification = new NotificationCreateDTO();
            notification.setUserId(userId);
            notification.setType("TEAM_REMOVAL");
            notification.setTitle("Removed from Team");
            notification.setMessage("You have been removed from the team: " + teamName);
            notification.setSeverity(NotificationSeverity.WARNING);

            notificationService.createNotification(notification);
        } catch (Exception e) {
            log.warn("Failed to send team removal notification: {}", e.getMessage());
        }
    }

    /**
     * Updates an existing team's name and/or description.
     * Name changes are validated against existing team names.
     *
     * @param id      the UUID of the team to update
     * @param teamDTO DTO containing the fields to update (null fields are ignored)
     * @return the updated {@link TeamDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException  if
     *                                                                                the
     *                                                                                team
     *                                                                                does
     *                                                                                not
     *                                                                                exist
     * @throws com.thesis.smart_resource_planner.exception.DuplicateResourceException if
     *                                                                                the
     *                                                                                new
     *                                                                                name
     *                                                                                conflicts
     *                                                                                with
     *                                                                                an
     *                                                                                existing
     *                                                                                team
     */
    public TeamDTO updateTeam(UUID id, TeamDTO teamDTO) {
        Team team = teamRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

        if (teamDTO.getName() != null && !teamDTO.getName().equals(team.getName())) {
            if (teamRepository.existsByName(teamDTO.getName())) {
                throw new DuplicateResourceException("Team name already exists");
            }
            team.setName(teamDTO.getName());
        }

        if (teamDTO.getDescription() != null) {
            team.setDescription(teamDTO.getDescription());
        }

        Team updated = teamRepository.save(team);

        return modelMapper.map(updated, TeamDTO.class);
    }

    /**
     * Deletes a team and unassigns all of its current members.
     * Verifies that the team belongs to the requesting user's company before
     * deleting.
     *
     * @param id     the UUID of the team to delete
     * @param userId the UUID of the requesting user (used for company ownership
     *               check)
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               team
     *                                                                               or
     *                                                                               user
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     * @throws SecurityException                                                     if
     *                                                                               the
     *                                                                               team
     *                                                                               does
     *                                                                               not
     *                                                                               belong
     *                                                                               to
     *                                                                               the
     *                                                                               user's
     *                                                                               company
     */
    public void deleteTeam(UUID id, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Team team = teamRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

        // Verify the team belongs to the user's company
        if (!team.getCompany().getId().equals(user.getCompany().getId())) {
            throw new SecurityException("Not authorized to delete this team");
        }

        // Remove team association from all users
        List<User> members = userRepository.findByTeamId(id);
        members.forEach(member -> {
            member.setTeam(null);
            userRepository.save(member);
        });

        teamRepository.deleteById(id);
    }
}