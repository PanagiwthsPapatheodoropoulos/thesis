package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.TaskStatus;
import com.thesis.smart_resource_planner.enums.TaskPriority;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.TaskUpdateDTO;
import com.thesis.smart_resource_planner.model.dto.TaskDTO;
import com.thesis.smart_resource_planner.model.entity.Team;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.time.LocalDateTime;
import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TaskService Tests")
class TaskServiceLegacyDedicatedTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private com.thesis.smart_resource_planner.repository.TeamRepository teamRepository;

    @Mock
    private com.thesis.smart_resource_planner.repository.UserRepository userRepository;

    @Mock
    private com.thesis.smart_resource_planner.repository.TaskAssignmentRepository taskAssignmentRepository;

    @Mock
    private com.thesis.smart_resource_planner.repository.TaskPermissionRepository taskPermissionRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private com.thesis.smart_resource_planner.repository.EmployeeRepository employeeRepository;

    @Mock
    private ModelMapper modelMapper;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private WebSocketBroadcastService broadcastService;

    @Mock
    private TaskAuditLogService auditLogService;

    @Mock
    private com.thesis.smart_resource_planner.repository.NotificationRepository notificationRepository;

    @Mock
    private com.thesis.smart_resource_planner.repository.TaskRequiredSkillRepository taskRequiredSkillRepository;

    @Mock
    private com.thesis.smart_resource_planner.repository.SkillRepository skillRepository;

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private TaskService taskService;

    private Task testTask;
    private UUID taskId;
    private UUID userId;
    private Company company;
    private User adminUser;

    @BeforeEach
    void setUp() {
        taskId = UUID.randomUUID();
        userId = UUID.randomUUID();

        company = new Company();
        company.setId(UUID.randomUUID());

        adminUser = new User();
        adminUser.setId(userId);
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setCompany(company);

        testTask = new Task();
        testTask.setId(taskId);
        testTask.setTitle("Test Task");
        testTask.setDescription("Task Description");
        testTask.setStatus(TaskStatus.PENDING);
        testTask.setCompany(company);
    }

    @Test
    @DisplayName("deleteTask: throws when task missing")
    void deleteTask_notFound() {
        when(taskRepository.existsById(taskId)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> taskService.deleteTask(taskId));
    }

    @Test
    @DisplayName("deleteTask: deletes when exists")
    void deleteTask_success() {
        when(taskRepository.existsById(taskId)).thenReturn(true);
        taskService.deleteTask(taskId);
        verify(taskRepository).deleteById(taskId);
    }

    @Test
    @DisplayName("canUserEditTask: admin can always edit")
    void canUserEditTask_admin_true() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(adminUser));
        assertTrue(taskService.canUserEditTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserDeleteTask: admin must match task company")
    void canUserDeleteTask_adminCompanyMismatch_false() {
        Company otherCompany = new Company();
        otherCompany.setId(UUID.randomUUID());

        Task otherTask = new Task();
        otherTask.setId(taskId);
        otherTask.setCompany(otherCompany);

        when(userRepository.findById(userId)).thenReturn(Optional.of(adminUser));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(otherTask));

        assertFalse(taskService.canUserDeleteTask(taskId, userId));
    }

    @Test
    @DisplayName("getTaskRequiredSkillsBatch: empty input returns empty map")
    void getTaskRequiredSkillsBatch_empty() {
        assertTrue(taskService.getTaskRequiredSkillsBatch(List.of()).isEmpty());
        assertTrue(taskService.getTaskRequiredSkillsBatch(null).isEmpty());
    }

    @Test
    @DisplayName("updateTaskStatus: throws when completing without permission")
    void updateTaskStatus_completed_withoutPermission_throws() {
        Task task = new Task();
        task.setId(taskId);
        task.setStatus(TaskStatus.IN_PROGRESS);
        task.setCompany(company);

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findById(userId)).thenReturn(Optional.of(adminUser));

        TaskService spyService = spy(taskService);
        doReturn(false).when(spyService).canUserCompleteTask(taskId, userId);

        assertThrows(IllegalStateException.class,
                () -> spyService.updateTaskStatus(taskId, TaskStatus.COMPLETED, userId));
    }

    @Test
    @DisplayName("canUserDeleteTask throws when user missing")
    void canUserDeleteTask_userNotFound() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> taskService.canUserDeleteTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserCompleteTask: employee can complete public task")
    void canUserCompleteTask_employee_publicTask_true() {
        User employeeUser = new User();
        employeeUser.setId(userId);
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);

        Task publicTask = new Task();
        publicTask.setId(taskId);
        publicTask.setTitle("Public Task");
        publicTask.setCompany(company);
        publicTask.setTeam(null);
        publicTask.setAssignedEmployeeId(null);
        publicTask.setAssignments(new java.util.ArrayList<>());

        when(userRepository.findById(userId)).thenReturn(Optional.of(employeeUser));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(publicTask));

        assertTrue(taskService.canUserCompleteTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserViewTask: manager with same team can view")
    void canUserViewTask_manager_sameTeam_true() {
        Team t = new Team();
        t.setId(UUID.randomUUID());

        User manager = new User();
        manager.setId(userId);
        manager.setRole(UserRole.MANAGER);
        manager.setCompany(company);
        manager.setTeam(t);

        Task teamTask = new Task();
        teamTask.setId(taskId);
        teamTask.setTeam(t);
        teamTask.setCompany(company);

        when(userRepository.findById(userId)).thenReturn(Optional.of(manager));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(teamTask));

        assertTrue(taskService.canUserViewTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserDeleteTask: manager can delete team task")
    void canUserDeleteTask_manager_sameTeam_true() {
        Team team = new Team();
        team.setId(UUID.randomUUID());

        User manager = new User();
        manager.setId(userId);
        manager.setRole(UserRole.MANAGER);
        manager.setCompany(company);
        manager.setTeam(team);

        Task teamTask = new Task();
        teamTask.setId(taskId);
        teamTask.setCompany(company);
        teamTask.setTeam(team);

        when(userRepository.findById(userId)).thenReturn(Optional.of(manager));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(teamTask));

        assertTrue(taskService.canUserDeleteTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserDeleteTask: employee own request is deletable")
    void canUserDeleteTask_employee_ownRequest_true() {
        User employee = new User();
        employee.setId(userId);
        employee.setRole(UserRole.EMPLOYEE);
        employee.setCompany(company);

        User creator = new User();
        creator.setId(userId);

        Task requestTask = new Task();
        requestTask.setId(taskId);
        requestTask.setCompany(company);
        requestTask.setTitle("[REQUEST] Need access");
        requestTask.setCreatedBy(creator);

        when(userRepository.findById(userId)).thenReturn(Optional.of(employee));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(requestTask));

        assertTrue(taskService.canUserDeleteTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserCompleteTask: employee in same team can complete")
    void canUserCompleteTask_employee_sameTeam_true() {
        Team team = new Team();
        team.setId(UUID.randomUUID());

        User employee = new User();
        employee.setId(userId);
        employee.setRole(UserRole.EMPLOYEE);
        employee.setCompany(company);
        employee.setTeam(team);

        Task teamTask = new Task();
        teamTask.setId(taskId);
        teamTask.setCompany(company);
        teamTask.setTeam(team);
        teamTask.setAssignments(new ArrayList<>());

        when(userRepository.findById(userId)).thenReturn(Optional.of(employee));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(teamTask));

        assertTrue(taskService.canUserCompleteTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserCompleteTask: explicit permission for non-employee")
    void canUserCompleteTask_permissionRecord_true() {
        User plainUser = new User();
        plainUser.setId(userId);
        plainUser.setRole(UserRole.USER);
        plainUser.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setAssignments(new ArrayList<>());

        com.thesis.smart_resource_planner.model.entity.TaskPermission p = new com.thesis.smart_resource_planner.model.entity.TaskPermission();
        p.setCanComplete(true);

        when(userRepository.findById(userId)).thenReturn(Optional.of(plainUser));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, userId)).thenReturn(Optional.of(p));

        assertTrue(taskService.canUserCompleteTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserEditTask: manager without team match cannot edit")
    void canUserEditTask_manager_teamMismatch_false() {
        Team managerTeam = new Team();
        managerTeam.setId(UUID.randomUUID());
        Team taskTeam = new Team();
        taskTeam.setId(UUID.randomUUID());

        User manager = new User();
        manager.setId(userId);
        manager.setRole(UserRole.MANAGER);
        manager.setCompany(company);
        manager.setTeam(managerTeam);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setTeam(taskTeam);

        when(userRepository.findById(userId)).thenReturn(Optional.of(manager));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));

        assertFalse(taskService.canUserEditTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserViewTask: plain user can view team task only with explicit permission")
    void canUserViewTask_user_requiresPermission() {
        Team team = new Team();
        team.setId(UUID.randomUUID());

        User plainUser = new User();
        plainUser.setId(userId);
        plainUser.setRole(UserRole.USER);
        plainUser.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setTeam(team);

        when(userRepository.findById(userId)).thenReturn(Optional.of(plainUser));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, userId)).thenReturn(Optional.empty());
        assertFalse(taskService.canUserViewTask(taskId, userId));

        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, userId))
                .thenReturn(Optional.of(new com.thesis.smart_resource_planner.model.entity.TaskPermission()));
        assertTrue(taskService.canUserViewTask(taskId, userId));
    }

    @Test
    @DisplayName("getTasksByStatus maps repository entities to DTOs")
    void getTasksByStatus_mapsResults() {
        Task task = new Task();
        task.setId(taskId);
        task.setStatus(TaskStatus.PENDING);
        when(taskRepository.findByStatus(TaskStatus.PENDING)).thenReturn(List.of(task));
        when(modelMapper.map(task, TaskDTO.class)).thenReturn(new TaskDTO());

        var result = taskService.getTasksByStatus(TaskStatus.PENDING);
        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("getTasksByPriority maps repository entities to DTOs")
    void getTasksByPriority_mapsResults() {
        Task task = new Task();
        task.setId(taskId);
        task.setPriority(TaskPriority.HIGH);
        when(taskRepository.findByPriority(TaskPriority.HIGH)).thenReturn(List.of(task));
        when(modelMapper.map(task, TaskDTO.class)).thenReturn(new TaskDTO());

        var result = taskService.getTasksByPriority(TaskPriority.HIGH);
        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("getOverdueTasks maps repository entities to DTOs")
    void getOverdueTasks_mapsResults() {
        Task overdue = new Task();
        overdue.setId(taskId);
        when(taskRepository.findOverdueTasks(eq(TaskStatus.PENDING), any(LocalDateTime.class)))
                .thenReturn(List.of(overdue));
        when(modelMapper.map(overdue, TaskDTO.class)).thenReturn(new TaskDTO());

        var result = taskService.getOverdueTasks();
        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("getTasksByTeam maps repository entities to DTOs")
    void getTasksByTeam_mapsResults() {
        UUID teamId = UUID.randomUUID();
        Task task = new Task();
        task.setId(taskId);
        when(taskRepository.findByTeamId(teamId)).thenReturn(List.of(task));
        when(modelMapper.map(task, TaskDTO.class)).thenReturn(new TaskDTO());

        var result = taskService.getTasksByTeam(teamId);
        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("updateTask applies multiple field changes and saves")
    void updateTask_appliesFieldChanges() {
        User updater = new User();
        updater.setId(userId);
        updater.setRole(UserRole.ADMIN);
        updater.setCompany(company);

        Task existing = new Task();
        existing.setId(taskId);
        existing.setTitle("Old");
        existing.setDescription("Old desc");
        existing.setStatus(TaskStatus.PENDING);
        existing.setPriority(TaskPriority.LOW);
        existing.setEstimatedHours(BigDecimal.valueOf(2.0));
        existing.setActualHours(BigDecimal.valueOf(1.0));
        existing.setStartDate(LocalDateTime.now().minusDays(2));
        existing.setDueDate(LocalDateTime.now().plusDays(1));
        existing.setComplexityScore(BigDecimal.valueOf(0.2));
        existing.setCompany(company);

        TaskUpdateDTO updateDTO = new TaskUpdateDTO();
        updateDTO.setTitle("New");
        updateDTO.setDescription("New desc");
        updateDTO.setStatus(TaskStatus.COMPLETED);
        updateDTO.setPriority(TaskPriority.HIGH);
        updateDTO.setEstimatedHours(BigDecimal.valueOf(5.0));
        updateDTO.setActualHours(BigDecimal.valueOf(4.0));
        updateDTO.setStartDate(LocalDateTime.now().minusDays(1));
        updateDTO.setDueDate(LocalDateTime.now().plusDays(3));
        updateDTO.setComplexityScore(BigDecimal.valueOf(0.8));

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(existing));
        when(userRepository.findById(userId)).thenReturn(Optional.of(updater));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(modelMapper.map(any(Task.class), eq(TaskDTO.class))).thenReturn(new TaskDTO());

        var result = taskService.updateTask(taskId, updateDTO, userId);
        assertNotNull(result);
        assertEquals("New", existing.getTitle());
        assertEquals(TaskStatus.COMPLETED, existing.getStatus());
        assertNotNull(existing.getCompletedDate());
        verify(auditLogService, atLeastOnce()).logFieldChange(any(Task.class), eq(updater), anyString(), anyString(), anyString());
        verify(taskRepository).save(existing);
    }
}
