package com.thesis.smart_resource_planner.config;

import com.thesis.smart_resource_planner.model.enums.UserStatus;
import com.thesis.smart_resource_planner.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.util.UUID;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebSocketPresenceListenerTest {

    @Mock
    private UserService userService;

    @InjectMocks
    private WebSocketPresenceListener presenceListener;

    @Mock
    private SessionDisconnectEvent event;

    @Mock
    private Principal principal;

    @Test
    @DisplayName("handleWebSocketDisconnectListener updates user status to OFFLINE")
    void handleWebSocketDisconnectListener_updatesStatusToOffline() {
        UUID userId = UUID.randomUUID();
        when(event.getUser()).thenReturn(principal);
        when(principal.getName()).thenReturn(userId.toString());

        presenceListener.handleWebSocketDisconnectListener(event);

        verify(userService).updateUserStatus(userId, UserStatus.OFFLINE);
    }
    
    @Test
    @DisplayName("handleWebSocketDisconnectListener ignores event if principal is null")
    void handleWebSocketDisconnectListener_ignoresNullPrincipal() {
        when(event.getUser()).thenReturn(null);

        presenceListener.handleWebSocketDisconnectListener(event);

        verify(userService, never()).updateUserStatus(any(), any());
    }
}
