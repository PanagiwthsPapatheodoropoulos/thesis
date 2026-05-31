package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.enums.NotificationType;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.NotificationCreateDTO;
import com.thesis.smart_resource_planner.model.dto.NotificationDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("NotificationController Dedicated Tests")
@SuppressWarnings("removal")
class NotificationControllerDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private NotificationService notificationService;

    private NotificationDTO testNotificationDTO;
    private NotificationCreateDTO createDTO;
    private UserPrincipal adminPrincipal;
    private UserPrincipal employeePrincipal;
    private UUID adminUserId;
    private UUID employeeUserId;
    private UUID notificationId;

    @BeforeEach
    void setUp() {
        notificationId = UUID.randomUUID();
        adminUserId = UUID.randomUUID();
        employeeUserId = UUID.randomUUID();

        testNotificationDTO = new NotificationDTO();
        testNotificationDTO.setId(notificationId);
        testNotificationDTO.setUserId(employeeUserId);
        testNotificationDTO.setTitle("Task Assigned");
        testNotificationDTO.setMessage("New Task Assigned");
        testNotificationDTO.setIsRead(false);
        testNotificationDTO.setType(NotificationType.TASK_ASSIGNED);

        createDTO = new NotificationCreateDTO();
        createDTO.setUserId(employeeUserId);
        createDTO.setTitle("Task Assigned");
        createDTO.setMessage("New Task Assigned");
        createDTO.setType(NotificationType.TASK_ASSIGNED);

        Company company = new Company();
        company.setId(UUID.randomUUID());

        // Admin User
        User admin = new User();
        admin.setId(adminUserId);
        admin.setUsername("adminUser");
        admin.setEmail("admin@example.com");
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);
        adminPrincipal = UserPrincipal.create(admin);

        // Employee User
        User employee = new User();
        employee.setId(employeeUserId);
        employee.setUsername("employeeUser");
        employee.setEmail("emp@example.com");
        employee.setRole(UserRole.EMPLOYEE);
        employee.setCompany(company);
        employeePrincipal = UserPrincipal.create(employee);
    }

    @Test
    @DisplayName("Should create notification when user is ADMIN")
    void testCreateNotification_Admin_Success() throws Exception {
        when(notificationService.createNotification(any(NotificationCreateDTO.class)))
                .thenReturn(testNotificationDTO);

        mockMvc.perform(post("/api/notifications")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("New Task Assigned"));

        verify(notificationService, times(1)).createNotification(any(NotificationCreateDTO.class));
    }

    @Test
    @DisplayName("Should return 403 Forbidden for create notification when user is EMPLOYEE")
    void testCreateNotification_Employee_Forbidden() throws Exception {
        mockMvc.perform(post("/api/notifications")
                        .with(user(employeePrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andExpect(status().isForbidden());

        verify(notificationService, never()).createNotification(any(NotificationCreateDTO.class));
    }

    @Test
    @DisplayName("Should retrieve notification by ID")
    void testGetNotificationById_Success() throws Exception {
        when(notificationService.getNotificationById(notificationId)).thenReturn(testNotificationDTO);

        mockMvc.perform(get("/api/notifications/{id}", notificationId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(notificationId.toString()))
                .andExpect(jsonPath("$.message").value("New Task Assigned"));

        verify(notificationService, times(1)).getNotificationById(notificationId);
    }

    @Test
    @DisplayName("Should retrieve notifications by user ID")
    void testGetNotificationsByUser_Success() throws Exception {
        when(notificationService.getNotificationsByUser(employeeUserId))
                .thenReturn(Arrays.asList(testNotificationDTO));

        mockMvc.perform(get("/api/notifications/user/{userId}", employeeUserId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(notificationId.toString()));

        verify(notificationService, times(1)).getNotificationsByUser(employeeUserId);
    }

    @Test
    @DisplayName("Should retrieve unread notifications by user ID")
    void testGetUnreadNotifications_Success() throws Exception {
        when(notificationService.getUnreadNotifications(employeeUserId))
                .thenReturn(Arrays.asList(testNotificationDTO));

        mockMvc.perform(get("/api/notifications/user/{userId}/unread", employeeUserId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].isRead").value(false));

        verify(notificationService, times(1)).getUnreadNotifications(employeeUserId);
    }

    @Test
    @DisplayName("Should retrieve unread notification count by user ID")
    void testGetUnreadCount_Success() throws Exception {
        when(notificationService.getUnreadCount(employeeUserId)).thenReturn(5L);

        mockMvc.perform(get("/api/notifications/user/{userId}/unread/count", employeeUserId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(content().string("5"));

        verify(notificationService, times(1)).getUnreadCount(employeeUserId);
    }

    @Test
    @DisplayName("Should mark notification as read")
    void testMarkAsRead_Success() throws Exception {
        testNotificationDTO.setIsRead(true);
        when(notificationService.markAsRead(notificationId)).thenReturn(testNotificationDTO);

        mockMvc.perform(patch("/api/notifications/{id}/read", notificationId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isRead").value(true));

        verify(notificationService, times(1)).markAsRead(notificationId);
    }

    @Test
    @DisplayName("Should mark all notifications as read for a user")
    void testMarkAllAsRead_Success() throws Exception {
        doNothing().when(notificationService).markAllAsRead(employeeUserId);

        mockMvc.perform(patch("/api/notifications/user/{userId}/read-all", employeeUserId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk());

        verify(notificationService, times(1)).markAllAsRead(employeeUserId);
    }

    @Test
    @DisplayName("Should delete notification by ID")
    void testDeleteNotification_Success() throws Exception {
        doNothing().when(notificationService).deleteNotification(notificationId);

        mockMvc.perform(delete("/api/notifications/{id}", notificationId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isNoContent());

        verify(notificationService, times(1)).deleteNotification(notificationId);
    }
}
