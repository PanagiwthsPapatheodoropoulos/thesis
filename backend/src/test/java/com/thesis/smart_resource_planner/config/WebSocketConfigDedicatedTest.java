package com.thesis.smart_resource_planner.config;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.security.JwtTokenProvider;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("WebSocketConfig Dedicated Tests")
class WebSocketConfigDedicatedTest {

    @Mock
    private JwtTokenProvider tokenProvider;
    @Mock
    private UserDetailsService userDetailsService;
    @Mock
    private MessageBrokerRegistry brokerRegistry;
    @Mock
    private ChannelRegistration channelRegistration;
    @Mock
    private WebSocketTransportRegistration transportRegistration;
    @Mock
    private MessageChannel messageChannel;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("configureMessageBroker sets broker and destination prefixes")
    void configureMessageBroker_setsPrefixes() {
        when(brokerRegistry.enableSimpleBroker("/topic", "/queue")).thenReturn(null);
        WebSocketConfig config = new WebSocketConfig(tokenProvider, userDetailsService);
        config.configureMessageBroker(brokerRegistry);
    }

    @Test
    @DisplayName("configureWebSocketTransport sets limits")
    void configureWebSocketTransport_setsLimits() {
        when(transportRegistration.setMessageSizeLimit(any(Integer.class))).thenReturn(transportRegistration);
        when(transportRegistration.setSendBufferSizeLimit(any(Integer.class))).thenReturn(transportRegistration);
        when(transportRegistration.setSendTimeLimit(any(Integer.class))).thenReturn(transportRegistration);
        when(transportRegistration.setTimeToFirstMessage(any(Integer.class))).thenReturn(transportRegistration);

        WebSocketConfig config = new WebSocketConfig(tokenProvider, userDetailsService);
        config.configureWebSocketTransport(transportRegistration);
    }

    @Test
    @DisplayName("inbound interceptor authenticates valid bearer token")
    void inboundInterceptor_validToken_setsAuthentication() {
        ArgumentCaptor<ChannelInterceptor> interceptorCaptor = ArgumentCaptor.forClass(ChannelInterceptor.class);
        when(channelRegistration.interceptors(interceptorCaptor.capture())).thenReturn(channelRegistration);

        UUID userId = UUID.randomUUID();
        User user = User.builder()
                .id(userId)
                .username("ws-user")
                .email("ws@example.com")
                .passwordHash("hash")
                .role(UserRole.EMPLOYEE)
                .isActive(true)
                .build();
        UserPrincipal principal = UserPrincipal.create(user);

        when(tokenProvider.validateToken("jwt-token")).thenReturn(true);
        when(tokenProvider.getUsernameFromToken("jwt-token")).thenReturn("ws-user");
        when(userDetailsService.loadUserByUsername("ws-user")).thenReturn(principal);

        WebSocketConfig config = new WebSocketConfig(tokenProvider, userDetailsService);
        config.configureClientInboundChannel(channelRegistration);
        ChannelInterceptor interceptor = interceptorCaptor.getValue();

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setNativeHeader("Authorization", "Bearer jwt-token");
        accessor.setLeaveMutable(true);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        Message<?> result = interceptor.preSend(message, messageChannel);
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);

        assertNotNull(resultAccessor.getUser());
        assertEquals(userId.toString(), resultAccessor.getUser().getName());
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals(userId.toString(), SecurityContextHolder.getContext().getAuthentication().getName());
    }

    @Test
    @DisplayName("inbound interceptor keeps unauthenticated on missing header")
    void inboundInterceptor_missingHeader_noAuthentication() {
        ArgumentCaptor<ChannelInterceptor> interceptorCaptor = ArgumentCaptor.forClass(ChannelInterceptor.class);
        when(channelRegistration.interceptors(interceptorCaptor.capture())).thenReturn(channelRegistration);

        WebSocketConfig config = new WebSocketConfig(tokenProvider, userDetailsService);
        config.configureClientInboundChannel(channelRegistration);
        ChannelInterceptor interceptor = interceptorCaptor.getValue();

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        Message<?> result = interceptor.preSend(message, messageChannel);
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);

        assertNull(resultAccessor.getUser());
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
}

