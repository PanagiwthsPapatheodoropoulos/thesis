package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.enums.TaskAssignmentStatus;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskAssignment;
import com.thesis.smart_resource_planner.model.entity.TaskPermission;
import com.thesis.smart_resource_planner.model.entity.Team;
import com.thesis.smart_resource_planner.model.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskServicePermissionsDedicatedTest {

    @Mock private com.thesis.smart_resource_planner.repository.TaskRepository taskRepository;
    @Mock private com.thesis.smart_resource_planner.repository.TeamRepository teamRepository;
    @Mock private com.thesis.smart_resource_planner.repository.UserRepository userRepository;
    @Mock private com.thesis.smart_resource_planner.repository.TaskAssignmentRepository taskAssignmentRepository;
    @Mock private com.thesis.smart_resource_planner.repository.TaskPermissionRepository taskPermissionRepository;
    @Mock private NotificationService notificationService;
    @Mock private com.thesis.smart_resource_planner.repository.EmployeeRepository employeeRepository;
    @Mock private ModelMapper modelMapper;
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private WebSocketBroadcastService broadcastService;
    @Mock private TaskAuditLogService auditLogService;
    @Mock private com.thesis.smart_resource_planner.repository.NotificationRepository notificationRepository;
    @Mock private com.thesis.smart_resource_planner.repository.TaskRequiredSkillRepository taskRequiredSkillRepository;
    @Mock private com.thesis.smart_resource_planner.repository.SkillRepository skillRepository;
    @Mock private RestTemplate restTemplate;

    @InjectMocks private TaskService taskService;

    private UUID userId;
    private UUID taskId;
    private Company company;
    private Team teamA;
    private Team teamB;

    @BeforeEach
    void setup() {
        userId = UUID.randomUUID();
        taskId = UUID.randomUUID();
        company = new Company(); company.setId(UUID.randomUUID());
        teamA = new Team(); teamA.setId(UUID.randomUUID());
        teamB = new Team(); teamB.setId(UUID.randomUUID());
    }

    @Test
    @DisplayName("canUserViewTask manager from different team is denied")
    void canUserViewTask_managerDifferentTeam_false() {
        User manager = new User();
        manager.setId(userId);
        manager.setRole(UserRole.MANAGER);
        manager.setCompany(company);
        manager.setTeam(teamA);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setTeam(teamB);

        when(userRepository.findById(userId)).thenReturn(Optional.of(manager));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));

        assertFalse(taskService.canUserViewTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserViewTask falls back to explicit permission presence")
    void canUserViewTask_permissionPresent_true() {
        User plain = new User();
        plain.setId(userId);
        plain.setRole(UserRole.USER);
        plain.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setTeam(teamB);

        when(userRepository.findById(userId)).thenReturn(Optional.of(plain));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, userId)).thenReturn(Optional.of(new TaskPermission()));

        assertTrue(taskService.canUserViewTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserDeleteTask allows admin in same company")
    void canUserDeleteTask_adminSameCompany_true() {
        User admin = new User();
        admin.setId(userId);
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);

        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));

        assertTrue(taskService.canUserDeleteTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserDeleteTask denies admin cross-company task")
    void canUserDeleteTask_adminCrossCompany_false() {
        User admin = new User();
        admin.setId(userId);
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);

        Company other = new Company();
        other.setId(UUID.randomUUID());
        Task task = new Task();
        task.setId(taskId);
        task.setCompany(other);

        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));

        assertFalse(taskService.canUserDeleteTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserCompleteTask returns true for manager")
    void canUserCompleteTask_manager_true() {
        User manager = new User();
        manager.setId(userId);
        manager.setRole(UserRole.MANAGER);
        manager.setCompany(company);

        when(userRepository.findById(userId)).thenReturn(Optional.of(manager));
        assertTrue(taskService.canUserCompleteTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserCompleteTask allows employee who created approved task")
    void canUserCompleteTask_employeeApprovedCreator_true() {
        User employeeUser = new User();
        employeeUser.setId(userId);
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);

        User creator = new User();
        creator.setId(userId);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setCreatedBy(creator);
        task.setTitle("Approved task");
        task.setAssignments(List.of());

        when(userRepository.findById(userId)).thenReturn(Optional.of(employeeUser));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));

        assertTrue(taskService.canUserCompleteTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserCompleteTask allows employee from same team")
    void canUserCompleteTask_employeeSameTeam_true() {
        User employeeUser = new User();
        employeeUser.setId(userId);
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);
        employeeUser.setTeam(teamA);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setTeam(teamA);
        task.setAssignments(List.of());

        when(userRepository.findById(userId)).thenReturn(Optional.of(employeeUser));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));

        assertTrue(taskService.canUserCompleteTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserCompleteTask allows employee direct assignment")
    void canUserCompleteTask_employeeDirectAssignment_true() {
        User employeeUser = new User();
        employeeUser.setId(userId);
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);

        Employee employee = new Employee();
        UUID employeeId = UUID.randomUUID();
        employee.setId(employeeId);
        employee.setUser(employeeUser);

        TaskAssignment pendingAssignment = new TaskAssignment();
        pendingAssignment.setEmployee(employee);
        pendingAssignment.setStatus(TaskAssignmentStatus.PENDING);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setAssignments(List.of(pendingAssignment));
        task.setAssignedEmployeeId(employeeId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(employeeUser));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.of(employee));

        assertTrue(taskService.canUserCompleteTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserCompleteTask denies employee without any matching access")
    void canUserCompleteTask_employeeNoAccess_false() {
        User employeeUser = new User();
        employeeUser.setId(userId);
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);
        employeeUser.setTeam(null);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setTitle("[REQUEST] someone else");
        task.setTeam(teamB);
        task.setAssignments(List.of());
        task.setAssignedEmployeeId(null);

        when(userRepository.findById(userId)).thenReturn(Optional.of(employeeUser));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.empty());

        assertFalse(taskService.canUserCompleteTask(taskId, userId));
    }
}

