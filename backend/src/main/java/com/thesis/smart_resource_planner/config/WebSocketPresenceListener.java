package com.thesis.smart_resource_planner.config;

import com.thesis.smart_resource_planner.model.enums.UserStatus;
import com.thesis.smart_resource_planner.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketPresenceListener {

    private final UserService userService;

    private UUID getUserId(String name) {
        try {
            return UUID.fromString(name);
        } catch (IllegalArgumentException e) {
            return userService.getUserByUsername(name).getId();
        }
    }

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        if (event.getUser() != null) {
            try {
                UUID userId = getUserId(event.getUser().getName());
                log.info("WebSocket connected for user: {}", userId);
                
                // Automatically set the user to ONLINE upon connection
                userService.updateUserStatus(userId, UserStatus.ONLINE);
            } catch (Exception e) {
                log.error("Failed to process WebSocket connect event", e);
            }
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        if (event.getUser() != null) {
            try {
                UUID userId = getUserId(event.getUser().getName());
                log.info("WebSocket disconnected for user: {}", userId);
                
                // Automatically set the user to OFFLINE upon tab close or disconnection
                userService.updateUserStatus(userId, UserStatus.OFFLINE);
            } catch (Exception e) {
                log.error("Failed to process WebSocket disconnect event", e);
            }
        }
    }
}
