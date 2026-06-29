package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.enums.AssignedByType;
import com.thesis.smart_resource_planner.enums.TaskAssignmentStatus;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.TaskAssignmentDTO;
import com.thesis.smart_resource_planner.model.dto.ai.TaskAssignmentRequestDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskAssignmentService;
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
@DisplayName("TaskAssignmentController Dedicated Tests")
@SuppressWarnings("removal")
class TaskAssignmentControllerDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TaskAssignmentService assignmentService;

    private TaskAssignmentDTO testAssignmentDTO;
    private TaskAssignmentRequestDTO requestDTO;
    private UserPrincipal adminPrincipal;
    private UserPrincipal employeePrincipal;
    private UUID adminUserId;
    private UUID employeeUserId;
    private UUID assignmentId;
    private UUID taskId;
    private UUID employeeId;

    @BeforeEach
    void setUp() {
        assignmentId = UUID.randomUUID();
        adminUserId = UUID.randomUUID();
        employeeUserId = UUID.randomUUID();
        taskId = UUID.randomUUID();
        employeeId = UUID.randomUUID();

        testAssignmentDTO = new TaskAssignmentDTO();
        testAssignmentDTO.setId(assignmentId);
        testAssignmentDTO.setTaskId(taskId);
        testAssignmentDTO.setTaskTitle("Implement Auth");
        testAssignmentDTO.setEmployeeId(employeeId);
        testAssignmentDTO.setStatus(TaskAssignmentStatus.PENDING);
        testAssignmentDTO.setAssignedBy(AssignedByType.MANUAL);

        requestDTO = new TaskAssignmentRequestDTO();
        requestDTO.setTaskId(taskId);
        requestDTO.setEmployeeId(employeeId);

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
    @DisplayName("Should assign task successfully when requested by ADMIN")
    void testAssignTask_Success() throws Exception {
        when(assignmentService.assignTask(any(TaskAssignmentRequestDTO.class))).thenReturn(testAssignmentDTO);

        mockMvc.perform(post("/api/assignments")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDTO)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(assignmentId.toString()))
                .andExpect(jsonPath("$.taskTitle").value("Implement Auth"));

        verify(assignmentService, times(1)).assignTask(any(TaskAssignmentRequestDTO.class));
    }

    @Test
    @DisplayName("Should retrieve assignment by ID")
    void testGetAssignmentById_Success() throws Exception {
        when(assignmentService.getAssignmentById(assignmentId)).thenReturn(testAssignmentDTO);

        mockMvc.perform(get("/api/assignments/{id}", assignmentId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(assignmentId.toString()));

        verify(assignmentService, times(1)).getAssignmentById(assignmentId);
    }

    @Test
    @DisplayName("Should retrieve assignments by task ID")
    void testGetAssignmentsByTask_Success() throws Exception {
        when(assignmentService.getAssignmentsByTask(taskId)).thenReturn(Arrays.asList(testAssignmentDTO));

        mockMvc.perform(get("/api/assignments/task/{taskId}", taskId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].taskId").value(taskId.toString()));

        verify(assignmentService, times(1)).getAssignmentsByTask(taskId);
    }

    @Test
    @DisplayName("Should retrieve assignments by employee ID")
    void testGetAssignmentsByEmployee_Success() throws Exception {
        when(assignmentService.getAssignmentsByEmployee(employeeId)).thenReturn(Arrays.asList(testAssignmentDTO));

        mockMvc.perform(get("/api/assignments/employee/{employeeId}", employeeId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].employeeId").value(employeeId.toString()));

        verify(assignmentService, times(1)).getAssignmentsByEmployee(employeeId);
    }

    @Test
    @DisplayName("Should retrieve active assignments by employee ID")
    void testGetActiveAssignmentsByEmployee_Success() throws Exception {
        when(assignmentService.getActiveAssignmentsByEmployee(employeeId)).thenReturn(Arrays.asList(testAssignmentDTO));

        mockMvc.perform(get("/api/assignments/employee/{employeeId}/active", employeeId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].employeeId").value(employeeId.toString()));

        verify(assignmentService, times(1)).getActiveAssignmentsByEmployee(employeeId);
    }

    @Test
    @DisplayName("Should accept assignment successfully")
    void testAcceptAssignment_Success() throws Exception {
        testAssignmentDTO.setStatus(TaskAssignmentStatus.ACCEPTED);
        when(assignmentService.acceptAssignment(assignmentId)).thenReturn(testAssignmentDTO);

        mockMvc.perform(patch("/api/assignments/{id}/accept", assignmentId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        verify(assignmentService, times(1)).acceptAssignment(assignmentId);
    }


    @Test
    @DisplayName("Should reject assignment successfully")
    void testRejectAssignment_Success() throws Exception {
        testAssignmentDTO.setStatus(TaskAssignmentStatus.REJECTED);
        when(assignmentService.rejectAssignment(assignmentId)).thenReturn(testAssignmentDTO);

        mockMvc.perform(patch("/api/assignments/{id}/reject", assignmentId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));

        verify(assignmentService, times(1)).rejectAssignment(assignmentId);
    }

    @Test
    @DisplayName("Should delete assignment successfully by ADMIN")
    void testDeleteAssignment_Success() throws Exception {
        doNothing().when(assignmentService).deleteAssignment(assignmentId);

        mockMvc.perform(delete("/api/assignments/{id}", assignmentId)
                        .with(user(adminPrincipal)))
                .andExpect(status().isNoContent());

        verify(assignmentService, times(1)).deleteAssignment(assignmentId);
    }
}
