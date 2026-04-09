package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.model.dto.TaskTimeEntryDTO;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskTimeEntryService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TaskTimeEntryController.class)
@ActiveProfiles("test")
class TaskTimeEntryControllerDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TaskTimeEntryService taskTimeEntryService;

    @MockBean
    private com.thesis.smart_resource_planner.repository.TaskRepository taskRepository;

    @MockBean
    private com.thesis.smart_resource_planner.repository.EmployeeRepository employeeRepository;

    @MockBean
    private com.thesis.smart_resource_planner.repository.UserRepository userRepository;

    @MockBean
    private com.thesis.smart_resource_planner.security.JwtTokenProvider jwtTokenProvider;

    @MockBean
    private com.thesis.smart_resource_planner.security.CustomUserDetailsService customUserDetailsService;

    @Test
    @WithMockUser(roles = {"EMPLOYEE"})
    @DisplayName("logTime returns 404 when task does not exist")
    void logTime_taskMissing() throws Exception {
        UUID taskId = UUID.randomUUID();
        TaskTimeEntryDTO dto = new TaskTimeEntryDTO();
        dto.setTaskId(taskId);
        dto.setHoursSpent(BigDecimal.ONE);
        dto.setWorkDate(LocalDateTime.now());

        when(taskRepository.existsById(taskId)).thenReturn(false);

        UserPrincipal principal = UserPrincipal.create(
                com.thesis.smart_resource_planner.model.entity.User.builder()
                        .id(UUID.randomUUID())
                        .username("u")
                        .email("u@x.com")
                        .passwordHash("x")
                        .isActive(true)
                        .role(com.thesis.smart_resource_planner.enums.UserRole.EMPLOYEE)
                        .build());

        mockMvc.perform(post("/api/tasks/time")
                        .with(user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(roles = {"EMPLOYEE"})
    @DisplayName("logTime returns 400 when hours are invalid")
    void logTime_invalidHours() throws Exception {
        UUID taskId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        TaskTimeEntryDTO dto = new TaskTimeEntryDTO();
        dto.setTaskId(taskId);
        dto.setHoursSpent(BigDecimal.ZERO);
        dto.setWorkDate(LocalDateTime.now());

        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.of(new com.thesis.smart_resource_planner.model.entity.Employee()));

        UserPrincipal principal = UserPrincipal.create(
                com.thesis.smart_resource_planner.model.entity.User.builder()
                        .id(userId)
                        .username("u")
                        .email("u@x.com")
                        .passwordHash("x")
                        .isActive(true)
                        .role(com.thesis.smart_resource_planner.enums.UserRole.EMPLOYEE)
                        .build());

        mockMvc.perform(post("/api/tasks/time")
                        .with(user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = {"EMPLOYEE"})
    @DisplayName("getTimeEntries returns 200 for existing task")
    void getTimeEntries_success() throws Exception {
        UUID taskId = UUID.randomUUID();
        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(taskTimeEntryService.getTimeEntriesByTask(taskId)).thenReturn(List.of(new TaskTimeEntryDTO()));

        mockMvc.perform(get("/api/tasks/time/task/{taskId}", taskId))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = {"EMPLOYEE"})
    @DisplayName("getTotalHours returns 404 for missing task")
    void getTotalHours_missingTask() throws Exception {
        UUID taskId = UUID.randomUUID();
        when(taskRepository.existsById(taskId)).thenReturn(false);

        mockMvc.perform(get("/api/tasks/time/task/{taskId}/total", taskId))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(roles = {"EMPLOYEE"})
    @DisplayName("logTime returns 201 for valid payload")
    void logTime_success_validPayload() throws Exception {
        UUID taskId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        TaskTimeEntryDTO dto = new TaskTimeEntryDTO();
        dto.setTaskId(taskId);
        dto.setHoursSpent(BigDecimal.valueOf(2));
        dto.setWorkDate(LocalDateTime.now());

        TaskTimeEntryDTO created = new TaskTimeEntryDTO();
        created.setTaskId(taskId);
        created.setHoursSpent(BigDecimal.valueOf(2));
        created.setWorkDate(LocalDateTime.now());

        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.of(new com.thesis.smart_resource_planner.model.entity.Employee()));
        when(taskTimeEntryService.logTime(any(TaskTimeEntryDTO.class), org.mockito.ArgumentMatchers.eq(userId))).thenReturn(created);

        UserPrincipal principal = UserPrincipal.create(
                com.thesis.smart_resource_planner.model.entity.User.builder()
                        .id(userId)
                        .username("u")
                        .email("u@x.com")
                        .passwordHash("x")
                        .isActive(true)
                        .role(com.thesis.smart_resource_planner.enums.UserRole.EMPLOYEE)
                        .build());

        mockMvc.perform(post("/api/tasks/time")
                        .with(user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.taskId").value(taskId.toString()));
    }

    @Test
    @WithMockUser(roles = {"EMPLOYEE"})
    @DisplayName("logTime returns 404 when employee profile does not exist")
    void logTime_employeeMissing() throws Exception {
        UUID taskId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        TaskTimeEntryDTO dto = new TaskTimeEntryDTO();
        dto.setTaskId(taskId);
        dto.setHoursSpent(BigDecimal.ONE);
        dto.setWorkDate(LocalDateTime.now());

        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.empty());

        UserPrincipal principal = UserPrincipal.create(
                com.thesis.smart_resource_planner.model.entity.User.builder()
                        .id(userId)
                        .username("u")
                        .email("u@x.com")
                        .passwordHash("x")
                        .isActive(true)
                        .role(com.thesis.smart_resource_planner.enums.UserRole.EMPLOYEE)
                        .build());

        mockMvc.perform(post("/api/tasks/time")
                        .with(user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(roles = {"EMPLOYEE"})
    @DisplayName("getTimeEntries returns 500 when service fails")
    void getTimeEntries_serviceError() throws Exception {
        UUID taskId = UUID.randomUUID();
        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(taskTimeEntryService.getTimeEntriesByTask(taskId)).thenThrow(new RuntimeException("boom"));

        mockMvc.perform(get("/api/tasks/time/task/{taskId}", taskId))
                .andExpect(status().isInternalServerError());
    }

    @Test
    @WithMockUser(roles = {"EMPLOYEE"})
    @DisplayName("getTotalHours returns 200 for existing task")
    void getTotalHours_success() throws Exception {
        UUID taskId = UUID.randomUUID();
        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(taskTimeEntryService.getTotalHours(taskId)).thenReturn(BigDecimal.valueOf(5.5));

        mockMvc.perform(get("/api/tasks/time/task/{taskId}/total", taskId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(5.5));
    }
}

