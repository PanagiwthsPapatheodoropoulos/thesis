package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.BadRequestException;
import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.UserRepository;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST controller for user profile and account management.
 * Handles user lookups, profile updates, password changes, and account
 * deletion.
 * Role escalation attempts by non-admins are blocked at this layer.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class UserController {

    private final UserService userService;
    private final UserRepository userRepository;
    private final ModelMapper modelMapper;
    private final PasswordEncoder passwordEncoder;

    /**
     * Retrieves a user's profile by their UUID.
     *
     * @param id The UUID of the user.
     * @return The user data transfer object.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<UserDTO> getUserById(@PathVariable UUID id) {
        UserDTO user = userService.getUserById(id);
        return ResponseEntity.ok(user);
    }

    /**
     * Finds a user by their unique username.
     *
     * @param username The username to look up.
     * @return The matching user.
     */
    @GetMapping("/username/{username}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<UserDTO> getUserByUsername(@PathVariable String username) {
        UserDTO user = userService.getUserByUsername(username);
        return ResponseEntity.ok(user);
    }

    /**
     * Finds a user by their email address.
     *
     * @param email The email address to look up.
     * @return The matching user.
     */
    @GetMapping("/email/{email}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<UserDTO> getUserByEmail(@PathVariable String email) {
        UserDTO user = userService.getUserByEmail(email);
        return ResponseEntity.ok(user);
    }

    /**
     * Returns all users visible to the current authenticated user.
     * Scope is filtered by role: admins see all, others see their company.
     *
     * @param currentUser The authenticated user.
     * @return A list of user DTOs.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<UserDTO>> getAllUsers(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<UserDTO> users = userService.getAllUsers(currentUser.getId());
        return ResponseEntity.ok(users);
    }

    /**
     * Returns all users who are members of a specific team.
     *
     * @param teamId The UUID of the team.
     * @return A list of users belonging to that team.
     */
    @GetMapping("/team/{teamId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<UserDTO>> getUsersByTeam(@PathVariable UUID teamId) {
        List<UserDTO> users = userService.getUsersByTeam(teamId);
        return ResponseEntity.ok(users);
    }

    /**
     * Returns all users assigned a particular role (e.g., ADMIN, MANAGER).
     *
     * @param role The role enum value to filter by.
     * @return A list of users holding that role.
     */
    @GetMapping("/role/{role}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserDTO>> getUsersByRole(@PathVariable UserRole role) {
        List<UserDTO> users = userService.getUsersByRole(role);
        return ResponseEntity.ok(users);
    }

    /**
     * Updates user profile fields such as name, email, and optionally their role.
     * Non-admin users cannot escalate their own role.
     *
     * @param id          The UUID of the user to update.
     * @param updateDTO   The updated fields.
     * @param currentUser The authenticated user making the request.
     * @return The updated user profile.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER') or #id == authentication.principal.id")
    public ResponseEntity<UserDTO> updateUser(
            @PathVariable UUID id,
            @Valid @RequestBody UserUpdateDTO updateDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        // Prevent role changes unless admin
        if (updateDTO.getRole() != null && !currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) {
            throw new AccessDeniedException("Only admins can change user roles");
        }

        UserDTO updated = userService.updateUser(id, updateDTO);
        return ResponseEntity.ok(updated);
    }

    /**
     * Changes the username for a user account.
     * Validates that the new username is non-empty and not already taken.
     *
     * @param id          The UUID of the user.
     * @param request     A map containing the new username under the key
     *                    "username".
     * @param currentUser The authenticated user making the request.
     * @return The updated user profile with the new username.
     */
    @PatchMapping("/{id}/username")
    @PreAuthorize("hasRole('ADMIN') or #id == authentication.principal.id")
    public ResponseEntity<UserDTO> updateUsername(
            @PathVariable UUID id,
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        String newUsername = request.get("username");

        if (newUsername == null || newUsername.trim().isEmpty()) {
            throw new BadRequestException("Username cannot be empty");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Check if username already exists
        if (userRepository.existsByUsername(newUsername) && !user.getUsername().equals(newUsername)) {
            throw new DuplicateResourceException("Username already exists");
        }

        user.setUsername(newUsername);
        User updated = userRepository.save(user);

        return ResponseEntity.ok(modelMapper.map(updated, UserDTO.class));
    }

    /**
     * Changes a user's password after verifying the current password.
     * Both the current and new password must be provided in the request body.
     *
     * @param id      The UUID of the user.
     * @param request A map with "currentPassword" and "newPassword" keys.
     * @return 200 OK on success, or a 400 error if the current password is wrong.
     */
    @PatchMapping("/{id}/password")
    @PreAuthorize("hasRole('ADMIN') or #id == authentication.principal.id")
    public ResponseEntity<Void> updatePassword(
            @PathVariable UUID id,
            @RequestBody Map<String, String> request) {

        String currentPassword = request.get("currentPassword");
        String newPassword = request.get("newPassword");

        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Verify current password
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }

        // Update password
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        return ResponseEntity.ok().build();
    }

    /**
     * Updates a user's application preferences (e.g., theme, language, notification
     * settings).
     * Only the user themselves can update their own preferences.
     *
     * @param id      The UUID of the user.
     * @param payload A map containing the serialized preferences string.
     * @return 200 OK on success.
     */
    @PutMapping("/{id}/preferences")
    @PreAuthorize("#id == authentication.principal.id")
    public ResponseEntity<Void> updatePreferences(
            @PathVariable UUID id,
            @RequestBody Map<String, String> payload) {
        userService.updatePreferences(id, payload.get("preferences"));
        return ResponseEntity.ok().build();
    }

    /**
     * Deletes a user account permanently.
     * Admins can delete any account; users can delete their own.
     *
     * @param id          The UUID of the user to delete.
     * @param currentUser The authenticated user performing the deletion.
     * @return 204 No Content on success.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or #id == authentication.principal.id")
    public ResponseEntity<Void> deleteUser(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        // Admins can delete anyone (except last admin)
        // Users can delete themselves (with restrictions)

        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}