// src/main/java/com/thesis/smart_resource_planner/service/NotificationService.java
package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.NotificationSeverity;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.NotificationCreateDTO;
import com.thesis.smart_resource_planner.model.dto.NotificationDTO;
import com.thesis.smart_resource_planner.model.entity.Notification;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.NotificationRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for creating, fetching, marking, and deleting user notifications.
 *
 * <p>
 * Each mutating operation broadcasts real-time updates to the affected
 * user via WebSocket so that their notification badge and panel stay
 * in sync without a page refresh.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final ModelMapper modelMapper;
    private final SimpMessagingTemplate messagingTemplate;

    @org.springframework.beans.factory.annotation.Autowired
    @org.springframework.context.annotation.Lazy
    private NotificationService self;

    /**
     * Persists a new notification and immediately broadcasts it to the target user.
     * Runs in a fresh transaction via {@code REQUIRES_NEW} so it can safely be
     * called from within a {@code TransactionSynchronization.afterCommit()}
     * callback.
     *
     * @param createDTO DTO containing recipient ID, type, title, message, and
     *                  severity
     * @return the saved {@link NotificationDTO}
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationDTO createNotification(NotificationCreateDTO createDTO) {
        User user = userRepository.findById(createDTO.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Notification notification = Notification.builder()
                .user(user)
                .type(createDTO.getType())
                .title(createDTO.getTitle())
                .message(createDTO.getMessage())
                .severity(createDTO.getSeverity() != null ? NotificationSeverity.valueOf(createDTO.getSeverity().name())
                        : NotificationSeverity.INFO)
                .relatedEntityType(createDTO.getRelatedEntityType())
                .relatedEntityId(createDTO.getRelatedEntityId())
                .isRead(false)
                .build();

        Notification saved = notificationRepository.saveAndFlush(notification);
        NotificationDTO dto = modelMapper.map(saved, NotificationDTO.class);

        // Broadcast immediately (transaction is committed)
        try {
            // 1. Send general notification
            messagingTemplate.convertAndSendToUser(
                    saved.getUser().getId().toString(),
                    "/queue/notifications",
                    dto);

            // 2. If it's a promotion, send BOTH notification types
            if ("ROLE_PROMOTION".equals(saved.getType())) {
                Map<String, Object> promotionData = new java.util.HashMap<>();
                promotionData.put("userId", saved.getUser().getId().toString());
                promotionData.put("type", "ROLE_PROMOTION");
                promotionData.put("title", saved.getTitle());
                promotionData.put("message", saved.getMessage());
                promotionData.put("timestamp", System.currentTimeMillis());
                promotionData.put("notificationId", saved.getId().toString());

                messagingTemplate.convertAndSendToUser(
                        saved.getUser().getId().toString(),
                        "/queue/notifications",
                        promotionData);
            }

            // 3. Update unread count
            long unreadCount = notificationRepository.countUnreadByUserId(saved.getUser().getId());
            messagingTemplate.convertAndSendToUser(
                    saved.getUser().getId().toString(),
                    "/queue/notification-update",
                    Map.of(
                            "action", "new_notification",
                            "count", unreadCount,
                            "type", dto.getType()));

        } catch (Exception e) {
            log.error("Failed to broadcast notification: {}", e.getMessage(), e);
        }

        return dto;
    }

    /**
     * Retrieves a single notification by its ID.
     *
     * @param id UUID of the notification
     * @return the matching {@link NotificationDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    @Transactional(readOnly = true)
    public NotificationDTO getNotificationById(UUID id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        return modelMapper.map(notification, NotificationDTO.class);
    }

    /**
     * Returns all notifications for a user, scoped to their company, ordered by
     * creation time (newest first).
     *
     * @param userId UUID of the target user
     * @return list of {@link NotificationDTO} objects
     */
    @Transactional(readOnly = true)
    public List<NotificationDTO> getNotificationsByUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return notificationRepository.findByUserIdAndCompanyIdOrderByCreatedAtDesc(
                userId, user.getCompany().getId()).stream()
                .map(notification -> modelMapper.map(notification, NotificationDTO.class))
                .toList();
    }

    /**
     * Returns only unread notifications for the given user, scoped to their
     * company.
     *
     * @param userId UUID of the target user
     * @return list of unread {@link NotificationDTO} objects
     */
    @Transactional(readOnly = true)
    public List<NotificationDTO> getUnreadNotifications(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return notificationRepository.findUnreadByUserIdAndCompanyId(
                userId, user.getCompany().getId()).stream()
                .map(notification -> modelMapper.map(notification, NotificationDTO.class))
                .toList();
    }

    /**
     * Returns the count of unread notifications for the given user within their
     * company.
     *
     * @param userId UUID of the target user
     * @return unread notification count
     */
    @Transactional(readOnly = true)
    public Long getUnreadCount(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return notificationRepository.countUnreadByUserIdAndCompanyId(
                userId, user.getCompany().getId());
    }

    /**
     * Marks a single notification as read and broadcasts the updated count to the
     * user.
     * Uses {@code REQUIRES_NEW} for safe invocation from async callbacks.
     *
     * @param notificationId UUID of the notification to mark as read
     * @return the updated {@link NotificationDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationDTO markAsRead(UUID notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));

        if (!notification.getIsRead()) {
            notification.setIsRead(true);
            notification.setReadAt(LocalDateTime.now());

            Notification updated = notificationRepository.saveAndFlush(notification);

            // Broadcast immediately
            try {
                long unreadCount = notificationRepository.countUnreadByUserId(notification.getUser().getId());

                messagingTemplate.convertAndSendToUser(
                        notification.getUser().getId().toString(),
                        "/queue/notification-update",
                        Map.of(
                                "action", "mark_read",
                                "notificationId", notificationId.toString(),
                                "count", unreadCount));

            } catch (Exception e) {
                log.error("Failed to broadcast mark as read: {}", e.getMessage());
            }

            return modelMapper.map(updated, NotificationDTO.class);
        }

        return modelMapper.map(notification, NotificationDTO.class);
    }

    /**
     * Marks all unread notifications for the given user as read and broadcasts the
     * update.
     *
     * @param userId UUID of the user whose notifications should all be marked read
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markAllAsRead(UUID userId) {

        List<Notification> unreadNotifications = notificationRepository.findUnreadByUserId(userId);

        unreadNotifications.forEach(notification -> {
            notification.setIsRead(true);
            notification.setReadAt(LocalDateTime.now());
        });

        notificationRepository.saveAllAndFlush(unreadNotifications);

        // Broadcast immediately
        try {
            messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/notification-update",
                    Map.of("action", "mark_all_read", "count", 0));
        } catch (Exception e) {
            log.error("Failed to broadcast mark all as read: {}", e.getMessage());
        }
    }

    /**
     * Permanently deletes a notification by its ID.
     *
     * @param id UUID of the notification to delete
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    public void deleteNotification(UUID id) {
        if (!notificationRepository.existsById(id)) {
            throw new ResourceNotFoundException("Notification not found");
        }

        notificationRepository.deleteById(id);
    }

    /**
     * Sends a notification to every member of a team.
     *
     * @param teamId   UUID of the team
     * @param title    notification title
     * @param message  notification body text
     * @param severity severity level of the notification
     */
    public void notifyTeamMembers(UUID teamId, String title, String message, NotificationSeverity severity) {
        List<User> teamMembers = userRepository.findByTeamId(teamId);

        for (User member : teamMembers) {
            NotificationCreateDTO notification = new NotificationCreateDTO();
            notification.setUserId(member.getId());
            notification.setType("TEAM_UPDATE");
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setSeverity(severity);

            self.createNotification(notification);
        }
    }
}