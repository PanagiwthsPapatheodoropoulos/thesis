package com.thesis.smart_resource_planner.config;

import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import io.lettuce.core.AbstractRedisClient;
import io.lettuce.core.RedisClient;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("RateLimitConfig Dedicated Tests")
class RateLimitConfigDedicatedTest {

    private final RateLimitConfig config = new RateLimitConfig();

    @Test
    @DisplayName("Should successfully construct proxyManager when LettuceConnectionFactory wraps RedisClient")
    @SuppressWarnings("unchecked")
    void testProxyManagerSuccess() {
        LettuceConnectionFactory connectionFactory = mock(LettuceConnectionFactory.class);
        RedisClient redisClient = mock(RedisClient.class);
        io.lettuce.core.api.StatefulRedisConnection connection = mock(io.lettuce.core.api.StatefulRedisConnection.class);
        io.lettuce.core.api.async.RedisAsyncCommands async = mock(io.lettuce.core.api.async.RedisAsyncCommands.class);

        when(connectionFactory.getNativeClient()).thenReturn(redisClient);
        when(redisClient.connect((io.lettuce.core.codec.RedisCodec) any())).thenReturn(connection);
        when(connection.async()).thenReturn(async);

        LettuceBasedProxyManager<byte[]> proxyManager = config.proxyManager(connectionFactory);
        assertNotNull(proxyManager);
    }

    @Test
    @DisplayName("Should throw IllegalStateException when factory is not LettuceConnectionFactory")
    void testProxyManagerInvalidFactory() {
        RedisConnectionFactory badFactory = mock(RedisConnectionFactory.class);

        IllegalStateException exception = assertThrows(IllegalStateException.class, () ->
                config.proxyManager(badFactory)
        );
        assertTrue(exception.getMessage().contains("LettuceConnectionFactory with RedisClient is required"));
    }

    @Test
    @DisplayName("Should throw IllegalStateException when native client is not RedisClient")
    void testProxyManagerInvalidNativeClient() {
        LettuceConnectionFactory connectionFactory = mock(LettuceConnectionFactory.class);
        AbstractRedisClient wrongClient = mock(AbstractRedisClient.class);

        when(connectionFactory.getNativeClient()).thenReturn(wrongClient);

        IllegalStateException exception = assertThrows(IllegalStateException.class, () ->
                config.proxyManager(connectionFactory)
        );
        assertTrue(exception.getMessage().contains("LettuceConnectionFactory with RedisClient is required"));
    }

    @Test
    @DisplayName("Should throw IllegalStateException when native client is null")
    void testProxyManagerNullNativeClient() {
        LettuceConnectionFactory connectionFactory = mock(LettuceConnectionFactory.class);

        when(connectionFactory.getNativeClient()).thenReturn(null);

        IllegalStateException exception = assertThrows(IllegalStateException.class, () ->
                config.proxyManager(connectionFactory)
        );
        assertTrue(exception.getMessage().contains("LettuceConnectionFactory with RedisClient is required"));
    }
}
