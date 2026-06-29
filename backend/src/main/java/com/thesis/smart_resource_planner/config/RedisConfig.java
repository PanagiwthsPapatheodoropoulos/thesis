package com.thesis.smart_resource_planner.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Redis cache configuration for the Spring Boot backend.
 *
 * <p>
 * Configures a {@link RedisCacheManager} with JSON serialization and
 * per-cache TTL (time-to-live) policies. Uses a custom {@link ObjectMapper}
 * with {@link JavaTimeModule} registered to correctly serialize/deserialize
 * {@code LocalDate}, {@code LocalDateTime}, {@code BigDecimal}, and other
 * Java types used in the DTO layer.
 * </p>
 *
 * <p>Falls back to a no-op cache manager when a {@link RedisConnectionFactory}
 * is not available (for example, in test environments).</p>
 */
@Configuration
@Slf4j
public class RedisConfig implements CachingConfigurer {

        /**
         * Prevents Redis outages or deserialization issues from breaking API requests.
         * When cache operations fail, business logic continues and DB-backed responses are returned.
         */
        @Bean
        public CacheErrorHandler cacheErrorHandler() {
                return new CacheErrorHandler() {
                        @Override
                        public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                                log.warn("Cache GET failed for cache '{}' and key '{}'. Falling back to source. Cause: {}",
                                                cache != null ? cache.getName() : "unknown",
                                                key,
                                                exception.getMessage());

                                // Best-effort cleanup of potentially corrupted entries.
                                if (cache != null && key != null) {
                                        try {
                                                cache.evictIfPresent(key);
                                        } catch (Exception ignored) {
                                                // Ignore secondary cache cleanup failures.
                                        }
                                }
                        }

                        @Override
                        public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                                String valueType = value != null ? value.getClass().getName() : "null";
                                log.warn("Cache PUT failed for cache '{}' and key '{}' (value type: {}). Cause: {}",
                                                cache != null ? cache.getName() : "unknown",
                                                key,
                                                valueType,
                                                exception.getMessage(),
                                                exception);
                        }

                        @Override
                        public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                                log.warn("Cache EVICT failed for cache '{}' and key '{}'. Cause: {}",
                                                cache != null ? cache.getName() : "unknown",
                                                key,
                                                exception.getMessage());
                        }

                        @Override
                        public void handleCacheClearError(RuntimeException exception, Cache cache) {
                                log.warn("Cache CLEAR failed for cache '{}'. Cause: {}",
                                                cache != null ? cache.getName() : "unknown",
                                                exception.getMessage());
                        }
                };
        }

        @Override
        public CacheErrorHandler errorHandler() {
                return cacheErrorHandler();
        }

    /**
     * Creates a {@link RedisCacheManager} with JSON value serialization
     * and named cache configurations with varying TTLs.
     *
     * @param connectionFactory the Redis connection factory auto-configured
     *                          by Spring Boot
     * @return the configured cache manager
     */
        @Bean
        public CacheManager cacheManager(ObjectProvider<RedisConnectionFactory> connectionFactoryProvider,
                        ObjectMapper objectMapper) {
        RedisConnectionFactory connectionFactory = connectionFactoryProvider.getIfAvailable();
        if (connectionFactory == null) {
                log.warn("RedisConnectionFactory not available; using NoOpCacheManager");
                return new NoOpCacheManager();
        }
        ObjectMapper cacheMapper = objectMapper.copy();
        cacheMapper.registerModule(new JavaTimeModule());
        cacheMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        cacheMapper.disable(SerializationFeature.FAIL_ON_EMPTY_BEANS);
        cacheMapper.activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY);

        GenericJackson2JsonRedisSerializer jsonSerializer =
                new GenericJackson2JsonRedisSerializer(cacheMapper);

        // Default cache config: 10-minute TTL with JSON serialization
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10))
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(jsonSerializer))
                .disableCachingNullValues();

        // Per-cache TTL configurations
        Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();

        // Skills — rarely change, long TTL
        cacheConfigurations.put("skills", defaultConfig.entryTtl(Duration.ofMinutes(30)));
        cacheConfigurations.put("skill", defaultConfig.entryTtl(Duration.ofMinutes(30)));

        // Employees — moderate change frequency
        cacheConfigurations.put("employees", defaultConfig.entryTtl(Duration.ofMinutes(5)));
        cacheConfigurations.put("employee", defaultConfig.entryTtl(Duration.ofMinutes(10)));
        cacheConfigurations.put("employeeByUser", defaultConfig.entryTtl(Duration.ofMinutes(10)));
        cacheConfigurations.put("employeeSkills", defaultConfig.entryTtl(Duration.ofMinutes(10)));

        // Workload — volatile (depends on task status changes), short TTL
        cacheConfigurations.put("employeeWorkload", defaultConfig.entryTtl(Duration.ofMinutes(2)));

        // Departments — static data, long TTL
        cacheConfigurations.put("departments", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        cacheConfigurations.put("departmentNames", defaultConfig.entryTtl(Duration.ofMinutes(30)));

        // Company — rarely changes
        cacheConfigurations.put("company", defaultConfig.entryTtl(Duration.ofMinutes(30)));

        // Tasks — change frequently, short TTL
        cacheConfigurations.put("taskById", defaultConfig.entryTtl(Duration.ofMinutes(2)));

        log.info("Redis CacheManager configured with {} named caches (JavaTimeModule enabled)", cacheConfigurations.size());

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigurations)
                .transactionAware()
                .build();
    }
}
