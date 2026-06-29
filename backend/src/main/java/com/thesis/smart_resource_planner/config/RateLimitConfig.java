package com.thesis.smart_resource_planner.config;

import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.lettuce.core.RedisClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;

import java.time.Duration;

@Configuration
@ConditionalOnProperty(name = "app.rate-limiting.enabled", havingValue = "true", matchIfMissing = true)
public class RateLimitConfig {

    @Bean
    public LettuceBasedProxyManager<byte[]> proxyManager(RedisConnectionFactory redisConnectionFactory) {
        if (redisConnectionFactory instanceof LettuceConnectionFactory) {
            LettuceConnectionFactory lettuceConnectionFactory = (LettuceConnectionFactory) redisConnectionFactory;
            Object nativeClient = lettuceConnectionFactory.getNativeClient();

            if (nativeClient instanceof RedisClient) {
                RedisClient redisClient = (RedisClient) nativeClient;
                return LettuceBasedProxyManager.builderFor(redisClient)
                        .withExpirationStrategy(ExpirationAfterWriteStrategy
                                .basedOnTimeForRefillingBucketUpToMax(Duration.ofSeconds(10)))
                        .build();
            }
        }
        throw new IllegalStateException("LettuceConnectionFactory with RedisClient is required for RateLimitConfig");
    }
}
