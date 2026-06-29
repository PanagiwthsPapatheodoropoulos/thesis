package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.enums.AuditAction;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.TaskAuditLogDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskAuditLogService;
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

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("TaskAuditLogController Dedicated Tests")
@SuppressWarnings("removal")
class TaskAuditLogControllerDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TaskAuditLogService auditLogService;

    private TaskAuditLogDTO testLogDTO;
    private UserPrincipal employeePrincipal;
    private UUID employeeUserId;
    private UUID taskId;
    private UUID logId;

    @BeforeEach
    void setUp() {
        logId = UUID.randomUUID();
        employeeUserId = UUID.randomUUID();
        taskId = UUID.randomUUID();

        testLogDTO = new TaskAuditLogDTO();
        testLogDTO.setId(logId);
        testLogDTO.setTaskId(taskId);
        testLogDTO.setUserId(employeeUserId);
        testLogDTO.setUserName("employeeUser");
        testLogDTO.setAction(AuditAction.TASK_CREATED);
        testLogDTO.setDescription("Task created by employeeUser");
        testLogDTO.setCreatedAt(LocalDateTime.now());

        Company company = new Company();
        company.setId(UUID.randomUUID());

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
    @DisplayName("Should retrieve task audit logs successfully")
    void testGetTaskHistory_Success() throws Exception {
        when(auditLogService.getTaskHistory(taskId)).thenReturn(Arrays.asList(testLogDTO));

        mockMvc.perform(get("/api/tasks/audit/task/{taskId}", taskId)
                        .with(user(employeePrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(logId.toString()))
                .andExpect(jsonPath("$[0].taskId").value(taskId.toString()))
                .andExpect(jsonPath("$[0].action").value("TASK_CREATED"))
                .andExpect(jsonPath("$[0].description").value("Task created by employeeUser"));

        verify(auditLogService, times(1)).getTaskHistory(taskId);
    }
}
