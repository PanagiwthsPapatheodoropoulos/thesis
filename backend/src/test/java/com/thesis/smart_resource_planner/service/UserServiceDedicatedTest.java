package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.NotificationSeverity;
import com.thesis.smart_resource_planner.enums.NotificationType;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.NotificationCreateDTO;
import com.thesis.smart_resource_planner.model.dto.UserDTO;
import com.thesis.smart_resource_planner.model.dto.UserUpdateDTO;
import com.thesis.smart_resource_planner.model.entity.ChatMessage;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.EmployeeAvailability;
import com.thesis.smart_resource_planner.model.entity.EmployeeSkill;
import com.thesis.smart_resource_planner.model.entity.Notification;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskAssignment;
import com.thesis.smart_resource_planner.model.entity.TaskPermission;
import com.thesis.smart_resource_planner.model.entity.Team;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceDedicatedTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private TeamRepository teamRepository;
    @Mock
    private EmployeeRepository employeeRepository;
    @Mock
    private EmployeeSkillRepository employeeSkillRepository;
    @Mock
    private EmployeeAvailabilityRepository availabilityRepository;
    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private TaskAssignmentRepository taskAssignmentRepository;
    @Mock
    private ChatMessageRepository chatMessageRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private TaskPermissionRepository taskPermissionRepository;
    @Mock
    private ModelMapper modelMapper;
    @Mock
    private BrevoEmailService brevoEmailService;
    @Mock
    private CompanyRepository companyRepository;
    @Mock
    private CompanyBlocklistRepository companyBlocklistRepository;
    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private UserService userService;

    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        Company company = new Company();
        company.setId(UUID.randomUUID());
        company.setName("Acme");

        user = new User();
        user.setId(userId);
        user.setUsername("u1");
        user.setEmail("u1@x.com");
        user.setRole(UserRole.EMPLOYEE);
        user.setCompany(company);
    }

    @Test
    @DisplayName("updateUser throws duplicate when new email already exists")
    void updateUser_duplicateEmail() {
        UserUpdateDTO dto = new UserUpdateDTO();
        dto.setEmail("taken@x.com");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.existsByEmail("taken@x.com")).thenReturn(true);

        assertThrows(DuplicateResourceException.class, () -> userService.updateUser(userId, dto));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    @DisplayName("updateUser clears team when promoting to admin and applies role")
    void updateUser_promoteToAdmin_clearsTeam() {
        Team team = new Team();
        team.setId(UUID.randomUUID());
        user.setTeam(team);
        user.setRole(UserRole.EMPLOYEE);

        UserUpdateDTO dto = new UserUpdateDTO();
        dto.setRole(UserRole.ADMIN);

        UserDTO mapped = new UserDTO();
        mapped.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(modelMapper.map(user, UserDTO.class)).thenReturn(mapped);

        UserDTO result = userService.updateUser(userId, dto);
        assertNotNull(result);
        assertNull(user.getTeam());
        assertEquals(UserRole.ADMIN, user.getRole());
    }

    @Test
    @DisplayName("updateUser throws when target team does not exist")
    void updateUser_teamNotFound() {
        UserUpdateDTO dto = new UserUpdateDTO();
        dto.setTeamId(UUID.randomUUID());

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(teamRepository.findById(dto.getTeamId())).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> userService.updateUser(userId, dto));
    }

    @Test
    @DisplayName("deleteUser blocks deletion of last admin")
    void deleteUser_lastAdminBlocked() {
        user.setRole(UserRole.ADMIN);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.countByRole(UserRole.ADMIN)).thenReturn(1L);

        assertThrows(IllegalStateException.class, () -> userService.deleteUser(userId));
        verify(userRepository, never()).deleteById(any());
    }

    @Test
    @DisplayName("deleteUser removes user with no related child records")
    void deleteUser_successNoChildren() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(taskPermissionRepository.findByUserId(userId)).thenReturn(List.of());
        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());
        when(chatMessageRepository.findAllUserMessages(userId)).thenReturn(List.of());
        when(taskRepository.findByCreatedById(userId)).thenReturn(List.of());

        userService.deleteUser(userId);

        verify(userRepository).deleteById(userId);
        verify(userRepository).flush();
    }

    @Test
    @DisplayName("getUsersByTeam maps users to DTOs")
    void getUsersByTeam_mapsDtos() {
        Team team = new Team();
        UUID teamId = UUID.randomUUID();
        team.setId(teamId);
        user.setTeam(team);
        UserDTO dto = new UserDTO();
        dto.setId(userId);

        when(userRepository.findByTeamId(teamId)).thenReturn(List.of(user));
        when(modelMapper.map(user, UserDTO.class)).thenReturn(dto);

        List<UserDTO> result = userService.getUsersByTeam(teamId);
        assertEquals(1, result.size());
        assertEquals(userId, result.get(0).getId());
    }

    @Test
    @DisplayName("updateUser assigns existing team and isActive")
    void updateUser_setsTeamAndActive() {
        Team targetTeam = new Team();
        UUID targetTeamId = UUID.randomUUID();
        targetTeam.setId(targetTeamId);

        UserUpdateDTO dto = new UserUpdateDTO();
        dto.setTeamId(targetTeamId);
        dto.setIsActive(false);
        dto.setRole(UserRole.EMPLOYEE);

        UserDTO mapped = new UserDTO();
        mapped.setId(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(teamRepository.findById(targetTeamId)).thenReturn(Optional.of(targetTeam));
        when(userRepository.save(user)).thenReturn(user);
        when(modelMapper.map(user, UserDTO.class)).thenReturn(mapped);

        UserDTO result = userService.updateUser(userId, dto);
        assertNotNull(result);
        assertEquals(targetTeamId, user.getTeam().getId());
        assertFalse(Boolean.TRUE.equals(user.getIsActive()));
    }

    @Test
    @DisplayName("deleteUser blocks deletion of last manager")
    void deleteUser_lastManagerBlocked() {
        user.setRole(UserRole.MANAGER);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.countByRole(UserRole.MANAGER)).thenReturn(1L);
        assertThrows(IllegalStateException.class, () -> userService.deleteUser(userId));
        verify(userRepository, never()).deleteById(any());
    }

    @Test
    @DisplayName("deleteUser cascades employee and task references cleanup")
    void deleteUser_withEmployeeChildren_cascades() {
        UUID employeeId = UUID.randomUUID();
        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(user);
        user.setTeam(new Team());

        TaskPermission permission = new TaskPermission();
        EmployeeSkill skill = new EmployeeSkill();
        EmployeeAvailability availability = new EmployeeAvailability();
        TaskAssignment assignment = new TaskAssignment();
        Task assignedTask = new Task();
        assignedTask.setAssignedEmployeeId(employeeId);
        Task createdTask = new Task();
        createdTask.setCreatedBy(user);
        Notification notification = new Notification();
        ChatMessage chat = new ChatMessage();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(taskPermissionRepository.findByUserId(userId)).thenReturn(List.of(permission));
        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.of(employee));
        when(employeeSkillRepository.findByEmployeeId(employeeId)).thenReturn(List.of(skill));
        when(availabilityRepository.findByEmployeeId(employeeId)).thenReturn(List.of(availability));
        when(taskAssignmentRepository.findByEmployeeId(employeeId)).thenReturn(List.of(assignment));
        when(taskRepository.findByAssignedEmployeeId(employeeId)).thenReturn(List.of(assignedTask));
        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(notification));
        when(chatMessageRepository.findAllUserMessages(userId)).thenReturn(List.of(chat));
        when(taskRepository.findByCreatedById(userId)).thenReturn(List.of(createdTask));

        userService.deleteUser(userId);

        assertNull(assignedTask.getAssignedEmployeeId());
        assertNull(createdTask.getCreatedBy());
        verify(employeeRepository).delete(employee);
        verify(userRepository).deleteById(userId);
    }

    @Test
    @DisplayName("updatePreferences saves json string on user")
    void updatePreferences_saves() {
        String json = "{\"email\":true}";
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        userService.updatePreferences(userId, json);
        assertEquals(json, user.getNotificationPreferences());
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("removeUserFromCompany clears company and sends rejection notification")
    void removeUserFromCompany_dismissed_sendsNotification() {
        user.setTeam(new Team());
        user.setRole(UserRole.MANAGER);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        userService.removeUserFromCompany(userId, "DISMISSED");

        assertNull(user.getCompany());
        assertNull(user.getTeam());
        assertEquals(UserRole.USER, user.getRole());

        ArgumentCaptor<NotificationCreateDTO> captor = ArgumentCaptor.forClass(NotificationCreateDTO.class);
        verify(notificationService).createNotification(captor.capture());
        NotificationCreateDTO notification = captor.getValue();
        assertEquals(NotificationType.JOIN_REJECTED, notification.getType());
        assertEquals(NotificationSeverity.WARNING, notification.getSeverity());
        verify(brevoEmailService).sendDismissalEmail(eq(user.getEmail()), eq(user.getUsername()), eq("Acme"));
    }

    @Test
    @DisplayName("removeUserFromCompany uses blocked messaging when reason is BLOCKED")
    void removeUserFromCompany_blocked_setsBlockedTitle() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        userService.removeUserFromCompany(userId, "BLOCKED");

        ArgumentCaptor<NotificationCreateDTO> captor = ArgumentCaptor.forClass(NotificationCreateDTO.class);
        verify(notificationService).createNotification(captor.capture());
        NotificationCreateDTO notification = captor.getValue();
        assertEquals("Company Access Blocked", notification.getTitle());
    }

    @Test
    @DisplayName("joinCompany assigns company and notifies admins")
    void joinCompany_success_assignsCompany() {
        user.setCompany(null);
        Company target = new Company();
        target.setId(UUID.randomUUID());
        User admin = new User();
        admin.setId(UUID.randomUUID());
        User manager = new User();
        manager.setId(UUID.randomUUID());
        UserDTO dto = new UserDTO();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(companyRepository.findByJoinCode("CODE")).thenReturn(Optional.of(target));
        when(companyBlocklistRepository.existsByCompanyIdAndEmailIgnoreCase(target.getId(), user.getEmail()))
                .thenReturn(false);
        when(userRepository.save(user)).thenReturn(user);
        when(userRepository.findByRoleAndCompanyId(eq(UserRole.ADMIN), any(UUID.class))).thenReturn(new java.util.ArrayList<>(List.of(admin)));
        when(userRepository.findByRoleAndCompanyId(eq(UserRole.MANAGER), any(UUID.class))).thenReturn(new java.util.ArrayList<>(List.of(manager)));
        when(modelMapper.map(user, UserDTO.class)).thenReturn(dto);

        UserDTO result = userService.joinCompany(userId, "CODE");

        assertNotNull(result);
        assertEquals(target, user.getCompany());
        assertEquals(UserRole.USER, user.getRole());
        verify(notificationService, times(2)).createNotification(any(NotificationCreateDTO.class));
    }

    @Test
    @DisplayName("joinCompany throws when code is invalid")
    void joinCompany_invalidCode_throws() {
        user.setCompany(null);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(companyRepository.findByJoinCode("BAD")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> userService.joinCompany(userId, "BAD"));
    }

    @Test
    @DisplayName("joinCompany blocks when user email is blocklisted")
    void joinCompany_blocklisted_throws() {
        user.setCompany(null);
        Company target = new Company();
        target.setId(UUID.randomUUID());
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(companyRepository.findByJoinCode("CODE")).thenReturn(Optional.of(target));
        when(companyBlocklistRepository.existsByCompanyIdAndEmailIgnoreCase(target.getId(), user.getEmail()))
                .thenReturn(true);

        assertThrows(IllegalStateException.class, () -> userService.joinCompany(userId, "CODE"));
    }

    @Test
    @DisplayName("getAllUsers returns company-scoped users")
    void getAllUsers_scopedByCompany() {
        User teammate = new User();
        teammate.setId(UUID.randomUUID());
        teammate.setCompany(user.getCompany());
        UserDTO dto1 = new UserDTO();
        dto1.setId(userId);
        UserDTO dto2 = new UserDTO();
        dto2.setId(teammate.getId());

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.findByCompanyId(user.getCompany().getId())).thenReturn(List.of(user, teammate));
        when(modelMapper.map(user, UserDTO.class)).thenReturn(dto1);
        when(modelMapper.map(teammate, UserDTO.class)).thenReturn(dto2);

        List<UserDTO> result = userService.getAllUsers(userId);
        assertEquals(2, result.size());
    }

    @Test
    @DisplayName("getUserByUsername throws when user does not exist")
    void getUserByUsername_notFound() {
        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> userService.getUserByUsername("missing"));
    }

    @Test
    @DisplayName("removeUserFromCompany continues when notification fails")
    void removeUserFromCompany_notificationFailureStillSaves() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        doThrow(new RuntimeException("notify down")).when(notificationService).createNotification(any(NotificationCreateDTO.class));

        userService.removeUserFromCompany(userId, null);

        assertNull(user.getCompany());
        assertEquals(UserRole.USER, user.getRole());
        verify(userRepository).save(user);
        verify(brevoEmailService).sendDismissalEmail(eq(user.getEmail()), eq(user.getUsername()), eq("Acme"));
    }

    @Test
    @DisplayName("joinCompany throws when user already belongs to company")
    void joinCompany_alreadyInCompany_throws() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        assertThrows(IllegalStateException.class, () -> userService.joinCompany(userId, "CODE"));
    }

    @Test
    @DisplayName("joinCompany still succeeds when admin notifications fail")
    void joinCompany_notificationFailureStillReturnsUser() {
        user.setCompany(null);
        Company target = new Company();
        target.setId(UUID.randomUUID());
        User admin = new User();
        admin.setId(UUID.randomUUID());
        UserDTO dto = new UserDTO();
        dto.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(companyRepository.findByJoinCode("CODE")).thenReturn(Optional.of(target));
        when(companyBlocklistRepository.existsByCompanyIdAndEmailIgnoreCase(target.getId(), user.getEmail())).thenReturn(false);
        when(userRepository.save(user)).thenReturn(user);
        when(userRepository.findByRoleAndCompanyId(UserRole.ADMIN, target.getId())).thenReturn(new java.util.ArrayList<>(List.of(admin)));
        when(userRepository.findByRoleAndCompanyId(UserRole.MANAGER, target.getId())).thenReturn(new java.util.ArrayList<>());
        doThrow(new RuntimeException("ws down")).when(notificationService).createNotification(any(NotificationCreateDTO.class));
        when(modelMapper.map(user, UserDTO.class)).thenReturn(dto);

        UserDTO result = userService.joinCompany(userId, "CODE");
        assertNotNull(result);
        assertEquals(target, user.getCompany());
    }

    @Test
    @DisplayName("getUserById throws when user does not exist")
    void getUserById_notFound() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> userService.getUserById(userId));
    }

    @Test
    @DisplayName("getUserByEmail throws when user does not exist")
    void getUserByEmail_notFound() {
        when(userRepository.findByEmail("missing@x.com")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> userService.getUserByEmail("missing@x.com"));
    }
}

