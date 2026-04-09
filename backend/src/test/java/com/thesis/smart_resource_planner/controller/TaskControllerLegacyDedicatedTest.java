package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.enums.TaskPriority;
import com.thesis.smart_resource_planner.model.dto.TaskCreateDTO;
import com.thesis.smart_resource_planner.model.dto.TaskDTO;
import com.thesis.smart_resource_planner.model.dto.TaskUpdateDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskService;
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
@DisplayName("TaskController Tests")
class TaskControllerLegacyDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TaskService taskService;

    private TaskDTO testTaskDTO;
    private TaskCreateDTO createDTO;
    private TaskUpdateDTO updateDTO;
    private UUID taskId;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        taskId = UUID.randomUUID();
        testTaskDTO = new TaskDTO();
        testTaskDTO.setId(taskId);
        testTaskDTO.setTitle("Test Task");
        testTaskDTO.setDescription("Task Description");

        createDTO = new TaskCreateDTO();
        createDTO.setTitle("Test Task");
        createDTO.setDescription("Task Description");
        createDTO.setPriority(TaskPriority.MEDIUM);
        createDTO.setDueDate(java.time.LocalDateTime.now().plusDays(1));

        updateDTO = new TaskUpdateDTO();
        updateDTO.setTitle("Updated Task");

        Company company = new Company();
        company.setId(UUID.randomUUID());
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setUsername("manager");
        u.setEmail("manager@example.com");
        u.setPasswordHash("hash");
        u.setRole(UserRole.MANAGER);
        u.setCompany(company);
        principal = UserPrincipal.create(u);
    }

    @Test
    @DisplayName("Should retrieve task by ID with status 200")
    void testGetTaskById_Success() throws Exception {
        when(taskService.getTaskById(taskId)).thenReturn(testTaskDTO);

        mockMvc.perform(get("/api/tasks/{id}", taskId)
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(taskId.toString()))
                .andExpect(jsonPath("$.title").value("Test Task"));

        verify(taskService, times(1)).getTaskById(taskId);
    }

    @Test
    @DisplayName("Should retrieve all tasks with status 200")
    void testGetAllTasks_Success() throws Exception {
        when(taskService.getAllTasks(any(UUID.class))).thenReturn(Arrays.asList(testTaskDTO));

        mockMvc.perform(get("/api/tasks")
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        verify(taskService, times(1)).getAllTasks(any(UUID.class));
    }

    @Test
    @DisplayName("Should create task with status 201")
    void testCreateTask_Success() throws Exception {
        when(taskService.createTask(any(TaskCreateDTO.class), any(UUID.class))).thenReturn(testTaskDTO);

        mockMvc.perform(post("/api/tasks")
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createDTO)))
                .andExpect(status().isCreated());

        verify(taskService, times(1)).createTask(any(TaskCreateDTO.class), any(UUID.class));
    }

    @Test
    @DisplayName("Should update task with status 200")
    void testUpdateTask_Success() throws Exception {
        when(taskService.canUserEditTask(eq(taskId), any(UUID.class))).thenReturn(true);
        when(taskService.updateTask(eq(taskId), any(TaskUpdateDTO.class), any(UUID.class))).thenReturn(testTaskDTO);

        mockMvc.perform(put("/api/tasks/{id}", taskId)
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateDTO)))
                .andExpect(status().isOk());

        verify(taskService, times(1)).updateTask(eq(taskId), any(TaskUpdateDTO.class), any(UUID.class));
    }

    @Test
    @DisplayName("Should delete task with status 204")
    void testDeleteTask_Success() throws Exception {
        when(taskService.canUserDeleteTask(eq(taskId), any(UUID.class))).thenReturn(true);
        doNothing().when(taskService).deleteTask(taskId);

        mockMvc.perform(delete("/api/tasks/{id}", taskId).with(user(principal)))
                .andExpect(status().isNoContent());

        verify(taskService, times(1)).deleteTask(taskId);
    }

    @Test
    @DisplayName("Should return 403 when update permission denied")
    void testUpdateTask_Forbidden() throws Exception {
        when(taskService.canUserEditTask(eq(taskId), any(UUID.class))).thenReturn(false);

        mockMvc.perform(put("/api/tasks/{id}", taskId)
                        .with(user(principal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateDTO)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Should return 403 when delete permission denied")
    void testDeleteTask_Forbidden() throws Exception {
        when(taskService.canUserDeleteTask(eq(taskId), any(UUID.class))).thenReturn(false);

        mockMvc.perform(delete("/api/tasks/{id}", taskId).with(user(principal)))
                .andExpect(status().isForbidden());
    }
}
