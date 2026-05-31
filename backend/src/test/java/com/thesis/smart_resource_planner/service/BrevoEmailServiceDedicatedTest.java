package com.thesis.smart_resource_planner.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@ActiveProfiles("test")
@DisplayName("BrevoEmailService Dedicated Tests")
class BrevoEmailServiceDedicatedTest {

    @Autowired
    private BrevoEmailService emailService;

    @MockBean
    private RestTemplate restTemplate;

    @BeforeEach
    void setUp() {
        // Set standard fields
        ReflectionTestUtils.setField(emailService, "apiKey", "test-api-key");
        ReflectionTestUtils.setField(emailService, "senderEmail", "noreply@smartallocation.com");
        ReflectionTestUtils.setField(emailService, "senderName", "Smart Allocation");
    }

    @Test
    @DisplayName("Should skip sending join code if API key is missing")
    void testSendCompanyJoinCode_ApiKeyMissing() {
        ReflectionTestUtils.setField(emailService, "apiKey", "");
        
        emailService.sendCompanyJoinCode("test@example.com", "adminUser", "Acme Inc", "CODE123");
        
        verifyNoInteractions(restTemplate);
    }

    @Test
    @DisplayName("Should send company join code successfully when API key is present")
    void testSendCompanyJoinCode_Success() {
        ResponseEntity<String> response = new ResponseEntity<>("Success", HttpStatus.OK);
        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenReturn(response);

        emailService.sendCompanyJoinCode("test@example.com", "adminUser", "Acme Inc", "CODE123");

        ArgumentCaptor<HttpEntity> captor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate, times(1)).exchange(
                eq("https://api.brevo.com/v3/smtp/email"),
                eq(HttpMethod.POST),
                captor.capture(),
                eq(String.class)
        );

        HttpEntity<Map<String, Object>> entity = captor.getValue();
        assertNotNull(entity);
        assertEquals("test-api-key", entity.getHeaders().getFirst("api-key"));
        
        Map<String, Object> body = entity.getBody();
        assertNotNull(body);
        assertEquals("Your company join code – Acme Inc", body.get("subject"));
    }

    @Test
    @DisplayName("Should send welcome email successfully")
    void testSendCompanyWelcomeEmail_Success() {
        ResponseEntity<String> response = new ResponseEntity<>("Success", HttpStatus.OK);
        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenReturn(response);

        emailService.sendCompanyWelcomeEmail("admin@example.com", "adminUser", "Acme Inc", "CODE123");

        verify(restTemplate, times(1)).exchange(
                anyString(),
                any(HttpMethod.class),
                any(HttpEntity.class),
                eq(String.class)
        );
    }

    @Test
    @DisplayName("Should send join request confirmation successfully")
    void testSendJoinRequestConfirmation_Success() {
        ResponseEntity<String> response = new ResponseEntity<>("Success", HttpStatus.OK);
        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenReturn(response);

        emailService.sendJoinRequestConfirmation("user@example.com", "user1", "Acme Inc");

        verify(restTemplate, times(1)).exchange(
                anyString(),
                any(HttpMethod.class),
                any(HttpEntity.class),
                eq(String.class)
        );
    }

    @Test
    @DisplayName("Should send employee approved email successfully")
    void testSendEmployeeApprovedEmail_Success() {
        ResponseEntity<String> response = new ResponseEntity<>("Success", HttpStatus.OK);
        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenReturn(response);

        emailService.sendEmployeeApprovedEmail("emp@example.com", "emp1", "Acme Inc");

        verify(restTemplate, times(1)).exchange(
                anyString(),
                any(HttpMethod.class),
                any(HttpEntity.class),
                eq(String.class)
        );
    }

    @Test
    @DisplayName("Should send dismissal email successfully")
    void testSendDismissalEmail_Success() {
        ResponseEntity<String> response = new ResponseEntity<>("Success", HttpStatus.OK);
        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenReturn(response);

        emailService.sendDismissalEmail("emp@example.com", "emp1", "Acme Inc");

        verify(restTemplate, times(1)).exchange(
                anyString(),
                any(HttpMethod.class),
                any(HttpEntity.class),
                eq(String.class)
        );
    }

    @Test
    @DisplayName("Should send blocked email successfully")
    void testSendBlockedEmail_Success() {
        ResponseEntity<String> response = new ResponseEntity<>("Success", HttpStatus.OK);
        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenReturn(response);

        emailService.sendBlockedEmail("emp@example.com", "emp1", "Acme Inc");

        verify(restTemplate, times(1)).exchange(
                anyString(),
                any(HttpMethod.class),
                any(HttpEntity.class),
                eq(String.class)
        );
    }

    @Test
    @DisplayName("Should log warning when restTemplate throws an exception")
    void testSendEmail_Exception() {
        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new RuntimeException("Connection timeout"));

        // Should not throw exception from service method
        assertDoesNotThrow(() -> emailService.sendBlockedEmail("emp@example.com", "emp1", "Acme Inc"));
    }
}
