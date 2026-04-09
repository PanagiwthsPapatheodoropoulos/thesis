package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
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
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
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

    @InjectMocks
    private UserService userService;

    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        Company company = new Company();
        company.setId(UUID.randomUUID());

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
}

