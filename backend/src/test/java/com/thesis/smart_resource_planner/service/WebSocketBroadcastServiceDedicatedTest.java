package com.thesis.smart_resource_planner.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("WebSocketBroadcastService Tests")
class WebSocketBroadcastServiceDedicatedTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private WebSocketBroadcastService service;

    @Test
    @DisplayName("broadcastNotification delegates to /queue/notifications")
    void broadcastNotification_sendsToUserQueue() {
        UUID userId = UUID.randomUUID();
        Object payload = Map.of("x", 1);

        service.broadcastNotification(userId, payload);

        verify(messagingTemplate).convertAndSendToUser(userId.toString(), "/queue/notifications", payload);
    }

    @Test
    @DisplayName("broadcastNotificationUpdate delegates to /queue/notification-update")
    void broadcastNotificationUpdate_sendsToUserQueue() {
        UUID userId = UUID.randomUUID();
        Map<String, Object> payload = Map.of("unread", true);

        service.broadcastNotificationUpdate(userId, payload);

        verify(messagingTemplate).convertAndSendToUser(userId.toString(), "/queue/notification-update", payload);
    }

    @Test
    @DisplayName("broadcastChatMessage delegates to /queue/messages")
    void broadcastChatMessage_sendsToUserQueue() {
        UUID userId = UUID.randomUUID();
        Object payload = "hello";

        service.broadcastChatMessage(userId, payload);

        verify(messagingTemplate).convertAndSendToUser(userId.toString(), "/queue/messages", payload);
    }

    @Test
    @DisplayName("broadcastChatMessage handles exception when template throws")
    void broadcastChatMessage_handlesException() {
        UUID userId = UUID.randomUUID();
        Object payload = "hello";
        doThrow(new RuntimeException("Simulated STOMP failure"))
                .when(messagingTemplate).convertAndSendToUser(anyString(), anyString(), any());

        assertDoesNotThrow(() -> service.broadcastChatMessage(userId, payload));
    }

    @Test
    @DisplayName("broadcastMessageRead delegates to /queue/chat-update")
    void broadcastMessageRead_sendsToUserQueue() {
        UUID userId = UUID.randomUUID();
        Map<String, Object> payload = Map.of("read", true);

        service.broadcastMessageRead(userId, payload);

        verify(messagingTemplate).convertAndSendToUser(userId.toString(), "/queue/chat-update", payload);
    }

    @Test
    @DisplayName("broadcastTaskCreated delegates task created payload to /queue/task-updates")
    void broadcastTaskCreated_sendsToUserQueue() {
        UUID userId = UUID.randomUUID();
        Object task = "mockTask";

        service.broadcastTaskCreated(userId, task);

        verify(messagingTemplate).convertAndSendToUser(
                userId.toString(),
                "/queue/task-updates",
                Map.of("action", "task_created", "task", task)
        );
    }

    @Test
    @DisplayName("broadcastTaskStatusUpdate delegates task status update payload to /queue/task-updates")
    void broadcastTaskStatusUpdate_sendsToUserQueue() {
        UUID userId = UUID.randomUUID();
        Object task = "mockTask";

        service.broadcastTaskStatusUpdate(userId, task);

        verify(messagingTemplate).convertAndSendToUser(
                userId.toString(),
                "/queue/task-updates",
                Map.of("action", "task_status_updated", "task", task)
        );
    }

    @Test
    @DisplayName("broadcastTaskRequest delegates task request payload to /queue/task-updates")
    void broadcastTaskRequest_sendsToUserQueue() {
        UUID userId = UUID.randomUUID();
        Object task = "mockTask";

        service.broadcastTaskRequest(userId, task);

        verify(messagingTemplate).convertAndSendToUser(
                userId.toString(),
                "/queue/task-updates",
                Map.of("action", "task_request", "task", task)
        );
    }

    @Test
    @DisplayName("broadcastTaskRejected delegates task rejected payload to /queue/task-updates")
    void broadcastTaskRejected_sendsToUserQueue() {
        UUID userId = UUID.randomUUID();
        Object task = "mockTask";

        service.broadcastTaskRejected(userId, task);

        verify(messagingTemplate).convertAndSendToUser(
                userId.toString(),
                "/queue/task-updates",
                Map.of("action", "task_rejected", "task", task)
        );
    }

    @Test
    @DisplayName("broadcastTaskDeleted delegates task deleted payload to /queue/task-updates")
    void broadcastTaskDeleted_sendsToUserQueue() {
        UUID userId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();

        service.broadcastTaskDeleted(userId, taskId);

        verify(messagingTemplate).convertAndSendToUser(
                userId.toString(),
                "/queue/task-updates",
                Map.of("action", "task_deleted", "taskId", taskId.toString())
        );
    }

    @Test
    @DisplayName("broadcastAssignmentCreated delegates assignment created payload to /queue/assignment-updates")
    void broadcastAssignmentCreated_sendsToUserQueue() {
        UUID userId = UUID.randomUUID();
        Object assignment = "mockAssignment";

        service.broadcastAssignmentCreated(userId, assignment);

        verify(messagingTemplate).convertAndSendToUser(
                userId.toString(),
                "/queue/assignment-updates",
                Map.of("action", "assignment_created", "assignment", assignment)
        );
    }

    @Test
    @DisplayName("broadcastAssignmentAccepted delegates assignment accepted payload to /queue/assignment-updates")
    void broadcastAssignmentAccepted_sendsToUserQueue() {
        UUID userId = UUID.randomUUID();
        Object assignment = "mockAssignment";

        service.broadcastAssignmentAccepted(userId, assignment);

        verify(messagingTemplate).convertAndSendToUser(
                userId.toString(),
                "/queue/assignment-updates",
                Map.of("action", "assignment_accepted", "assignment", assignment)
        );
    }

    @Test
    @DisplayName("broadcastAssignmentRejected delegates assignment rejected payload to /queue/assignment-updates")
    void broadcastAssignmentRejected_sendsToUserQueue() {
        UUID userId = UUID.randomUUID();
        Object assignment = "mockAssignment";

        service.broadcastAssignmentRejected(userId, assignment);

        verify(messagingTemplate).convertAndSendToUser(
                userId.toString(),
                "/queue/assignment-updates",
                Map.of("action", "assignment_rejected", "assignment", assignment)
        );
    }

    @Test
    @DisplayName("broadcastPromotion delegates to /queue/notifications")
    void broadcastPromotion_sendsToUserQueue() {
        UUID userId = UUID.randomUUID();
        Map<String, Object> payload = Map.of("promotion", true);

        service.broadcastPromotion(userId, payload);

        verify(messagingTemplate).convertAndSendToUser(userId.toString(), "/queue/notifications", payload);
    }

    @Test
    @DisplayName("broadcastProfileUpdate sends to user queue and global topic")
    void broadcastProfileUpdate_sendsUserAndTopic() {
        UUID userId = UUID.randomUUID();
        Map<String, Object> payload = Map.of("action", "updated");

        service.broadcastProfileUpdate(userId, payload);

        verify(messagingTemplate).convertAndSendToUser(userId.toString(), "/queue/profile-update", payload);
        verify(messagingTemplate).convertAndSend("/topic/profile-updates", payload);
    }

    @Test
    @DisplayName("broadcastProfileUpdate handles global exception when global broadcast fails")
    void broadcastProfileUpdate_handlesGlobalException() {
        UUID userId = UUID.randomUUID();
        Map<String, Object> payload = Map.of("action", "updated");
        doThrow(new RuntimeException("Simulated global broadcast failure"))
                .when(messagingTemplate).convertAndSend(anyString(), any(Object.class));

        assertDoesNotThrow(() -> service.broadcastProfileUpdate(userId, payload));
    }

    @Test
    @DisplayName("send handles general exception when core sending fails")
    void send_handlesCoreException() {
        UUID userId = UUID.randomUUID();
        Object payload = Map.of("x", 1);
        doThrow(new RuntimeException("Simulated core send failure"))
                .when(messagingTemplate).convertAndSendToUser(anyString(), anyString(), any());

        assertDoesNotThrow(() -> service.broadcastNotification(userId, payload));
    }
}
