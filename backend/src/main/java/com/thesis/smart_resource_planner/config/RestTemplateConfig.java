// src/main/java/com/thesis/smart_resource_planner/config/RestTemplateConfig.java
package com.thesis.smart_resource_planner.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * Spring {@link org.springframework.context.annotation.Configuration} class
 * that registers a shared {@link org.springframework.web.client.RestTemplate}
 * bean used for outbound HTTP communication (e.g., calls to the AI
 * microservice).
 *
 * <p>
 * The bean is configured with explicit connection and read timeouts to prevent
 * indefinite blocking when the remote service is slow or unavailable.
 * </p>
 */
@Configuration
public class RestTemplateConfig {

    /**
     * Creates and configures the application-wide {@link RestTemplate} bean.
     *
     * <ul>
     * <li><b>Connect timeout:</b> 10 000 ms — maximum time to establish a TCP
     * connection.</li>
     * <li><b>Read timeout:</b> 30 000 ms — maximum time to wait for data after the
     * connection
     * is established (accommodates slow AI inference calls).</li>
     * </ul>
     *
     * @param builder Spring Boot's auto-configured {@link RestTemplateBuilder}
     * @return the configured {@link RestTemplate} instance
     */
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(10000)); // 10 s connection timeout
        requestFactory.setReadTimeout(Duration.ofMillis(30000)); // 30 s read timeout

        return builder.requestFactory(() -> requestFactory).build();
    }
}