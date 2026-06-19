package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Controller for handling chat functionality.
 * Provides REST and WebSocket endpoints for sending and receiving messages.
 */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class ChatController {

    private final ChatService chatService;

    /**
     * Sends a new chat message via REST API.
     *
     * @param createDTO   The chat message creation data.
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity containing the sent message details.
     */
    @PostMapping("/send")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<ChatMessageDTO> sendMessage(
            @Valid @RequestBody ChatMessageCreateDTO createDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        // Handle sending process
        ChatMessageDTO message = chatService.sendMessage(createDTO, currentUser.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(message);
    }

    /**
     * Sends a new chat message via WebSocket.
     *
     * @param createDTO The chat message creation data.
     * @param principal The security principal.
     */
    @MessageMapping("/chat.send")
    public void sendWebSocketMessage(@Payload ChatMessageCreateDTO createDTO, Principal principal) {
        // Handle WebSocket message creation
        UUID senderId = UUID.fromString(principal.getName());
        chatService.sendMessage(createDTO, senderId);
    }

    /**
     * Retrieves all messages for a specific team.
     *
     * @param teamId The ID of the team.
     * @return ResponseEntity with the list of team messages.
     */
    @GetMapping("/team/{teamId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<ChatMessageDTO>> getTeamMessages(@PathVariable UUID teamId) {
        List<ChatMessageDTO> messages = chatService.getTeamMessages(teamId);
        return ResponseEntity.ok(messages);
    }

    /**
     * Retrieves all direct messages exchanged with a specific user.
     *
     * @param userId      The ID of the corresponding user.
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with the list of direct messages.
     */
    @GetMapping("/direct/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<ChatMessageDTO>> getDirectMessages(
            @PathVariable UUID userId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<ChatMessageDTO> messages = chatService.getDirectMessages(currentUser.getId(), userId);
        return ResponseEntity.ok(messages);
    }

    /**
     * Retrieves all available contacts for the current user.
     *
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with the list of available contacts.
     */
    @GetMapping("/contacts")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<UserDTO>> getAvailableContacts(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<UserDTO> contacts = chatService.getAvailableContacts(currentUser.getId());
        return ResponseEntity.ok(contacts);
    }

    /**
     * Retrieves the list of active user conversations.
     *
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with the list of conversations.
     */
    @GetMapping("/conversations")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<ConversationDTO>> getConversations(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<ConversationDTO> conversations = chatService.getConversations(currentUser.getId());
        return ResponseEntity.ok(conversations);
    }

    /**
     * Retrieves all team chats the current user is a part of.
     *
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with the list of team chats.
     */
    @GetMapping("/teams")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<TeamChatDTO>> getUserTeamChats(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<TeamChatDTO> teamChats = chatService.getUserTeamChats(currentUser.getId());
        return ResponseEntity.ok(teamChats);
    }

    /**
     * Retrieves the total count of unread messages for the user.
     *
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with the unread message count.
     */
    @GetMapping("/unread/count")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Long> getUnreadCount(@AuthenticationPrincipal UserPrincipal currentUser) {
        Long count = chatService.getUnreadCount(currentUser.getId());
        return ResponseEntity.ok(count);
    }

    /**
     * Retrieves all unread messages for the user.
     *
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity with the list of unread messages.
     */
    @GetMapping("/unread")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<ChatMessageDTO>> getUnreadMessages(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<ChatMessageDTO> messages = chatService.getUnreadMessages(currentUser.getId());
        return ResponseEntity.ok(messages);
    }

    /**
     * Marks a specific message as read.
     *
     * @param id The ID of the message to be marked.
     * @return ResponseEntity indicating successful update.
     */
    @PatchMapping("/{id}/read")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Void> markAsRead(@PathVariable UUID id) {
        // Mark task as read
        chatService.markAsRead(id);
        return ResponseEntity.ok().build();
    }

    /**
     * Marks all unread messages as read for the current user.
     *
     * @param currentUser The currently authenticated user.
     * @return ResponseEntity indicating successful update.
     */
    @PatchMapping("/read-all")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Void> markAllAsRead(@AuthenticationPrincipal UserPrincipal currentUser) {
        // Mark all notifications as read
        chatService.markAllAsRead(currentUser.getId());
        return ResponseEntity.ok().build();
    }

    /**
     * Retrieves unread message counts mapped by contact.
     *
     * @param userPrincipal The currently authenticated user principal.
     * @return ResponseEntity containing a map of contact IDs to unread counts.
     */
    @GetMapping("/unread/per-contact")
    public ResponseEntity<Map<UUID, Long>> getUnreadCountPerContact(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Map<UUID, Long> unreadCounts = chatService.getUnreadCountPerContact(userPrincipal.getId());
        return ResponseEntity.ok(unreadCounts);
    }
}