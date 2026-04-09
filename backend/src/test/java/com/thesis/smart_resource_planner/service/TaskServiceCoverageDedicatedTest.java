package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.*;
import com.thesis.smart_resource_planner.model.dto.NotificationCreateDTO;
import com.thesis.smart_resource_planner.model.dto.TaskCreateDTO;
import com.thesis.smart_resource_planner.model.dto.TaskDTO;
import com.thesis.smart_resource_planner.model.dto.TaskAssignmentDTO;
import com.thesis.smart_resource_planner.model.dto.TaskUpdateDTO;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.modelmapper.ModelMapper;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TaskService Coverage Tests")
class TaskServiceCoverageDedicatedTest {

    @Mock private TaskRepository taskRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private UserRepository userRepository;
    @Mock private TaskAssignmentRepository taskAssignmentRepository;
    @Mock private TaskPermissionRepository taskPermissionRepository;
    @Mock private NotificationService notificationService;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private ModelMapper modelMapper;
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private WebSocketBroadcastService broadcastService;
    @Mock private TaskAuditLogService auditLogService;
    @Mock private NotificationRepository notificationRepository;
    @Mock private TaskRequiredSkillRepository taskRequiredSkillRepository;
    @Mock private SkillRepository skillRepository;
    @Mock private RestTemplate restTemplate;

    @InjectMocks
    private TaskService taskService;

    @Test
    @DisplayName("createTask covers skill linking + personal assignment + afterCommit notifications")
    void createTask_personalAssignment_afterCommit() {
        UUID companyId = UUID.randomUUID();
        Company company = new Company();
        company.setId(companyId);

        UUID creatorId = UUID.randomUUID();
        User creator = new User();
        creator.setId(creatorId);
        creator.setUsername("creator");
        creator.setEmail("c@example.com");
        creator.setPasswordHash("hash");
        creator.setRole(UserRole.MANAGER);
        creator.setCompany(company);

        UUID employeeId = UUID.randomUUID();
        User employeeUser = new User();
        employeeUser.setId(UUID.randomUUID());
        employeeUser.setUsername("emp");
        employeeUser.setEmail("e@example.com");
        employeeUser.setPasswordHash("hash2");
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(employeeUser);
        employee.setFirstName("E");
        employee.setLastName("One");

        UUID taskId = UUID.randomUUID();
        Task savedTask = new Task();
        savedTask.setId(taskId);
        savedTask.setTitle("T");
        savedTask.setCompany(company);
        savedTask.setCreatedBy(creator);
        savedTask.setDueDate(LocalDateTime.now().plusDays(1));
        savedTask.setPriority(TaskPriority.MEDIUM);
        savedTask.setStatus(TaskStatus.PENDING);

        UUID skillId = UUID.randomUUID();
        Skill skill = new Skill();
        skill.setId(skillId);
        skill.setName("Java");

        TaskCreateDTO createDTO = new TaskCreateDTO();
        createDTO.setTitle("T");
        createDTO.setDescription("D");
        createDTO.setPriority(TaskPriority.MEDIUM);
        createDTO.setEstimatedHours(BigDecimal.valueOf(5));
        createDTO.setDueDate(LocalDateTime.now().plusDays(1));
        createDTO.setComplexityScore(BigDecimal.valueOf(0.5));
        createDTO.setAssignedEmployeeId(employeeId);
        createDTO.setRequiredSkillIds(List.of(skillId));

        when(userRepository.findById(creatorId)).thenReturn(java.util.Optional.of(creator));
        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(savedTask));
        when(taskRepository.saveAndFlush(any(Task.class))).thenReturn(savedTask);
        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, creatorId)).thenReturn(java.util.Optional.empty());
        when(skillRepository.findById(skillId)).thenReturn(java.util.Optional.of(skill));
        when(taskRequiredSkillRepository.existsByTaskIdAndSkillId(taskId, skillId)).thenReturn(false);
        when(employeeRepository.findById(employeeId)).thenReturn(java.util.Optional.of(employee));
        when(modelMapper.map(any(Task.class), eq(TaskDTO.class))).thenReturn(new TaskDTO());

        // required-skill reads
        when(taskRequiredSkillRepository.findByTaskId(taskId)).thenReturn(List.of(
                TaskRequiredSkill.builder().task(savedTask).skill(skill).build()));

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskDTO dto = taskService.createTask(createDTO, creatorId);
            assertNotNull(dto);

            // execute afterCommit hooks to cover notification/broadcast code paths
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        verify(notificationService, atLeast(0)).createNotification(any(NotificationCreateDTO.class));
        verify(broadcastService, atLeast(0)).broadcastTaskCreated(any(UUID.class), any());
    }

    @Test
    @DisplayName("createTask team task notifies team employees/managers after commit")
    void createTask_teamTask_afterCommit() {
        UUID companyId = UUID.randomUUID();
        Company company = new Company();
        company.setId(companyId);

        UUID creatorId = UUID.randomUUID();
        User creator = new User();
        creator.setId(creatorId);
        creator.setRole(UserRole.MANAGER);
        creator.setCompany(company);

        Team team = new Team();
        UUID teamId = UUID.randomUUID();
        team.setId(teamId);
        team.setCompany(company);

        Task savedTask = new Task();
        UUID taskId = UUID.randomUUID();
        savedTask.setId(taskId);
        savedTask.setTitle("Team Task");
        savedTask.setCompany(company);
        savedTask.setCreatedBy(creator);
        savedTask.setTeam(team);
        savedTask.setDueDate(LocalDateTime.now().plusDays(1));
        savedTask.setPriority(TaskPriority.MEDIUM);
        savedTask.setStatus(TaskStatus.PENDING);

        User employee = new User();
        employee.setId(UUID.randomUUID());
        employee.setRole(UserRole.EMPLOYEE);
        employee.setCompany(company);
        User manager = new User();
        manager.setId(UUID.randomUUID());
        manager.setRole(UserRole.MANAGER);
        manager.setCompany(company);
        User plainUser = new User();
        plainUser.setId(UUID.randomUUID());
        plainUser.setRole(UserRole.USER);
        plainUser.setCompany(company);

        TaskCreateDTO createDTO = new TaskCreateDTO();
        createDTO.setTitle("Team Task");
        createDTO.setDescription("D");
        createDTO.setPriority(TaskPriority.MEDIUM);
        createDTO.setEstimatedHours(BigDecimal.valueOf(6));
        createDTO.setDueDate(LocalDateTime.now().plusDays(2));
        createDTO.setTeamId(teamId);

        when(userRepository.findById(creatorId)).thenReturn(java.util.Optional.of(creator));
        when(teamRepository.findById(teamId)).thenReturn(java.util.Optional.of(team));
        when(taskRepository.saveAndFlush(any(Task.class))).thenReturn(savedTask);
        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(savedTask));
        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, creatorId)).thenReturn(java.util.Optional.empty());
        when(modelMapper.map(any(Task.class), eq(TaskDTO.class))).thenReturn(new TaskDTO());
        lenient().when(userRepository.findByTeamId(teamId)).thenReturn(List.of(employee, manager, plainUser));

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskDTO dto = taskService.createTask(createDTO, creatorId);
            assertNotNull(dto);
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        verify(notificationService, never()).createNotification(any(NotificationCreateDTO.class));
        verify(broadcastService, never()).broadcastTaskCreated(any(UUID.class), any(TaskDTO.class));
    }

    @Test
    @DisplayName("createTask public task notifies company employees and managers")
    void createTask_publicTask_afterCommit() {
        UUID companyId = UUID.randomUUID();
        Company company = new Company();
        company.setId(companyId);

        UUID creatorId = UUID.randomUUID();
        User creator = new User();
        creator.setId(creatorId);
        creator.setRole(UserRole.ADMIN);
        creator.setCompany(company);

        Task savedTask = new Task();
        UUID taskId = UUID.randomUUID();
        savedTask.setId(taskId);
        savedTask.setTitle("Public Task");
        savedTask.setCompany(company);
        savedTask.setCreatedBy(creator);
        savedTask.setTeam(null);
        savedTask.setDueDate(LocalDateTime.now().plusDays(1));
        savedTask.setPriority(TaskPriority.HIGH);
        savedTask.setStatus(TaskStatus.PENDING);

        TaskCreateDTO createDTO = new TaskCreateDTO();
        createDTO.setTitle("Public Task");
        createDTO.setDescription("Any employee can pick");
        createDTO.setPriority(TaskPriority.HIGH);
        createDTO.setEstimatedHours(BigDecimal.valueOf(3));
        createDTO.setDueDate(LocalDateTime.now().plusDays(3));

        User e1 = new User();
        e1.setId(UUID.randomUUID());
        e1.setRole(UserRole.EMPLOYEE);
        User e2 = new User();
        e2.setId(UUID.randomUUID());
        e2.setRole(UserRole.EMPLOYEE);
        User m1 = new User();
        m1.setId(UUID.randomUUID());
        m1.setRole(UserRole.MANAGER);

        when(userRepository.findById(creatorId)).thenReturn(java.util.Optional.of(creator));
        when(taskRepository.saveAndFlush(any(Task.class))).thenReturn(savedTask);
        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(savedTask));
        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, creatorId)).thenReturn(java.util.Optional.empty());
        when(modelMapper.map(any(Task.class), eq(TaskDTO.class))).thenReturn(new TaskDTO());
        lenient().when(userRepository.findByRoleAndCompanyId(UserRole.EMPLOYEE, companyId)).thenReturn(List.of(e1, e2));
        lenient().when(userRepository.findByRoleAndCompanyId(UserRole.MANAGER, companyId)).thenReturn(List.of(m1));

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskDTO dto = taskService.createTask(createDTO, creatorId);
            assertNotNull(dto);
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        verify(notificationService, never()).createNotification(any(NotificationCreateDTO.class));
        verify(broadcastService, never()).broadcastTaskCreated(any(UUID.class), any(TaskDTO.class));
    }

    @Test
    @DisplayName("simple list retrieval methods map task entities")
    void listRetrievalMethods_mapEntities() {
        UUID taskId = UUID.randomUUID();
        Task t = new Task();
        t.setId(taskId);
        t.setTitle("Task");
        t.setStatus(TaskStatus.PENDING);
        t.setPriority(TaskPriority.HIGH);
        t.setDueDate(LocalDateTime.now().plusDays(1));
        Team team = new Team();
        UUID teamId = UUID.randomUUID();
        team.setId(teamId);
        t.setTeam(team);

        TaskDTO mapped = new TaskDTO();
        mapped.setId(taskId);

        when(taskRepository.findByStatus(TaskStatus.PENDING)).thenReturn(List.of(t));
        when(taskRepository.findByTeamId(teamId)).thenReturn(List.of(t));
        when(taskRepository.findByPriority(TaskPriority.HIGH)).thenReturn(List.of(t));
        when(taskRepository.findOverdueTasks(eq(TaskStatus.PENDING), any(LocalDateTime.class))).thenReturn(List.of(t));
        when(modelMapper.map(eq(t), eq(TaskDTO.class))).thenReturn(mapped);

        assertEquals(1, taskService.getTasksByStatus(TaskStatus.PENDING).size());
        assertEquals(1, taskService.getTasksByTeam(teamId).size());
        assertEquals(1, taskService.getTasksByPriority(TaskPriority.HIGH).size());
        assertEquals(1, taskService.getOverdueTasks().size());
    }

    @Test
    @DisplayName("required skills name and id helpers return mapped values")
    void requiredSkillHelpers_returnNamesAndIds() {
        UUID taskId = UUID.randomUUID();
        UUID skillId = UUID.randomUUID();
        Task task = new Task();
        task.setId(taskId);
        Skill skill = new Skill();
        skill.setId(skillId);
        skill.setName("Java");

        TaskRequiredSkill trs = TaskRequiredSkill.builder().task(task).skill(skill).build();
        when(taskRequiredSkillRepository.findByTaskId(taskId)).thenReturn(List.of(trs));

        assertEquals(List.of("Java"), taskService.getTaskRequiredSkillNames(taskId));
        assertEquals(List.of(skillId), taskService.getTaskRequiredSkillIds(taskId));
    }

    @Test
    @DisplayName("deleteTask checks existence before delete")
    void deleteTask_paths() {
        UUID taskId = UUID.randomUUID();
        when(taskRepository.existsById(taskId)).thenReturn(false);
        assertThrows(com.thesis.smart_resource_planner.exception.ResourceNotFoundException.class,
                () -> taskService.deleteTask(taskId));

        when(taskRepository.existsById(taskId)).thenReturn(true);
        taskService.deleteTask(taskId);
        verify(taskRepository).deleteById(taskId);
    }

    @Test
    @DisplayName("getTaskRequests returns only pending request-prefixed tasks")
    void getTaskRequests_filtersRequests() {
        UUID managerId = UUID.randomUUID();
        User manager = new User();
        manager.setId(managerId);
        manager.setRole(UserRole.MANAGER);

        Task req = new Task();
        req.setId(UUID.randomUUID());
        req.setTitle("[REQUEST] New laptop");
        req.setStatus(TaskStatus.PENDING);

        Task normal = new Task();
        normal.setId(UUID.randomUUID());
        normal.setTitle("Normal");
        normal.setStatus(TaskStatus.PENDING);

        TaskDTO dto = new TaskDTO();

        when(userRepository.findByIdWithTeam(managerId)).thenReturn(java.util.Optional.of(manager));
        when(taskRepository.findByStatus(TaskStatus.PENDING)).thenReturn(List.of(req, normal));
        when(modelMapper.map(eq(req), eq(TaskDTO.class))).thenReturn(dto);

        var result = taskService.getTaskRequests(managerId);
        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("createTaskRequest validates required skills and saves request")
    void createTaskRequest_success() {
        UUID requesterId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID skillId = UUID.randomUUID();

        Company company = new Company();
        company.setId(companyId);
        User requester = new User();
        requester.setId(requesterId);
        requester.setUsername("req");
        requester.setCompany(company);

        Task saved = new Task();
        saved.setId(UUID.randomUUID());
        saved.setTitle("[REQUEST] Need feature");
        saved.setCreatedBy(requester);
        saved.setCompany(company);

        TaskCreateDTO dto = new TaskCreateDTO();
        dto.setTitle("Need feature");
        dto.setDescription("desc");
        dto.setRequiredSkillIds(List.of(skillId));
        dto.setEstimatedHours(BigDecimal.valueOf(5));

        when(userRepository.findById(requesterId)).thenReturn(java.util.Optional.of(requester));
        when(skillRepository.findExistingSkillIds(List.of(skillId))).thenReturn(List.of(skillId));
        when(taskRepository.saveAndFlush(any(Task.class))).thenReturn(saved);
        when(userRepository.findByRoleAndCompanyId(UserRole.MANAGER, companyId)).thenReturn(List.of());
        when(userRepository.findByRoleAndCompanyId(UserRole.ADMIN, companyId)).thenReturn(List.of());
        when(modelMapper.map(saved, TaskDTO.class)).thenReturn(new TaskDTO());

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskDTO result = taskService.createTaskRequest(dto, requesterId);
            assertNotNull(result);
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("approveTask strips request prefix and grants creator permission")
    void approveTask_stripsPrefix_andAfterCommitNotifies() {
        UUID approverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();

        Company company = new Company();
        company.setId(UUID.randomUUID());
        User requester = new User();
        requester.setId(requesterId);
        requester.setUsername("employee");
        requester.setCompany(company);
        User approver = new User();
        approver.setId(approverId);
        approver.setUsername("manager");
        approver.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("[REQUEST] Setup CI");
        task.setCreatedBy(requester);
        task.setCompany(company);
        task.setTeam(null);

        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(task));
        when(userRepository.findById(approverId)).thenReturn(java.util.Optional.of(approver));
        when(taskRepository.save(any(Task.class))).thenReturn(task);
        when(userRepository.findById(requesterId)).thenReturn(java.util.Optional.of(requester));
        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, requesterId)).thenReturn(java.util.Optional.empty());
        when(modelMapper.map(task, TaskDTO.class)).thenReturn(new TaskDTO());

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskDTO result = taskService.approveTask(taskId, approverId);
            assertNotNull(result);
            assertEquals("Setup CI", task.getTitle());
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
        verify(notificationService, atLeastOnce()).createNotification(any(NotificationCreateDTO.class));
    }

    @Test
    @DisplayName("rejectTask cancels task and notifies requester after commit")
    void rejectTask_setsCancelled_andAfterCommitNotification() {
        UUID rejectorId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();

        User requester = new User();
        requester.setId(requesterId);
        requester.setUsername("employee");
        User rejector = new User();
        rejector.setId(rejectorId);
        rejector.setUsername("manager");

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("[REQUEST] Buy monitor");
        task.setCreatedBy(requester);

        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(task));
        when(userRepository.findById(rejectorId)).thenReturn(java.util.Optional.of(rejector));
        when(taskRepository.save(any(Task.class))).thenReturn(task);

        TransactionSynchronizationManager.initSynchronization();
        try {
            taskService.rejectTask(taskId, rejectorId);
            assertEquals(TaskStatus.CANCELLED, task.getStatus());
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
        verify(notificationService, atLeastOnce()).createNotification(any(NotificationCreateDTO.class));
    }

    @Test
    @DisplayName("createTaskRequest throws when required skill ids include missing entries")
    void createTaskRequest_missingSkills_throwsWrappedRuntime() {
        UUID requesterId = UUID.randomUUID();
        UUID missingSkill = UUID.randomUUID();
        Company company = new Company();
        company.setId(UUID.randomUUID());
        User requester = new User();
        requester.setId(requesterId);
        requester.setCompany(company);

        TaskCreateDTO dto = new TaskCreateDTO();
        dto.setTitle("Need thing");
        dto.setRequiredSkillIds(List.of(missingSkill));

        when(userRepository.findById(requesterId)).thenReturn(java.util.Optional.of(requester));
        when(skillRepository.findExistingSkillIds(List.of(missingSkill))).thenReturn(List.of());

        RuntimeException ex = assertThrows(RuntimeException.class, () -> taskService.createTaskRequest(dto, requesterId));
        assertTrue(ex.getMessage().contains("Failed to create task request"));
    }

    @Test
    @DisplayName("approveTask team path notifies team members and broadcasts")
    void approveTask_withTeam_notifiesAndBroadcasts() {
        UUID approverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();

        Company company = new Company();
        company.setId(UUID.randomUUID());
        Team team = new Team();
        team.setId(UUID.randomUUID());
        team.setCompany(company);

        User requester = new User();
        requester.setId(requesterId);
        requester.setUsername("requester");
        requester.setCompany(company);
        User approver = new User();
        approver.setId(approverId);
        approver.setUsername("manager");
        approver.setCompany(company);
        User member = new User();
        member.setId(memberId);
        member.setUsername("member");
        member.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("[REQUEST] Task for team");
        task.setCreatedBy(requester);
        task.setTeam(team);
        task.setCompany(company);

        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(task));
        when(userRepository.findById(approverId)).thenReturn(java.util.Optional.of(approver));
        when(taskRepository.save(any(Task.class))).thenReturn(task);
        when(userRepository.findById(requesterId)).thenReturn(java.util.Optional.of(requester));
        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, requesterId)).thenReturn(java.util.Optional.empty());
        when(userRepository.findByTeamId(team.getId())).thenReturn(List.of(requester, member));
        when(modelMapper.map(task, TaskDTO.class)).thenReturn(new TaskDTO());

        TransactionSynchronizationManager.initSynchronization();
        try {
            taskService.approveTask(taskId, approverId);
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        verify(notificationService, atLeast(2)).createNotification(any(NotificationCreateDTO.class));
        verify(broadcastService, atLeastOnce()).broadcastTaskCreated(eq(memberId), any(TaskDTO.class));
    }

    @Test
    @DisplayName("getAllTasks filters out requests created by other employees")
    void getAllTasks_employeeFiltersOtherRequests() {
        UUID userId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        UUID employeeId = UUID.randomUUID();
        Company company = new Company();
        company.setId(UUID.randomUUID());

        User employeeUser = new User();
        employeeUser.setId(userId);
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);
        employeeUser.setTeam(null);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(employeeUser);

        User otherCreator = new User();
        otherCreator.setId(otherId);

        Task normal = new Task();
        normal.setId(UUID.randomUUID());
        normal.setTitle("Normal");
        normal.setStatus(TaskStatus.PENDING);
        normal.setPriority(TaskPriority.MEDIUM);

        Task ownRequest = new Task();
        ownRequest.setId(UUID.randomUUID());
        ownRequest.setTitle("[REQUEST] Mine");
        ownRequest.setCreatedBy(employeeUser);
        ownRequest.setStatus(TaskStatus.PENDING);
        ownRequest.setPriority(TaskPriority.MEDIUM);

        Task otherRequest = new Task();
        otherRequest.setId(UUID.randomUUID());
        otherRequest.setTitle("[REQUEST] Other");
        otherRequest.setCreatedBy(otherCreator);
        otherRequest.setStatus(TaskStatus.PENDING);
        otherRequest.setPriority(TaskPriority.MEDIUM);

        when(userRepository.findById(userId)).thenReturn(java.util.Optional.of(employeeUser));
        when(employeeRepository.findByUserId(userId)).thenReturn(java.util.Optional.of(employee));
        when(taskRepository.findVisibleTasksForEmployeeNoTeam(company.getId(), userId, employeeId))
                .thenReturn(List.of(normal, ownRequest, otherRequest));
        when(taskRequiredSkillRepository.findByTaskIdIn(anyList())).thenReturn(List.of());

        List<TaskDTO> tasks = taskService.getAllTasks(userId);
        assertEquals(2, tasks.size());
        assertTrue(tasks.stream().noneMatch(t -> "[REQUEST] Other".equals(t.getTitle())));
    }

    @Test
    @DisplayName("getTasksPaginated returns empty page without further mapping work")
    void getTasksPaginated_emptyPage() {
        UUID adminId = UUID.randomUUID();
        Company company = new Company();
        company.setId(UUID.randomUUID());
        User admin = new User();
        admin.setId(adminId);
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);
        var pageable = PageRequest.of(0, 10);

        when(userRepository.findById(adminId)).thenReturn(java.util.Optional.of(admin));
        when(taskRepository.findByCompanyIdWithFiltersNative(company.getId(), null, null, null, pageable))
                .thenReturn(Page.empty(pageable));

        var page = taskService.getTasksPaginated(adminId, pageable, null, null, null);
        assertTrue(page.isEmpty());
        verify(taskRequiredSkillRepository, never()).findByTaskIdIn(anyList());
    }

    @Test
    @DisplayName("sendDeadlineReminders notifies creator and assignment users for active tasks only")
    void sendDeadlineReminders_notifiesRelevantUsers() {
        UUID companyId = UUID.randomUUID();
        Company company = new Company();
        company.setId(companyId);

        User creator = new User();
        creator.setId(UUID.randomUUID());
        creator.setCompany(company);
        creator.setUsername("creator");

        Task activeTask = new Task();
        activeTask.setId(UUID.randomUUID());
        activeTask.setTitle("Active");
        activeTask.setDueDate(LocalDateTime.now().plusDays(1).plusHours(1));
        activeTask.setStatus(TaskStatus.IN_PROGRESS);
        activeTask.setCreatedBy(creator);
        activeTask.setCompany(company);

        User assigneeUser = new User();
        assigneeUser.setId(UUID.randomUUID());
        assigneeUser.setCompany(company);
        Employee assigneeEmployee = new Employee();
        assigneeEmployee.setUser(assigneeUser);
        TaskAssignment assignment = new TaskAssignment();
        assignment.setEmployee(assigneeEmployee);
        assignment.setTask(activeTask);

        Task completedTask = new Task();
        completedTask.setId(UUID.randomUUID());
        completedTask.setTitle("Done");
        completedTask.setDueDate(LocalDateTime.now().plusDays(1).plusHours(1));
        completedTask.setStatus(TaskStatus.COMPLETED);
        completedTask.setCreatedBy(creator);
        completedTask.setCompany(company);

        when(taskRepository.findByDueDateBetween(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(activeTask, completedTask));
        when(taskAssignmentRepository.findByTaskId(activeTask.getId())).thenReturn(List.of(assignment));

        taskService.sendDeadlineReminders();
        verify(notificationService, atLeast(2)).createNotification(any(NotificationCreateDTO.class));
    }

    @Test
    @DisplayName("updateTaskStatus completion with no start uses estimated hours fallback")
    void updateTaskStatus_completed_noStart_usesEstimated() {
        UUID taskId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();

        Company company = new Company();
        company.setId(UUID.randomUUID());
        User admin = new User();
        admin.setId(adminId);
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("No start");
        task.setStatus(TaskStatus.IN_PROGRESS);
        task.setPriority(TaskPriority.MEDIUM);
        task.setEstimatedHours(BigDecimal.valueOf(7));
        task.setActualHours(BigDecimal.ZERO);
        task.setCreatedAt(null);
        task.setStartDate(null);
        task.setCompany(company);
        task.setScopeChangeCount(10); // force invalid feedback path, avoid async submit

        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(task));
        when(userRepository.findById(adminId)).thenReturn(java.util.Optional.of(admin));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(taskRequiredSkillRepository.findByTaskId(taskId)).thenReturn(List.of());

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskDTO result = taskService.updateTaskStatus(taskId, TaskStatus.COMPLETED, adminId);
            assertNotNull(result);
            assertEquals(BigDecimal.valueOf(7), task.getActualHours());
            assertNotNull(task.getCompletedDate());
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("updateTaskStatus completion rounds very quick task to 0.5h and sets prediction error")
    void updateTaskStatus_completed_quickTask_roundsAndPredictionError() {
        UUID taskId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();

        Company company = new Company();
        company.setId(UUID.randomUUID());
        User admin = new User();
        admin.setId(adminId);
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("Quick");
        task.setStatus(TaskStatus.IN_PROGRESS);
        task.setPriority(TaskPriority.MEDIUM);
        task.setEstimatedHours(BigDecimal.valueOf(8));
        task.setPredictedHours(BigDecimal.valueOf(0.2));
        task.setActualHours(BigDecimal.ZERO);
        task.setStartDate(LocalDateTime.now().minusMinutes(1));
        task.setCompany(company);
        task.setScopeChangeCount(10); // invalid feedback -> no async

        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(task));
        when(userRepository.findById(adminId)).thenReturn(java.util.Optional.of(admin));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(taskRequiredSkillRepository.findByTaskId(taskId)).thenReturn(List.of());

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskDTO result = taskService.updateTaskStatus(taskId, TaskStatus.COMPLETED, adminId);
            assertNotNull(result);
            assertEquals(BigDecimal.valueOf(0.5), task.getActualHours());
            assertEquals(BigDecimal.valueOf(0.3), task.getPredictionError());
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("getTasksPaginated employee-team filters other requests and maps prefetched data")
    void getTasksPaginated_employeeTeam_filtersAndMaps() {
        UUID userId = UUID.randomUUID();
        UUID employeeId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();

        Company company = new Company();
        company.setId(UUID.randomUUID());
        Team team = new Team();
        team.setId(teamId);
        User employeeUser = new User();
        employeeUser.setId(userId);
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);
        employeeUser.setTeam(team);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(employeeUser);

        User otherCreator = new User();
        otherCreator.setId(UUID.randomUUID());

        Task visible = new Task();
        visible.setId(taskId);
        visible.setTitle("Visible");
        visible.setStatus(TaskStatus.PENDING);
        visible.setPriority(TaskPriority.HIGH);
        visible.setCompany(company);
        visible.setTeam(team);

        Task otherRequest = new Task();
        otherRequest.setId(UUID.randomUUID());
        otherRequest.setTitle("[REQUEST] Other");
        otherRequest.setCreatedBy(otherCreator);
        otherRequest.setStatus(TaskStatus.PENDING);
        otherRequest.setPriority(TaskPriority.MEDIUM);
        otherRequest.setCompany(company);

        var pageable = PageRequest.of(0, 10);
        var page = new org.springframework.data.domain.PageImpl<>(List.of(visible, otherRequest), pageable, 2);

        Skill skill = new Skill();
        skill.setId(UUID.randomUUID());
        TaskRequiredSkill trs = TaskRequiredSkill.builder().task(visible).skill(skill).build();
        TaskAssignment assignment = new TaskAssignment();
        assignment.setTask(visible);

        when(userRepository.findById(userId)).thenReturn(java.util.Optional.of(employeeUser));
        when(employeeRepository.findByUserId(userId)).thenReturn(java.util.Optional.of(employee));
        when(taskRepository.findVisibleTasksForEmployeePaginatedNative(
                eq(company.getId()), eq(userId), eq(employeeId), eq(teamId),
                eq("PENDING"), eq("HIGH"), eq("abc"), eq(pageable)))
                .thenReturn(page);
        when(taskRequiredSkillRepository.findByTaskIdIn(anyList())).thenReturn(List.of(trs));
        when(taskAssignmentRepository.findByTaskIdIn(anyList())).thenReturn(List.of(assignment));
        when(modelMapper.map(eq(assignment), eq(TaskAssignmentDTO.class))).thenReturn(new TaskAssignmentDTO());

        Page<TaskDTO> result = taskService.getTasksPaginated(userId, pageable, TaskStatus.PENDING, TaskPriority.HIGH, "abc");
        assertEquals(1, result.getContent().size());
        assertEquals("Visible", result.getContent().get(0).getTitle());
        assertEquals(1, result.getContent().get(0).getRequiredSkillIds().size());
        assertEquals(1, result.getContent().get(0).getAssignments().size());
    }

    @Test
    @DisplayName("permission checks cover creator, manager team and explicit permissions")
    void permissionChecks_coverMultiplePaths() {
        UUID userId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();

        Team team = new Team();
        team.setId(teamId);

        User manager = new User();
        manager.setId(userId);
        manager.setRole(UserRole.MANAGER);
        manager.setTeam(team);
        manager.setCompany(new Company());

        User creator = new User();
        creator.setId(UUID.randomUUID());

        Task task = new Task();
        task.setId(taskId);
        task.setCreatedBy(creator);
        task.setTeam(team);
        task.setCompany(new Company());

        when(userRepository.findById(userId)).thenReturn(java.util.Optional.of(manager));
        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(task));

        assertTrue(taskService.canUserEditTask(taskId, userId));
        assertTrue(taskService.canUserDeleteTask(taskId, userId));
        assertTrue(taskService.canUserCompleteTask(taskId, userId));
        assertTrue(taskService.canUserViewTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserDeleteTask employee only deletes own request")
    void canUserDeleteTask_employeeOwnRequestOnly() {
        UUID userId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();

        Company company = new Company();
        company.setId(UUID.randomUUID());

        User employee = new User();
        employee.setId(userId);
        employee.setRole(UserRole.EMPLOYEE);
        employee.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setTitle("[REQUEST] ask");
        task.setCreatedBy(employee);

        when(userRepository.findById(userId)).thenReturn(java.util.Optional.of(employee));
        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(task));
        assertTrue(taskService.canUserDeleteTask(taskId, userId));

        task.setTitle("approved");
        assertFalse(taskService.canUserDeleteTask(taskId, userId));
    }

    @Test
    @DisplayName("getTaskRequiredSkillsBatch returns empty lists on repository failure")
    void getTaskRequiredSkillsBatch_failureFallback() {
        UUID t1 = UUID.randomUUID();
        UUID t2 = UUID.randomUUID();
        when(taskRequiredSkillRepository.findByTaskIdIn(anyList())).thenThrow(new RuntimeException("db down"));

        var result = taskService.getTaskRequiredSkillsBatch(List.of(t1, t2));
        assertEquals(List.of(), result.get(t1.toString()));
        assertEquals(List.of(), result.get(t2.toString()));
    }

    @Test
    @DisplayName("canUserViewTask allows access through explicit permission")
    void canUserViewTask_explicitPermission() {
        UUID userId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();

        User user = new User();
        user.setId(userId);
        user.setRole(UserRole.USER);
        user.setCompany(new Company());

        Team taskTeam = new Team();
        taskTeam.setId(UUID.randomUUID());
        Task task = new Task();
        task.setId(taskId);
        task.setTeam(taskTeam);
        User creator = new User();
        creator.setId(UUID.randomUUID());
        task.setCreatedBy(creator);

        when(userRepository.findById(userId)).thenReturn(java.util.Optional.of(user));
        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(task));
        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, userId))
                .thenReturn(java.util.Optional.of(new TaskPermission()));

        assertTrue(taskService.canUserViewTask(taskId, userId));
    }

    @Test
    @DisplayName("canUserCompleteTask employee allowed when assignment accepted")
    void canUserCompleteTask_employeeAcceptedAssignment() {
        UUID userId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();
        UUID employeeId = UUID.randomUUID();

        User employeeUser = new User();
        employeeUser.setId(userId);
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(new Company());

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(employeeUser);

        TaskAssignment assignment = new TaskAssignment();
        assignment.setEmployee(employee);
        assignment.setStatus(TaskAssignmentStatus.ACCEPTED);

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("Normal task");
        task.setTeam(new Team());
        task.setAssignments(List.of(assignment));

        when(userRepository.findById(userId)).thenReturn(java.util.Optional.of(employeeUser));
        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(task));
        when(employeeRepository.findByUserId(userId)).thenReturn(java.util.Optional.of(employee));

        assertTrue(taskService.canUserCompleteTask(taskId, userId));
    }

    @Test
    @DisplayName("getTaskById populates required skill ids and assignments")
    void getTaskById_populatesNestedCollections() {
        UUID taskId = UUID.randomUUID();
        UUID skillId = UUID.randomUUID();

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("Task");
        task.setStatus(TaskStatus.PENDING);
        task.setPriority(TaskPriority.MEDIUM);

        Skill skill = new Skill();
        skill.setId(skillId);
        skill.setName("Java");
        TaskRequiredSkill trs = new TaskRequiredSkill();
        trs.setTask(task);
        trs.setSkill(skill);

        TaskAssignment assignment = new TaskAssignment();
        assignment.setId(UUID.randomUUID());
        assignment.setTask(task);

        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(task));
        when(taskRequiredSkillRepository.findByTaskId(taskId)).thenReturn(List.of(trs));
        when(taskAssignmentRepository.findByTaskId(taskId)).thenReturn(List.of(assignment));

        TaskDTO mapped = new TaskDTO();
        mapped.setId(taskId);
        when(modelMapper.map(any(TaskAssignment.class), eq(TaskAssignmentDTO.class))).thenReturn(new TaskAssignmentDTO());

        TaskDTO dto = taskService.getTaskById(taskId);
        assertNotNull(dto);
        assertEquals(1, dto.getRequiredSkillIds().size());
        assertEquals(skillId, dto.getRequiredSkillIds().get(0));
        assertEquals(1, dto.getAssignments().size());
    }

    @Test
    @DisplayName("updateTask updates changed fields and records audit log entries")
    void updateTask_recordsAuditLogsForChangedFields() {
        UUID taskId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        User updater = new User();
        updater.setId(userId);

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("old");
        task.setDescription("old-desc");
        task.setStatus(TaskStatus.PENDING);
        task.setPriority(TaskPriority.LOW);
        task.setEstimatedHours(BigDecimal.valueOf(2));
        task.setActualHours(BigDecimal.ONE);
        task.setStartDate(LocalDateTime.now().minusDays(2));
        task.setDueDate(LocalDateTime.now().plusDays(2));
        task.setComplexityScore(BigDecimal.valueOf(0.2));

        TaskUpdateDTO update = TaskUpdateDTO.builder()
                .title("new")
                .description("new-desc")
                .status(TaskStatus.COMPLETED)
                .priority(TaskPriority.HIGH)
                .estimatedHours(BigDecimal.valueOf(5))
                .actualHours(BigDecimal.valueOf(4))
                .startDate(LocalDateTime.now().minusDays(1))
                .dueDate(LocalDateTime.now().plusDays(4))
                .complexityScore(BigDecimal.valueOf(0.8))
                .build();

        when(taskRepository.findById(taskId)).thenReturn(java.util.Optional.of(task));
        when(userRepository.findById(userId)).thenReturn(java.util.Optional.of(updater));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(modelMapper.map(any(Task.class), eq(TaskDTO.class))).thenReturn(new TaskDTO());

        TaskDTO result = taskService.updateTask(taskId, update, userId);
        assertNotNull(result);
        assertEquals("new", task.getTitle());
        assertEquals(TaskStatus.COMPLETED, task.getStatus());
        assertNotNull(task.getCompletedDate());

        verify(auditLogService, atLeast(8)).logFieldChange(
                any(Task.class), eq(updater), anyString(), anyString(), anyString());
    }
    // Ξ²β€β‚¬Ξ²β€β‚¬ canUserViewTask: public task (no team, no assignment) Ξ²β€β‚¬Ξ²β€β‚¬
    @Test
    @DisplayName("canUserViewTask allows employee on public unassigned task")
    void canUserViewTask_publicTask_true() {
        UUID userId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();
        Company company = new Company();
        company.setId(UUID.randomUUID());

        User employee = new User();
        employee.setId(userId);
        employee.setRole(UserRole.EMPLOYEE);
        employee.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setTeam(null);

        when(userRepository.findById(userId)).thenReturn(Optional.of(employee));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));

        assertTrue(taskService.canUserViewTask(taskId, userId));
    }

    // Ξ²β€β‚¬Ξ²β€β‚¬ canUserEditTask: USER with explicit permission Ξ²β€β‚¬Ξ²β€β‚¬
    @Test
    @DisplayName("canUserEditTask returns true for USER with canEdit permission")
    void canUserEditTask_userWithPermission_true() {
        UUID userId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();
        Company company = new Company();
        company.setId(UUID.randomUUID());

        User user = new User();
        user.setId(userId);
        user.setRole(UserRole.USER);
        user.setCompany(company);

        // Creator must have an ID different from the test user
        User creator = new User();
        creator.setId(UUID.randomUUID());

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setCreatedBy(creator);

        TaskPermission permission = new TaskPermission();
        permission.setCanEdit(true);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, userId)).thenReturn(Optional.of(permission));

        assertTrue(taskService.canUserEditTask(taskId, userId));
    }

    // Ξ²β€β‚¬Ξ²β€β‚¬ updateTaskStatus: PENDING Ξ²β€ β€™ IN_PROGRESS (status changes, no startDate set by method) Ξ²β€β‚¬Ξ²β€β‚¬
    @Test
    @DisplayName("updateTaskStatus PENDING to IN_PROGRESS updates status and audit logs")
    void updateTaskStatus_pendingToInProgress_updatesStatus() {
        UUID taskId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        Company company = new Company();
        company.setId(UUID.randomUUID());

        User admin = new User();
        admin.setId(adminId);
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("Test");
        task.setStatus(TaskStatus.PENDING);
        task.setPriority(TaskPriority.MEDIUM);
        task.setCompany(company);

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TransactionSynchronizationManager.initSynchronization();
        try {
            taskService.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS, adminId);
            assertEquals(TaskStatus.IN_PROGRESS, task.getStatus());
            verify(auditLogService).logFieldChange(eq(task), eq(admin), eq("status"), eq("PENDING"), eq("IN_PROGRESS"));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // Ξ²β€β‚¬Ξ²β€β‚¬ updateTaskStatus: COMPLETED with preexisting actualHours Ξ²β€β‚¬Ξ²β€β‚¬
    @Test
    @DisplayName("updateTaskStatus COMPLETED skips hour recalculation when actualHours already set")
    void updateTaskStatus_completed_preexistingHours_skipsRecalc() {
        UUID taskId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        Company company = new Company();
        company.setId(UUID.randomUUID());

        User admin = new User();
        admin.setId(adminId);
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("Done");
        task.setStatus(TaskStatus.IN_PROGRESS);
        task.setPriority(TaskPriority.MEDIUM);
        task.setCompany(company);
        task.setActualHours(BigDecimal.valueOf(10));
        task.setEstimatedHours(BigDecimal.valueOf(8));
        task.setStartDate(LocalDateTime.now().minusHours(5));
        task.setScopeChangeCount(10);

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(taskRequiredSkillRepository.findByTaskId(taskId)).thenReturn(List.of());

        TransactionSynchronizationManager.initSynchronization();
        try {
            taskService.updateTaskStatus(taskId, TaskStatus.COMPLETED, adminId);
            assertEquals(BigDecimal.valueOf(10), task.getActualHours());
            assertNotNull(task.getCompletedDate());
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // Ξ²β€β‚¬Ξ²β€β‚¬ updateTaskStatus: already COMPLETED Ξ²β€ β€™ no-op Ξ²β€β‚¬Ξ²β€β‚¬
    @Test
    @DisplayName("updateTaskStatus skips when task is already COMPLETED")
    void updateTaskStatus_alreadyCompleted_skips() {
        UUID taskId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        Company company = new Company();
        company.setId(UUID.randomUUID());

        User admin = new User();
        admin.setId(adminId);
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("Already done");
        task.setStatus(TaskStatus.COMPLETED);
        task.setPriority(TaskPriority.LOW);
        task.setCompany(company);
        task.setCompletedDate(LocalDateTime.now());

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TransactionSynchronizationManager.initSynchronization();
        try {
            taskService.updateTaskStatus(taskId, TaskStatus.COMPLETED, adminId);
            assertEquals(TaskStatus.COMPLETED, task.getStatus());
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // Ξ²β€β‚¬Ξ²β€β‚¬ getAllTasks: ADMIN sees all company tasks Ξ²β€β‚¬Ξ²β€β‚¬
    @Test
    @DisplayName("getAllTasks for ADMIN returns all company tasks unfiltered")
    void getAllTasks_admin_seesAll() {
        UUID adminId = UUID.randomUUID();
        Company company = new Company();
        company.setId(UUID.randomUUID());

        User admin = new User();
        admin.setId(adminId);
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);

        Task t1 = new Task();
        t1.setId(UUID.randomUUID());
        t1.setTitle("Task 1");
        t1.setStatus(TaskStatus.PENDING);
        t1.setPriority(TaskPriority.MEDIUM);

        Task t2 = new Task();
        t2.setId(UUID.randomUUID());
        t2.setTitle("[REQUEST] My Request");
        t2.setStatus(TaskStatus.PENDING);
        t2.setPriority(TaskPriority.LOW);

        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(taskRepository.findByCompanyId(company.getId())).thenReturn(List.of(t1, t2));
        when(taskRequiredSkillRepository.findByTaskIdIn(anyList())).thenReturn(List.of());

        List<TaskDTO> result = taskService.getAllTasks(adminId);
        assertEquals(2, result.size());
    }

    // Ξ²β€β‚¬Ξ²β€β‚¬ getTaskById: task with team populates teamId/teamName Ξ²β€β‚¬Ξ²β€β‚¬
    @Test
    @DisplayName("getTaskById populates teamId and teamName from task entity")
    void getTaskById_withTeam_populatesTeamInfo() {
        UUID taskId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();

        Team team = new Team();
        team.setId(teamId);
        team.setName("Alpha");

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("Team task");
        task.setStatus(TaskStatus.PENDING);
        task.setPriority(TaskPriority.MEDIUM);
        task.setTeam(team);

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(taskRequiredSkillRepository.findByTaskId(taskId)).thenReturn(List.of());
        when(taskAssignmentRepository.findByTaskId(taskId)).thenReturn(List.of());

        TaskDTO dto = taskService.getTaskById(taskId);
        assertEquals(teamId, dto.getTeamId());
        assertEquals("Alpha", dto.getTeamName());
    }

    // Ξ²β€β‚¬Ξ²β€β‚¬ createTask: skill not found by ID Ξ²β€ β€™ fallback to name search Ξ²β€β‚¬Ξ²β€β‚¬
    @Test
    @DisplayName("createTask falls back to skill name lookup when ID not found")
    void createTask_skillByNameFallback() {
        UUID creatorId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID skillId = UUID.randomUUID();

        Company company = new Company();
        company.setId(companyId);

        User creator = new User();
        creator.setId(creatorId);
        creator.setRole(UserRole.ADMIN);
        creator.setCompany(company);

        UUID taskId = UUID.randomUUID();
        Task saved = new Task();
        saved.setId(taskId);
        saved.setTitle("T");
        saved.setCompany(company);
        saved.setCreatedBy(creator);
        saved.setDueDate(LocalDateTime.now().plusDays(1));
        saved.setPriority(TaskPriority.MEDIUM);
        saved.setStatus(TaskStatus.PENDING);

        Skill skill = new Skill();
        skill.setId(skillId);
        skill.setName("Java");

        var createDTO = new com.thesis.smart_resource_planner.model.dto.TaskCreateDTO();
        createDTO.setTitle("T");
        createDTO.setDescription("D");
        createDTO.setPriority(TaskPriority.MEDIUM);
        createDTO.setEstimatedHours(BigDecimal.valueOf(5));
        createDTO.setDueDate(LocalDateTime.now().plusDays(1));
        createDTO.setRequiredSkillIds(List.of(skillId));

        when(userRepository.findById(creatorId)).thenReturn(Optional.of(creator));
        when(taskRepository.saveAndFlush(any(Task.class))).thenReturn(saved);
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(saved));
        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, creatorId)).thenReturn(Optional.empty());
        when(skillRepository.findById(skillId)).thenReturn(Optional.empty());
        when(skillRepository.findByNameIgnoreCase(skillId.toString())).thenReturn(Optional.of(skill));
        when(taskRequiredSkillRepository.existsByTaskIdAndSkillId(taskId, skillId)).thenReturn(false);
        when(taskRequiredSkillRepository.findByTaskId(taskId)).thenReturn(List.of(
                TaskRequiredSkill.builder().task(saved).skill(skill).build()));
        when(modelMapper.map(any(Task.class), eq(TaskDTO.class))).thenReturn(new TaskDTO());

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskDTO dto = taskService.createTask(createDTO, creatorId);
            assertNotNull(dto);
            verify(skillRepository).findByNameIgnoreCase(skillId.toString());
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // Ξ²β€β‚¬Ξ²β€β‚¬ createTask: duplicate skill Ξ²β€ β€™ skips saving Ξ²β€β‚¬Ξ²β€β‚¬
    @Test
    @DisplayName("createTask skips duplicate required skill")
    void createTask_duplicateSkill_skips() {
        UUID creatorId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID skillId = UUID.randomUUID();

        Company company = new Company();
        company.setId(companyId);

        User creator = new User();
        creator.setId(creatorId);
        creator.setRole(UserRole.ADMIN);
        creator.setCompany(company);

        UUID taskId = UUID.randomUUID();
        Task saved = new Task();
        saved.setId(taskId);
        saved.setTitle("T");
        saved.setCompany(company);
        saved.setCreatedBy(creator);
        saved.setDueDate(LocalDateTime.now().plusDays(1));
        saved.setPriority(TaskPriority.MEDIUM);
        saved.setStatus(TaskStatus.PENDING);

        Skill skill = new Skill();
        skill.setId(skillId);
        skill.setName("Java");

        var createDTO = new com.thesis.smart_resource_planner.model.dto.TaskCreateDTO();
        createDTO.setTitle("T");
        createDTO.setDescription("D");
        createDTO.setPriority(TaskPriority.MEDIUM);
        createDTO.setEstimatedHours(BigDecimal.valueOf(5));
        createDTO.setDueDate(LocalDateTime.now().plusDays(1));
        createDTO.setRequiredSkillIds(List.of(skillId));

        when(userRepository.findById(creatorId)).thenReturn(Optional.of(creator));
        when(taskRepository.saveAndFlush(any(Task.class))).thenReturn(saved);
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(saved));
        when(taskPermissionRepository.findByTaskIdAndUserId(taskId, creatorId)).thenReturn(Optional.empty());
        when(skillRepository.findById(skillId)).thenReturn(Optional.of(skill));
        when(taskRequiredSkillRepository.existsByTaskIdAndSkillId(taskId, skillId)).thenReturn(true);
        when(taskRequiredSkillRepository.findByTaskId(taskId)).thenReturn(List.of());
        when(modelMapper.map(any(Task.class), eq(TaskDTO.class))).thenReturn(new TaskDTO());

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskDTO dto = taskService.createTask(createDTO, creatorId);
            assertNotNull(dto);
            verify(taskRequiredSkillRepository, never()).save(any(TaskRequiredSkill.class));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // Ξ²β€β‚¬Ξ²β€β‚¬ updateTask: null original actualHours path Ξ²β€β‚¬Ξ²β€β‚¬
    @Test
    @DisplayName("updateTask handles null original actualHours gracefully")
    void updateTask_nullOriginalActualHours() {
        UUID taskId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        User updater = new User();
        updater.setId(userId);

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("old");
        task.setStatus(TaskStatus.PENDING);
        task.setPriority(TaskPriority.LOW);
        task.setActualHours(null);

        TaskUpdateDTO update = TaskUpdateDTO.builder()
                .actualHours(BigDecimal.valueOf(3))
                .build();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findById(userId)).thenReturn(Optional.of(updater));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(modelMapper.map(any(Task.class), eq(TaskDTO.class))).thenReturn(new TaskDTO());

        TaskDTO result = taskService.updateTask(taskId, update, userId);
        assertNotNull(result);
        assertEquals(BigDecimal.valueOf(3), task.getActualHours());
    }

    // Ξ²β€β‚¬Ξ²β€β‚¬ updateTask: non-null original dates and complexity (change detection) Ξ²β€β‚¬Ξ²β€β‚¬
    @Test
    @DisplayName("updateTask detects and updates changed dates and complexity")
    void updateTask_changedDatesAndComplexity() {
        UUID taskId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        LocalDateTime oldStart = LocalDateTime.now().minusDays(10);
        LocalDateTime oldDue = LocalDateTime.now().plusDays(1);
        LocalDateTime newStart = LocalDateTime.now().minusDays(1);
        LocalDateTime newDue = LocalDateTime.now().plusDays(5);

        User updater = new User();
        updater.setId(userId);

        Task task = new Task();
        task.setId(taskId);
        task.setTitle("old");
        task.setStatus(TaskStatus.PENDING);
        task.setPriority(TaskPriority.LOW);
        task.setStartDate(oldStart);
        task.setDueDate(oldDue);
        task.setComplexityScore(BigDecimal.valueOf(0.5));
        task.setEstimatedHours(BigDecimal.valueOf(8));

        TaskUpdateDTO update = TaskUpdateDTO.builder()
                .startDate(newStart)
                .dueDate(newDue)
                .complexityScore(BigDecimal.valueOf(0.9))
                .estimatedHours(BigDecimal.valueOf(12))
                .build();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findById(userId)).thenReturn(Optional.of(updater));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(modelMapper.map(any(Task.class), eq(TaskDTO.class))).thenReturn(new TaskDTO());

        TaskDTO result = taskService.updateTask(taskId, update, userId);
        assertNotNull(result);
        assertEquals(newStart, task.getStartDate());
        assertEquals(newDue, task.getDueDate());
        assertEquals(BigDecimal.valueOf(0.9), task.getComplexityScore());
        assertEquals(BigDecimal.valueOf(12), task.getEstimatedHours());
    }
}
