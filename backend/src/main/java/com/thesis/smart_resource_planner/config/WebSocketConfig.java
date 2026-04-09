// src/main/java/com/thesis/smart_resource_planner/config/WebSocketConfig.java
package com.thesis.smart_resource_planner.config;

import com.thesis.smart_resource_planner.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

import java.util.UUID;

/**
 * STOMP-over-WebSocket configuration for real-time messaging.
 * Registers a simple in-memory message broker, exposes the /ws endpoint with
 * SockJS fallback, and validates JWT tokens on CONNECT frames before allowing
 * the connection to proceed.
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
@Slf4j
@Order(Ordered.HIGHEST_PRECEDENCE + 99)
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtTokenProvider tokenProvider;
    private final UserDetailsService userDetailsService;

    /**
     * Configures the simple in-memory STOMP message broker.
     * Messages sent to /topic are broadcast; /queue is user-specific. Application
     * messages are routed via /app, and user-targeted messages via /user.
     *
     * @param config The {@link MessageBrokerRegistry} to configure.
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    /**
     * Registers the /ws STOMP endpoint with SockJS fallback support.
     * Allows connections from localhost and the internal Docker frontend network.
     *
     * @param registry The {@link StompEndpointRegistry} to register endpoints on.
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(
                        "http://localhost:*",
                        "http://127.0.0.1:*",
                        "http://frontend:*" // Docker internal network
                )
                .setAllowedOrigins(
                        "http://localhost:3000",
                        "http://localhost:8080",
                        "http://127.0.0.1:3000")
                .withSockJS()
                .setSessionCookieNeeded(false);
    }

    /**
     * Tunes WebSocket transport limits to support larger messages and slower
     * clients.
     * Message size is capped at 256 KB, send buffer at 512 KB, and the first
     * message
     * must arrive within 30 seconds.
     *
     * @param registration The {@link WebSocketTransportRegistration} to configure.
     */
    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration
                .setMessageSizeLimit(256 * 1024)
                .setSendBufferSizeLimit(512 * 1024)
                .setSendTimeLimit(20 * 1000)
                .setTimeToFirstMessage(30 * 1000);
    }

    /**
     * Registers a channel interceptor that validates the JWT from the STOMP CONNECT
     * frame.
     * On successful validation the authenticated user is set on the STOMP session,
     * making it available to message-mapping methods.
     *
     * @param registration The inbound channel registration.
     */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authToken = accessor.getFirstNativeHeader("Authorization");

                    if (authToken != null && authToken.startsWith("Bearer ")) {
                        String jwt = authToken.substring(7);

                        try {
                            if (tokenProvider.validateToken(jwt)) {
                                String username = tokenProvider.getUsernameFromToken(jwt);
                                UserDetails userDetails = userDetailsService.loadUserByUsername(username);

                                // extract userId from your custom principal
                                UUID userId = ((com.thesis.smart_resource_planner.security.UserPrincipal) userDetails)
                                        .getId();

                                // Create authentication where the *name* is the UUID string
                                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                                        userId.toString(), // principal name = UUID string
                                        null,
                                        userDetails.getAuthorities());

                                SecurityContextHolder.getContext().setAuthentication(authentication);
                                accessor.setUser(authentication);

                            } else {
                                log.error("Invalid JWT token");
                            }
                        } catch (Exception e) {
                            log.error("WebSocket auth failed: {}", e.getMessage());
                        }
                    } else {
                        log.warn("No Authorization header in WebSocket connection");
                    }
                }
                return message;
            }
        });
    }
}