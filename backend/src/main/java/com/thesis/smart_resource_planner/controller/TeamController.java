package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.TeamDTO;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TeamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for team management operations.
 * Provides endpoints for creating teams, managing membership, and listing teams
 * with pagination and optional search filtering.
 */
@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class TeamController {

    private final TeamService teamService;

    /**
     * Creates a new team within the organization.
     *
     * @param teamDTO     The data for the new team.
     * @param currentUser The authenticated admin or manager creating the team.
     * @return The created team with its assigned ID.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TeamDTO> createTeam(
            @Valid @RequestBody TeamDTO teamDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        TeamDTO created = teamService.createTeam(teamDTO, currentUser.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Retrieves detailed information for a single team, including its members.
     * Employees can only access a team they are a member of.
     *
     * @param id          The UUID of the team.
     * @param currentUser The authenticated user requesting the team details.
     * @return The team data, or 403 if the employee is not a team member.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<TeamDTO> getTeamById(@PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        boolean isEmployee = currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_EMPLOYEE"));

        if (isEmployee) {
            // Verify employee is member of this team
            if (!teamService.isUserMemberOfTeam(id, currentUser.getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        }

        TeamDTO team = teamService.getTeamWithMembers(id);
        return ResponseEntity.ok(team);
    }

    /**
     * Adds an existing user to a team as a member.
     *
     * @param teamId The UUID of the target team.
     * @param userId The UUID of the user to add.
     * @return 200 OK on success.
     */
    @PostMapping("/{teamId}/members/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> addMemberToTeam(
            @PathVariable UUID teamId,
            @PathVariable UUID userId) {
        teamService.addMemberToTeam(teamId, userId);
        return ResponseEntity.ok().build();
    }

    /**
     * Removes a user from a team.
     * A user may remove themselves, or an admin/manager may remove any member.
     *
     * @param teamId      The UUID of the team.
     * @param userId      The UUID of the user to remove.
     * @param currentUser The authenticated user making the request.
     * @return 200 OK on success, or 403 if unauthorized.
     */
    @DeleteMapping("/{teamId}/members/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER') or #userId == authentication.principal.id")
    public ResponseEntity<Void> removeMemberFromTeam(
            @PathVariable UUID teamId,
            @PathVariable UUID userId,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        // Allow users to remove themselves OR admins/managers to remove anyone
        boolean isSelfRemoval = userId.equals(currentUser.getId());
        boolean isAdminOrManager = currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_MANAGER"));

        if (!isSelfRemoval && !isAdminOrManager) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        teamService.removeMemberFromTeam(teamId, userId);
        return ResponseEntity.ok().build();
    }

    /**
     * Returns all teams that the currently authenticated user belongs to.
     *
     * @param currentUser The authenticated user.
     * @return A list of teams the user is a member of.
     */
    @GetMapping("/my-teams")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<TeamDTO>> getMyTeams(@AuthenticationPrincipal UserPrincipal currentUser) {
        List<TeamDTO> teams = teamService.getTeamsForUser(currentUser.getId());
        return ResponseEntity.ok(teams);
    }

    /**
     * Retrieves a full list of all teams within the organization.
     * Restricted to admins and managers.
     *
     * @param currentUser The authenticated admin or manager.
     * @return A list of all teams.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<TeamDTO>> getAllTeams(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<TeamDTO> teams = teamService.getAllTeams(currentUser.getId());
        return ResponseEntity.ok(teams);
    }

    /**
     * Returns a paginated and optionally searched list of teams.
     *
     * @param currentUser The authenticated admin or manager.
     * @param page        Zero-based page index (default 0).
     * @param size        Number of records per page (default 20).
     * @param sortBy      Field to sort by (default "name").
     * @param sortDir     Sort direction, "asc" or "desc" (default "asc").
     * @param search      Optional search term to filter teams by name.
     * @return A Spring Data Page of teams.
     */
    @GetMapping("/paginated")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Page<TeamDTO>> getTeamsPaginated(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String search) {

        Sort.Direction direction = sortDir.equalsIgnoreCase("desc")
                ? Sort.Direction.DESC
                : Sort.Direction.ASC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));

        Page<TeamDTO> teams = teamService.getTeamsPaginated(currentUser.getId(), pageable);
        return ResponseEntity.ok(teams);
    }

    /**
     * Updates the details of an existing team, such as its name or description.
     *
     * @param id      The UUID of the team to update.
     * @param teamDTO The updated team data.
     * @return The updated team.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TeamDTO> updateTeam(
            @PathVariable UUID id,
            @Valid @RequestBody TeamDTO teamDTO) {
        TeamDTO updated = teamService.updateTeam(id, teamDTO);
        return ResponseEntity.ok(updated);
    }

    /**
     * Deletes a team permanently from the system.
     *
     * @param id          The UUID of the team to delete.
     * @param currentUser The authenticated admin or manager.
     * @return 204 No Content on success.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<Void> deleteTeam(@PathVariable UUID id, @AuthenticationPrincipal UserPrincipal currentUser) {
        teamService.deleteTeam(id, currentUser.getId());
        return ResponseEntity.noContent().build();
    }
}