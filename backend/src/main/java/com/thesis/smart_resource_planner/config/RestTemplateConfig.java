package com.thesis.smart_resource_planner.config;

import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.core5.http.io.SocketConfig;
import org.apache.hc.core5.util.Timeout;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * Spring {@link org.springframework.context.annotation.Configuration} class
 * that registers a shared {@link org.springframework.web.client.RestTemplate}
 * bean used for outbound HTTP communication (e.g., calls to the AI
 * microservice).
 *
 * <p>
 * The bean is configured with explicit connection and read timeouts and 
 * connection pooling to prevent indefinite blocking when the remote service 
 * is slow or unavailable.
 * </p>
 */
@Configuration
@EnableAsync
public class RestTemplateConfig {

    /**
     * Creates and configures the application-wide {@link RestTemplate} bean.
     *
     * <ul>
     * <li><b>Connection Pool:</b> Max 100 total connections, default 20 per route.</li>
     * <li><b>Connect timeout:</b> 10 000 ms — maximum time to establish a TCP
     * connection.</li>
     * <li><b>Read timeout:</b> 30 000 ms — maximum time to wait for data after the
     * connection is established (accommodates slow AI inference calls).</li>
     * </ul>
     *
     * @param builder Spring Boot's auto-configured {@link RestTemplateBuilder}
     * @return the configured {@link RestTemplate} instance
     */
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        PoolingHttpClientConnectionManager connectionManager = new PoolingHttpClientConnectionManager();
        connectionManager.setMaxTotal(100);
        connectionManager.setDefaultMaxPerRoute(20);

        SocketConfig socketConfig = SocketConfig.custom()
                .setSoTimeout(Timeout.ofMilliseconds(30000)) // 30s read timeout
                .build();
        connectionManager.setDefaultSocketConfig(socketConfig);

        CloseableHttpClient httpClient = HttpClients.custom()
                .setConnectionManager(connectionManager)
                .build();

        HttpComponentsClientHttpRequestFactory requestFactory = new HttpComponentsClientHttpRequestFactory(httpClient);
        requestFactory.setConnectTimeout((int) Duration.ofSeconds(10).toMillis()); // 10s connect timeout

        return builder.requestFactory(() -> requestFactory).build();
    }
}