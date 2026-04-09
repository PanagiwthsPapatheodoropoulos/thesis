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
    @DisplayName("broadcastProfileUpdate sends to user and global topic")
    void broadcastProfileUpdate_sendsUserAndTopic() {
        UUID userId = UUID.randomUUID();
        Map<String, Object> payload = Map.of("action", "updated");

        service.broadcastProfileUpdate(userId, payload);

        verify(messagingTemplate).convertAndSendToUser(userId.toString(), "/queue/profile-update", payload);
        verify(messagingTemplate).convertAndSend("/topic/profile-updates", payload);
    }
}

