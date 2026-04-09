// src/main/java/com/thesis/smart_resource_planner/service/ChatService.java
package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.MessageType;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.BadRequestException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service responsible for all chat-related business logic.
 *
 * <p>
 * Handles sending direct and team messages, marking messages as read,
 * resolving available contacts based on role and team membership, building
 * conversation lists, and broadcasting real-time updates over WebSocket.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final EmployeeRepository employeeRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ModelMapper modelMapper;
    private final WebSocketBroadcastService broadcastService;

    /**
     * Persists a new chat message and broadcasts it via WebSocket.
     *
     * @param createDTO DTO containing the message text, and either a receiverId
     *                  (DM) or teamId (team chat)
     * @param senderId  UUID of the authenticated user sending the message
     * @return the saved {@link ChatMessageDTO} with sender/receiver metadata
     *         populated
     */
    @Transactional
    public ChatMessageDTO sendMessage(ChatMessageCreateDTO createDTO, UUID senderId) {
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("Sender not found"));

        if (createDTO.getReceiverId() == null && createDTO.getTeamId() == null) {
            throw new BadRequestException("Either receiverId or teamId must be provided");
        }

        ChatMessage message = ChatMessage.builder()
                .sender(sender)
                .message(createDTO.getMessage())
                .messageType(MessageType.TEXT)
                .isRead(false)
                .build();

        if (createDTO.getReceiverId() != null) {
            User receiver = userRepository.findById(createDTO.getReceiverId())
                    .orElseThrow(() -> new ResourceNotFoundException("Receiver not found"));
            message.setReceiver(receiver);
        }

        if (createDTO.getTeamId() != null) {
            Team team = teamRepository.findById(createDTO.getTeamId())
                    .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

            boolean isMember = sender.getTeam() != null && sender.getTeam().getId().equals(createDTO.getTeamId());
            boolean isAdminOrManager = sender.getRole() == UserRole.ADMIN || sender.getRole() == UserRole.MANAGER;

            if (!isMember && !isAdminOrManager) {
                throw new BadRequestException("Not authorized");
            }
            message.setTeam(team);
        }

        ChatMessage saved = chatMessageRepository.saveAndFlush(message);

        ChatMessageDTO messageDTO = modelMapper.map(saved, ChatMessageDTO.class);

        // Manually set profile image URLs
        if (saved.getSender() != null) {
            messageDTO.setSenderId(saved.getSender().getId());
            messageDTO.setSenderName(saved.getSender().getUsername());

            employeeRepository.findByUserId(saved.getSender().getId())
                    .ifPresent(e -> messageDTO.setSenderProfileImageUrl(e.getProfileImageUrl()));
        }

        if (saved.getReceiver() != null) {
            messageDTO.setReceiverId(saved.getReceiver().getId());
            messageDTO.setReceiverName(saved.getReceiver().getUsername());

            employeeRepository.findByUserId(saved.getReceiver().getId())
                    .ifPresent(e -> messageDTO.setReceiverProfileImageUrl(e.getProfileImageUrl()));
        }

        if (saved.getTeam() != null) {
            messageDTO.setTeamId(saved.getTeam().getId());
            messageDTO.setTeamName(saved.getTeam().getName());
        }

        // Broadcast IMMEDIATELY after flush
        try {
            if (saved.getReceiver() != null) {

                // Send to receiver
                messagingTemplate.convertAndSendToUser(
                        saved.getReceiver().getId().toString(),
                        "/queue/messages",
                        messageDTO);

                // Echo to sender (so they see it immediately)
                messagingTemplate.convertAndSendToUser(
                        senderId.toString(),
                        "/queue/messages",
                        messageDTO);

            } else if (saved.getTeam() != null) {
                // Team message - send to team members AND admins
                List<User> teamMembers = userRepository.findByTeamId(saved.getTeam().getId());

                // Get all admins from the same company
                List<User> admins = userRepository.findByCompanyIdAndRole(
                        saved.getTeam().getCompany().getId(),
                        UserRole.ADMIN);

                // Combine team members and admins, remove duplicates
                Set<UUID> recipientIds = new HashSet<>();
                teamMembers.forEach(m -> recipientIds.add(m.getId()));
                admins.forEach(a -> recipientIds.add(a.getId()));

                for (UUID recipientId : recipientIds) {
                    messagingTemplate.convertAndSendToUser(
                            recipientId.toString(),
                            "/queue/messages",
                            messageDTO);
                }
            }

        } catch (Exception e) {
            log.error("WebSocket broadcast failed: {}", e.getMessage(), e);
        }

        return messageDTO;
    }

    /**
     * Marks a single message as read and notifies the original sender via
     * WebSocket.
     *
     * @param messageId UUID of the message to mark as read
     */
    @Transactional
    public void markAsRead(UUID messageId) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found"));

        if (message.getIsRead()) {
            return;
        }

        message.setIsRead(true);
        message.setReadAt(LocalDateTime.now());

        chatMessageRepository.saveAndFlush(message);

        if (message.getSender() != null) {
            try {
                broadcastService.broadcastMessageRead(
                        message.getSender().getId(),
                        Map.of(
                                "action", "mark_read",
                                "messageId", message.getId().toString(),
                                "readAt", message.getReadAt().toString()));
            } catch (Exception e) {
                log.error("Read receipt failed: {}", e.getMessage());
            }
        }
    }

    /**
     * Marks every unread message addressed to the given user as read.
     *
     * @param userId UUID of the user whose inbox should be cleared
     */
    @Transactional
    public void markAllAsRead(UUID userId) {
        List<ChatMessage> unreadMessages = chatMessageRepository.findUnreadByReceiverId(userId);
        unreadMessages.forEach(msg -> {
            msg.setIsRead(true);
            msg.setReadAt(LocalDateTime.now());
        });

        chatMessageRepository.saveAllAndFlush(unreadMessages);

        try {
            messagingTemplate.convertAndSend(
                    "/user/" + userId.toString() + "/queue/chat-update",
                    Map.of("action", "mark_all_read", "count", 0));
        } catch (Exception e) {
            log.error("Broadcast failed: {}", e.getMessage());
        }
    }

    /**
     * Retrieves all messages posted in a team channel, ordered by most recent
     * first.
     *
     * @param teamId UUID of the team
     * @return list of {@link ChatMessageDTO} with profile-image URLs populated
     */
    @Transactional(readOnly = true)
    public List<ChatMessageDTO> getTeamMessages(UUID teamId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found"));
        UUID companyId = team.getCompany().getId();

        List<ChatMessage> messages = chatMessageRepository.findByTeamIdAndCompanyIdOrderByCreatedAtDesc(teamId,
                companyId);

        Map<UUID, String> imageCache = batchLoadProfileImages(messages);

        return messages.stream()
                .map(msg -> mapToDTO(msg, imageCache))
                .toList();
    }

    /**
     * Retrieves the direct-message history between two users within the same
     * company.
     *
     * @param userId      UUID of the requesting user
     * @param otherUserId UUID of the conversation partner
     * @return list of {@link ChatMessageDTO} ordered by creation time
     */
    @Transactional(readOnly = true)
    public List<ChatMessageDTO> getDirectMessages(UUID userId, UUID otherUserId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        UUID companyId = user.getCompany().getId();

        List<ChatMessage> messages = chatMessageRepository.findDirectMessagesBetweenUsersAndCompany(userId, otherUserId,
                companyId);

        Map<UUID, String> imageCache = batchLoadProfileImages(messages);

        return messages.stream()
                .map(msg -> mapToDTO(msg, imageCache))
                .toList();
    }

    /**
     * Returns the number of unread direct messages for the given user.
     *
     * @param userId UUID of the user
     * @return count of unread messages scoped to the user's company
     */
    @Transactional(readOnly = true)
    public Long getUnreadCount(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return chatMessageRepository.countUnreadByReceiverIdAndCompanyId(
                userId, user.getCompany().getId());
    }

    /**
     * Retrieves all unread direct messages for the given user.
     *
     * @param userId UUID of the user
     * @return list of unread {@link ChatMessageDTO} objects
     */
    @Transactional(readOnly = true)
    public List<ChatMessageDTO> getUnreadMessages(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<ChatMessage> messages = chatMessageRepository.findUnreadByReceiverIdAndCompanyId(userId,
                user.getCompany().getId());

        Map<UUID, String> imageCache = batchLoadProfileImages(messages);

        return messages.stream()
                .map(msg -> mapToDTO(msg, imageCache))
                .toList();
    }

    /**
     * Builds a role-aware list of users that the given user may contact.
     * Admins can message managers and employees; managers can message everyone;
     * employees can message managers and their team/department peers.
     *
     * @param userId UUID of the requesting user
     * @return sorted list of contactable {@link UserDTO} objects
     */
    @Transactional(readOnly = true)
    public List<UserDTO> getAvailableContacts(UUID userId) {
        User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Set<UUID> contactIds = new HashSet<>();

        List<User> companyUsers = userRepository.findByCompanyId(currentUser.getCompany().getId());

        if (currentUser.getRole() == UserRole.ADMIN) {
            companyUsers.stream()
                    .filter(u -> u.getRole() == UserRole.MANAGER || u.getRole() == UserRole.EMPLOYEE)
                    .forEach(u -> contactIds.add(u.getId()));
        } else if (currentUser.getRole() == UserRole.MANAGER) {
            companyUsers.stream()
                    .filter(u -> u.getRole() == UserRole.ADMIN ||
                            u.getRole() == UserRole.MANAGER ||
                            u.getRole() == UserRole.EMPLOYEE)
                    .filter(u -> !u.getId().equals(userId))
                    .forEach(u -> contactIds.add(u.getId()));
        } else if (currentUser.getRole() == UserRole.EMPLOYEE) {
            companyUsers.stream()
                    .filter(u -> u.getRole() == UserRole.MANAGER)
                    .forEach(u -> contactIds.add(u.getId()));

            if (currentUser.getTeam() != null) {
                List<User> teamMembers = userRepository.findByTeamId(currentUser.getTeam().getId());
                teamMembers.forEach(u -> {
                    if (u.getRole() == UserRole.EMPLOYEE && !u.getId().equals(userId)) {
                        contactIds.add(u.getId());
                    }
                });
            }

            try {
                Employee currentEmployee = employeeRepository.findByUserId(userId).orElse(null);
                if (currentEmployee != null && currentEmployee.getDepartment() != null) {
                    List<Employee> deptEmployees = employeeRepository.findByDepartmentAndCompanyId(
                            currentEmployee.getDepartment(),
                            currentUser.getCompany().getId());
                    deptEmployees.forEach(emp -> {
                        if (emp.getUser() != null &&
                                emp.getUser().getRole() == UserRole.EMPLOYEE &&
                                !emp.getUser().getId().equals(userId)) {
                            contactIds.add(emp.getUser().getId());
                        }
                    });
                }
            } catch (Exception e) {
                log.debug("No employee profile for user: {}", userId);
            }
        }

        return contactIds.stream()
                .map(id -> userRepository.findById(id).orElse(null))
                .filter(Objects::nonNull)
                .filter(u -> u.getRole() != UserRole.USER)
                .filter(u -> u.getCompany().getId().equals(currentUser.getCompany().getId()))
                .map(user -> modelMapper.map(user, UserDTO.class))
                .sorted(Comparator.comparing(UserDTO::getUsername))
                .toList();
    }

    /**
     * Returns a summary list of all direct-message conversations the user
     * participates in,
     * sorted by the time of the most recent message.
     *
     * @param userId UUID of the requesting user
     * @return list of {@link ConversationDTO} objects
     */
    @Transactional(readOnly = true)
    public List<ConversationDTO> getConversations(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<ChatMessage> allMessages = chatMessageRepository.findAllUserMessagesByCompany(
                userId, user.getCompany().getId());

        Map<UUID, List<ChatMessage>> conversations = allMessages.stream()
                .filter(msg -> msg.getReceiver() != null)
                .collect(Collectors.groupingBy(msg -> msg.getSender().getId().equals(userId) ? msg.getReceiver().getId()
                        : msg.getSender().getId()));

        return conversations.entrySet().stream()
                .map(entry -> {
                    UUID partnerId = entry.getKey();
                    List<ChatMessage> messages = entry.getValue();

                    ChatMessage latestMessage = messages.stream()
                            .max(Comparator.comparing(ChatMessage::getCreatedAt))
                            .orElse(null);

                    long unreadCount = messages.stream()
                            .filter(msg -> !msg.getIsRead() && msg.getReceiver() != null
                                    && msg.getReceiver().getId().equals(userId))
                            .count();

                    User partner = userRepository.findById(partnerId)
                            .orElseThrow(() -> new ResourceNotFoundException("Conversation partner not found"));

                    return ConversationDTO.builder()
                            .partnerId(partnerId)
                            .partnerName(partner.getUsername())
                            .partnerRole(partner.getRole().toString())
                            .lastMessage(latestMessage != null ? latestMessage.getMessage() : "")
                            .lastMessageTime(latestMessage != null ? latestMessage.getCreatedAt() : null)
                            .unreadCount((int) unreadCount)
                            .build();
                })
                .sorted(Comparator.comparing(ConversationDTO::getLastMessageTime,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    /**
     * Returns team-chat summaries visible to the given user.
     * Admins and managers see all teams in the company; employees see only their
     * own team.
     *
     * @param userId UUID of the requesting user
     * @return list of {@link TeamChatDTO} objects
     */
    @Transactional(readOnly = true)
    public List<TeamChatDTO> getUserTeamChats(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<TeamChatDTO> teamChats = new ArrayList<>();

        if (user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.MANAGER) {
            List<Team> allTeams = teamRepository.findByCompanyId(user.getCompany().getId());

            for (Team team : allTeams) {
                List<ChatMessage> teamMessages = chatMessageRepository
                        .findByTeamIdOrderByCreatedAtDesc(team.getId());
                ChatMessage latestMessage = teamMessages.isEmpty() ? null : teamMessages.get(0);
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
     * Maps a {@link ChatMessage} entity to a DTO and resolves profile image URLs
     * from the provided cache (or via a DB lookup if the cache misses).
     *
     * @param message    the chat message entity
     * @param imageCache pre-fetched map of userId → profileImageUrl
     * @return populated {@link ChatMessageDTO}
     */
    private ChatMessageDTO mapToDTO(ChatMessage message, Map<UUID, String> imageCache) {
        ChatMessageDTO dto = modelMapper.map(message, ChatMessageDTO.class);

        if (message.getSender() != null) {
            dto.setSenderId(message.getSender().getId());
            dto.setSenderName(message.getSender().getUsername());

            if (imageCache != null && imageCache.containsKey(message.getSender().getId())) {
                dto.setSenderProfileImageUrl(imageCache.get(message.getSender().getId()));
            } else {
                employeeRepository.findByUserId(message.getSender().getId())
                        .ifPresent(e -> dto.setSenderProfileImageUrl(e.getProfileImageUrl()));
            }
        }

        if (message.getReceiver() != null) {
            dto.setReceiverId(message.getReceiver().getId());
            dto.setReceiverName(message.getReceiver().getUsername());

            if (imageCache != null && imageCache.containsKey(message.getReceiver().getId())) {
                dto.setReceiverProfileImageUrl(imageCache.get(message.getReceiver().getId()));
            } else {
                employeeRepository.findByUserId(message.getReceiver().getId())
                        .ifPresent(e -> dto.setReceiverProfileImageUrl(e.getProfileImageUrl()));
            }
        }

        if (message.getTeam() != null) {
            dto.setTeamId(message.getTeam().getId());
            dto.setTeamName(message.getTeam().getName());
        }

        return dto;
    }

    /**
     * Convenience overload that maps a message without a profile-image cache.
     *
     * @param message the chat message entity
     * @return populated {@link ChatMessageDTO}
     */
    private ChatMessageDTO mapToDTO(ChatMessage message) {
        return mapToDTO(message, null);
    }

    /**
     * Batch-loads profile image URLs for all senders and receivers in a list of
     * messages
     * using a single repository query to avoid N+1 issues.
     *
     * @param messages list of chat messages whose participants need image URLs
     * @return map of userId → profileImageUrl (empty string if no image set)
     */
    private Map<UUID, String> batchLoadProfileImages(List<ChatMessage> messages) {
        if (messages.isEmpty())
            return Collections.emptyMap();

        Set<UUID> userIds = new HashSet<>();
        for (ChatMessage msg : messages) {
            if (msg.getSender() != null)
                userIds.add(msg.getSender().getId());
            if (msg.getReceiver() != null)
                userIds.add(msg.getReceiver().getId());
        }

        if (userIds.isEmpty())
            return Collections.emptyMap();

        return employeeRepository.findByUserIdIn(userIds).stream()
                .collect(Collectors.toMap(
                        e -> e.getUser().getId(),
                        e -> e.getProfileImageUrl() != null ? e.getProfileImageUrl() : "",
                        (existing, replacement) -> existing));
    }

    /**
     * Returns a map of senderId → unread message count for every contact
     * that has sent the given user at least one unread message.
     *
     * @param userId UUID of the receiving user
     * @return map keyed by sender UUID with the corresponding unread message count
     */
    @Transactional(readOnly = true)
    public Map<UUID, Long> getUnreadCountPerContact(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<ChatMessage> unreadMessages = chatMessageRepository
                .findUnreadByReceiverIdAndCompanyId(userId, user.getCompany().getId());

        return unreadMessages.stream()
                .filter(msg -> msg.getSender() != null && msg.getReceiver() != null)
                .collect(Collectors.groupingBy(
                        msg -> msg.getSender().getId(),
                        Collectors.counting()));
    }
}