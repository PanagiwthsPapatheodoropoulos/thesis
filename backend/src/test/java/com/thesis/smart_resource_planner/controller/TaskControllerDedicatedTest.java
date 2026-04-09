package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.enums.TaskPriority;
import com.thesis.smart_resource_planner.enums.TaskStatus;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.TaskCreateDTO;
import com.thesis.smart_resource_planner.model.dto.TaskDTO;
import com.thesis.smart_resource_planner.model.dto.TaskUpdateDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskControllerDedicatedTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private TaskService taskService;

    private UserPrincipal principal;
    private UUID taskId;
    private TaskCreateDTO validCreate;

    @BeforeEach
    void setup() {
        taskId = UUID.randomUUID();
        Company company = new Company();
        company.setId(UUID.randomUUID());
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setUsername("manager");
        u.setEmail("m@x.com");
        u.setPasswordHash("x");
        u.setRole(UserRole.MANAGER);
        u.setCompany(company);
        u.setIsActive(true);
        principal = UserPrincipal.create(u);

        validCreate = new TaskCreateDTO();
        validCreate.setTitle("Task");
        validCreate.setDescription("desc");
        validCreate.setPriority(TaskPriority.HIGH);
        validCreate.setDueDate(LocalDateTime.now().plusDays(1));
    }

    @Test
    @DisplayName("createTask returns 400 for missing title and dueDate")
    void createTask_validation400() throws Exception {
        TaskCreateDTO noTitle = new TaskCreateDTO();
        noTitle.setDueDate(LocalDateTime.now().plusDays(1));
        mockMvc.perform(post("/api/tasks")
                        .with(user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(noTitle)))
                .andExpect(status().isBadRequest());

        TaskCreateDTO noDueDate = new TaskCreateDTO();
        noDueDate.setTitle("x");
        mockMvc.perform(post("/api/tasks")
                        .with(user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(noDueDate)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("createTask maps service exceptions to 404/500")
    void createTask_exceptionMapping() throws Exception {
        when(taskService.createTask(any(TaskCreateDTO.class), any(UUID.class)))
                .thenThrow(new ResourceNotFoundException("x"));
        mockMvc.perform(post("/api/tasks")
                        .with(user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validCreate)))
                .andExpect(status().isNotFound());

        when(taskService.createTask(any(TaskCreateDTO.class), any(UUID.class)))
                .thenThrow(new RuntimeException("boom"));
        mockMvc.perform(post("/api/tasks")
                        .with(user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validCreate)))
                .andExpect(status().isInternalServerError());
    }

    @Test
    @DisplayName("request approve reject and status endpoints succeed")
    void requestApproveRejectStatus_paths() throws Exception {
        TaskDTO dto = new TaskDTO();
        dto.setId(taskId);
        Company employeeCompany = new Company();
        employeeCompany.setId(UUID.randomUUID());
        User employeeUser = new User();
        employeeUser.setId(UUID.randomUUID());
        employeeUser.setUsername("employee");
        employeeUser.setEmail("e@x.com");
        employeeUser.setPasswordHash("x");
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(employeeCompany);
        employeeUser.setIsActive(true);
        UserPrincipal employeePrincipal = UserPrincipal.create(employeeUser);

        when(taskService.createTaskRequest(any(TaskCreateDTO.class), any(UUID.class))).thenReturn(dto);
        when(taskService.approveTask(eq(taskId), any(UUID.class))).thenReturn(dto);
        when(taskService.updateTaskStatus(eq(taskId), eq(TaskStatus.IN_PROGRESS), any(UUID.class))).thenReturn(dto);

        mockMvc.perform(post("/api/tasks/request")
                        .with(user(employeePrincipal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validCreate)))
                .andExpect(status().isCreated());
        mockMvc.perform(patch("/api/tasks/{id}/approve", taskId).with(user(principal)).with(csrf()))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/tasks/{id}/reject", taskId).with(user(principal)).with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(patch("/api/tasks/{id}/status", taskId)
                        .with(user(principal))
                        .with(csrf())
                        .param("status", "IN_PROGRESS"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("batch required skills handles invalid and internal errors")
    void requiredSkillsBatch_errorBranches() throws Exception {
        mockMvc.perform(get("/api/tasks/required-skills/batch")
                        .with(user(principal))
                        .param("taskIds", "not-a-uuid"))
                .andExpect(status().isBadRequest());

        when(taskService.getTaskRequiredSkillsBatch(anyList())).thenThrow(new RuntimeException("db"));
        mockMvc.perform(get("/api/tasks/required-skills/batch")
                        .with(user(principal))
                        .param("taskIds", UUID.randomUUID().toString()))
                .andExpect(status().isInternalServerError());
    }

    @Test
    @DisplayName("paginated endpoint tolerates invalid status and priority")
    void paginated_invalidFilters_stillOk() throws Exception {
        when(taskService.getTasksPaginated(any(UUID.class), any(), isNull(), isNull(), any()))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        mockMvc.perform(get("/api/tasks/paginated")
                        .with(user(principal))
                        .param("status", "NOT_A_STATUS")
                        .param("priority", "NOT_A_PRIORITY")
                        .param("sortBy", "dueDate")
                        .param("sortDir", "asc"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("status priority team overdue and permission checks endpoints")
    void listAndPermissionEndpoints() throws Exception {
        UUID teamId = UUID.randomUUID();
        when(taskService.getTaskRequests(any(UUID.class))).thenReturn(List.of());
        when(taskService.getTaskRequiredSkillNames(taskId)).thenReturn(List.of("Java"));
        when(taskService.getTasksByStatus(TaskStatus.PENDING)).thenReturn(List.of());
        when(taskService.getTasksByPriority(TaskPriority.HIGH)).thenReturn(List.of());
        when(taskService.getTasksByTeam(teamId)).thenReturn(List.of());
        when(taskService.getOverdueTasks()).thenReturn(List.of());
        when(taskService.canUserEditTask(eq(taskId), any(UUID.class))).thenReturn(true);
        when(taskService.canUserDeleteTask(eq(taskId), any(UUID.class))).thenReturn(false);
        when(taskService.getAllTasks(any(UUID.class))).thenReturn(List.of());
        when(taskService.getTaskById(taskId)).thenReturn(new TaskDTO());

        mockMvc.perform(get("/api/tasks/requests").with(user(principal))).andExpect(status().isOk());
        mockMvc.perform(get("/api/tasks/{id}/required-skills", taskId).with(user(principal))).andExpect(status().isOk());
        mockMvc.perform(get("/api/tasks/status/PENDING").with(user(principal))).andExpect(status().isOk());
        mockMvc.perform(get("/api/tasks/priority/HIGH").with(user(principal))).andExpect(status().isOk());
        mockMvc.perform(get("/api/tasks/team/{id}", teamId).with(user(principal))).andExpect(status().isOk());
        mockMvc.perform(get("/api/tasks/overdue").with(user(principal))).andExpect(status().isOk());
        mockMvc.perform(get("/api/tasks/{id}/can-edit", taskId).with(user(principal))).andExpect(status().isOk());
        mockMvc.perform(get("/api/tasks/{id}/can-delete", taskId).with(user(principal))).andExpect(status().isOk());
        mockMvc.perform(get("/api/tasks/{id}", taskId).with(user(principal))).andExpect(status().isOk());
        mockMvc.perform(get("/api/tasks").with(user(principal))).andExpect(status().isOk());
    }

    @Test
    @DisplayName("update and delete respect permission checks")
    void updateDelete_permissionChecks() throws Exception {
        TaskUpdateDTO update = new TaskUpdateDTO();
        update.setTitle("Updated");
        when(taskService.canUserEditTask(eq(taskId), any(UUID.class))).thenReturn(false);
        mockMvc.perform(put("/api/tasks/{id}", taskId)
                        .with(user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isForbidden());

        when(taskService.canUserDeleteTask(eq(taskId), any(UUID.class))).thenReturn(false);
        mockMvc.perform(delete("/api/tasks/{id}", taskId)
                        .with(user(principal))
                        .with(csrf()))
                .andExpect(status().isForbidden());
    }
}
