// src/main/java/com/thesis/smart_resource_planner/service/WebSocketBroadcastService.java
package com.thesis.smart_resource_planner.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/**
 * Centralised WebSocket broadcast service.
 *
 * <p>
 * Wraps {@link SimpMessagingTemplate} to provide typed, named helper methods
 * for pushing real-time events to individual users and global topics.
 * Errors are caught internally and logged rather than propagated to callers,
 * so a failed broadcast never interrupts a business transaction.
 * </p>
 *
 * <p>
 * Supported event categories: notifications, chat messages, task updates,
 * assignment updates, user promotions, and profile updates.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketBroadcastService {

    private final SimpMessagingTemplate messagingTemplate;

    // ─────────────────────────────── NOTIFICATIONS ────────────────────────────

    /**
     * Sends a new notification payload to a specific user's notification queue.
     *
     * @param userId  the UUID of the target user
     * @param payload the notification object to send (will be serialized to JSON)
     */
    public void broadcastNotification(UUID userId, Object payload) {
        send(userId, "/queue/notifications", payload);
    }

    /**
     * Sends a notification-update event (e.g. mark-as-read acknowledgement)
     * to a specific user's notification update queue.
     *
     * @param userId  the UUID of the target user
     * @param payload a map containing update details (e.g. action type,
     *                notification ID)
     */
    public void broadcastNotificationUpdate(UUID userId, Map<String, Object> payload) {
        send(userId, "/queue/notification-update", payload);
    }

    // ──────────────────────────────────── CHAT ────────────────────────────────

    /**
     * Sends a new chat message directly to a specific user's personal message
     * queue.
     *
     * @param userId  the UUID of the target user
     * @param message the chat message object to deliver
     */
    public void broadcastChatMessage(UUID userId, Object message) {
        try {
            messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/messages",
                    message);

        } catch (Exception e) {
            log.error("Failed to broadcast chat message to {}: {}", userId, e.getMessage());
        }
    }

    /**
     * Notifies a user that one or more of their chat messages have been read.
     *
     * @param userId  the UUID of the target user
     * @param payload a map describing which messages were read (e.g. conversation
     *                ID)
     */
    public void broadcastMessageRead(UUID userId, Map<String, Object> payload) {
        send(userId, "/queue/chat-update", payload);
    }

    // ──────────────────────────────────── TASKS ───────────────────────────────

    /**
     * Notifies a user that a new task has been created.
     *
     * @param userId the UUID of the target user
     * @param task   the newly created task object
     */
    public void broadcastTaskCreated(UUID userId, Object task) {
        send(userId, "/queue/task-updates", Map.of(
                "action", "task_created",
                "task", task));
    }

    /**
     * Notifies a user that a task's status has changed (e.g. PENDING →
     * IN_PROGRESS).
     *
     * @param userId the UUID of the target user
     * @param task   the task object reflecting the new status
     */
    public void broadcastTaskStatusUpdate(UUID userId, Object task) {
        send(userId, "/queue/task-updates", Map.of(
                "action", "task_status_updated",
                "task", task));
    }

    /**
     * Notifies a user of an incoming task assignment request.
     *
     * @param userId the UUID of the target user
     * @param task   the task object associated with the request
     */
    public void broadcastTaskRequest(UUID userId, Object task) {
        send(userId, "/queue/task-updates", Map.of(
                "action", "task_request",
                "task", task));
    }

    /**
     * Notifies a user that a task assignment they requested was rejected.
     *
     * @param userId the UUID of the target user
     * @param task   the rejected task object
     */
    public void broadcastTaskRejected(UUID userId, Object task) {
        send(userId, "/queue/task-updates", Map.of(
                "action", "task_rejected",
                "task", task));
    }

    // ─────────────────────────────── ASSIGNMENTS ──────────────────────────────

    /**
     * Notifies a user that a new assignment has been created for them.
     *
     * @param userId     the UUID of the target user
     * @param assignment the assignment object
     */
    public void broadcastAssignmentCreated(UUID userId, Object assignment) {
        send(userId, "/queue/assignment-updates", Map.of(
                "action", "assignment_created",
                "assignment", assignment));
    }

    /**
     * Notifies a user that an assignment they were involved in has been accepted.
     *
     * @param userId     the UUID of the target user
     * @param assignment the accepted assignment object
     */
    public void broadcastAssignmentAccepted(UUID userId, Object assignment) {
        send(userId, "/queue/assignment-updates", Map.of(
                "action", "assignment_accepted",
                "assignment", assignment));
    }

    /**
     * Notifies a user that an assignment they were involved in has been rejected.
     *
     * @param userId     the UUID of the target user
     * @param assignment the rejected assignment object
     */
    public void broadcastAssignmentRejected(UUID userId, Object assignment) {
        send(userId, "/queue/assignment-updates", Map.of(
                "action", "assignment_rejected",
                "assignment", assignment));
    }

    // ──────────────────────── USER EVENTS (Promotions, Demotions ...) ─────────

    /**
     * Sends a promotion or demotion notification to a specific user.
     *
     * @param userId  the UUID of the target user
     * @param payload a map containing event details (e.g. new role, message)
     */
    public void broadcastPromotion(UUID userId, Map<String, Object> payload) {
        send(userId, "/queue/notifications", payload);
    }

    // ─────────────────────────────── PROFILE UPDATES ─────────────────────────

    /**
     * Broadcasts a profile update event both to the individual user's personal
     * queue and to the global {@code /topic/profile-updates} topic so that all
     * connected clients can reflect the change immediately.
     *
     * @param userId  the UUID of the user whose profile was updated
     * @param payload a map containing updated profile fields
     */
    public void broadcastProfileUpdate(UUID userId, Map<String, Object> payload) {
        // Send to the user who updated
        send(userId, "/queue/profile-update", payload);

        // Also broadcast globally so ALL users see the update
        try {
            messagingTemplate.convertAndSend("/topic/profile-updates", payload);
        } catch (Exception e) {
            log.error("Failed to broadcast global profile update: {}", e.getMessage());
        }
    }

    // ──────────────────────────── CORE SEND LOGIC ─────────────────────────────

    /**
     * Core helper that delivers a payload to a user-specific STOMP destination.
     * Exceptions are swallowed and logged to prevent WebSocket failures from
     * disrupting caller transactions.
     *
     * @param userId      the UUID of the target user
     * @param destination the user-relative destination path (e.g.
     *                    {@code /queue/notifications})
     * @param payload     the object to send (serialized to JSON by the message
     *                    converter)
     */
    private void send(UUID userId, String destination, Object payload) {
        try {
            messagingTemplate.convertAndSendToUser(userId.toString(), destination, payload);
        } catch (Exception e) {
            log.error("Failed to send {} to {}: {}", destination, userId, e.getMessage());
        }
    }
}