package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.NotificationCreateDTO;
import com.thesis.smart_resource_planner.model.dto.NotificationDTO;
import com.thesis.smart_resource_planner.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Controller for managing user notifications.
 * Provides endpoints for creating, retrieving, updating, and deleting
 * notifications.
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class NotificationController {

    private final NotificationService notificationService;

    /**
     * Creates a new notification.
     *
     * @param createDTO The notification creation data.
     * @return ResponseEntity containing the created notification details.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<NotificationDTO> createNotification(
            @Valid @RequestBody NotificationCreateDTO createDTO) {
        NotificationDTO notification = notificationService.createNotification(createDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(notification);
    }

    /**
     * Retrieves a notification by its unique ID.
     *
     * @param id The ID of the notification.
     * @return ResponseEntity with the notification data.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<NotificationDTO> getNotificationById(@PathVariable UUID id) {
        NotificationDTO notification = notificationService.getNotificationById(id);
        return ResponseEntity.ok(notification);
    }

    /**
     * Retrieves all notifications for a specific user.
     *
     * @param userId The ID of the user.
     * @return ResponseEntity with the list of notifications.
     */
    @GetMapping("/user/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<NotificationDTO>> getNotificationsByUser(@PathVariable UUID userId) {
        List<NotificationDTO> notifications = notificationService.getNotificationsByUser(userId);
        return ResponseEntity.ok(notifications);
    }

    /**
     * Retrieves all unread notifications for a specific user.
     *
     * @param userId The ID of the user.
     * @return ResponseEntity with the list of unread notifications.
     */
    @GetMapping("/user/{userId}/unread")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<NotificationDTO>> getUnreadNotifications(@PathVariable UUID userId) {
        List<NotificationDTO> notifications = notificationService.getUnreadNotifications(userId);
        return ResponseEntity.ok(notifications);
    }

    /**
     * Retrieves the count of unread notifications for a specified user.
     *
     * @param userId The ID of the user.
     * @return ResponseEntity with the count of unread notifications.
     */
    @GetMapping("/user/{userId}/unread/count")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Long> getUnreadCount(@PathVariable UUID userId) {
        Long count = notificationService.getUnreadCount(userId);
        return ResponseEntity.ok(count);
    }

    /**
     * Marks a specific notification as read.
     *
     * @param id The ID of the notification.
     * @return ResponseEntity indicating the updated notification.
     */
    @PatchMapping("/{id}/read")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<NotificationDTO> markAsRead(@PathVariable UUID id) {
        NotificationDTO notification = notificationService.markAsRead(id);
        return ResponseEntity.ok(notification);
    }

    /**
     * Marks all notifications as read for a specific user.
     *
     * @param userId The ID of the user.
     * @return ResponseEntity indicating successful update.
     */
    @PatchMapping("/user/{userId}/read-all")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Void> markAllAsRead(@PathVariable UUID userId) {
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok().build();
    }

    /**
     * Deletes a specific notification.
     *
     * @param id The ID of the notification to be deleted.
     * @return ResponseEntity indicating a successful deletion.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Void> deleteNotification(@PathVariable UUID id) {
        notificationService.deleteNotification(id);
        return ResponseEntity.noContent().build();
    }
}