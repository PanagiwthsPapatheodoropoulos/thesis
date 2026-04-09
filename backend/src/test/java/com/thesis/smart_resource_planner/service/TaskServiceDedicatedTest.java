package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.enums.TaskAssignmentStatus;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskAssignment;
import com.thesis.smart_resource_planner.model.entity.TaskPermission;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.TaskRepository;
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

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceDedicatedTest {

    @Mock private TaskRepository taskRepository;
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

    private UUID taskId;
    private UUID userId;
    private Company company;

    @BeforeEach
    void init() {
        taskId = UUID.randomUUID();
        userId = UUID.randomUUID();
        company = new Company();
        company.setId(UUID.randomUUID());
    }

    @Test
    @DisplayName("canUserEditTask allows creator branch")
    void canUserEditTask_creator_true() {
        User creator = new User();
        creator.setId(userId);
        creator.setRole(UserRole.USER);
        creator.setCompany(company);

        User createdBy = new User();
        createdBy.setId(userId);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setCreatedBy(createdBy);

        when(userRepository.findById(userId)).thenReturn(Optional.of(creator));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));

        assertTrue(taskService.canUserEditTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserDeleteTask uses explicit permission for USER role")
    void canUserDeleteTask_permissionBranch_falseThenTrue() {
        User plainUser = new User();
        plainUser.setId(userId);
        plainUser.setRole(UserRole.USER);
        plainUser.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setAssignments(new ArrayList<>());

        when(userRepository.findById(userId)).thenReturn(Optional.of(plainUser));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));

        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, userId)).thenReturn(Optional.empty());
        assertFalse(taskService.canUserDeleteTask(taskId, userId));

        TaskPermission permission = new TaskPermission();
        permission.setCanDelete(true);
        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, userId)).thenReturn(Optional.of(permission));
        assertTrue(taskService.canUserDeleteTask(taskId, userId));
    }

    @Test
    @DisplayName("getTaskById throws when task is absent")
    void getTaskById_notFound() {
        when(taskRepository.findById(taskId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> taskService.getTaskById(taskId));
    }

    @Test
    @DisplayName("canUserCompleteTask allows employee on public unassigned task")
    void canUserCompleteTask_employeePublicTask_true() {
        User employeeUser = new User();
        employeeUser.setId(userId);
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);
        employeeUser.setTeam(null);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setTeam(null);
        task.setAssignedEmployeeId(null);
        task.setAssignments(List.of());

        when(userRepository.findById(userId)).thenReturn(Optional.of(employeeUser));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));

        assertTrue(taskService.canUserCompleteTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserCompleteTask allows employee with accepted assignment")
    void canUserCompleteTask_employeeAcceptedAssignment_true() {
        User employeeUser = new User();
        employeeUser.setId(userId);
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);

        Employee employee = new Employee();
        UUID employeeId = UUID.randomUUID();
        employee.setId(employeeId);
        employee.setUser(employeeUser);

        TaskAssignment assignment = new TaskAssignment();
        assignment.setEmployee(employee);
        assignment.setStatus(TaskAssignmentStatus.ACCEPTED);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setAssignedEmployeeId(UUID.randomUUID());
        task.setAssignments(List.of(assignment));

        when(userRepository.findById(userId)).thenReturn(Optional.of(employeeUser));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.of(employee));

        assertTrue(taskService.canUserCompleteTask(taskId, userId));
    }
}

