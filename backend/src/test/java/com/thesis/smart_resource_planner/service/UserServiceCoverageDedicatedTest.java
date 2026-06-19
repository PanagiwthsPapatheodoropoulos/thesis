package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.UserDTO;
import com.thesis.smart_resource_planner.model.dto.UserUpdateDTO;
import com.thesis.smart_resource_planner.model.entity.*;
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
@DisplayName("UserService Coverage - Gap Tests")
class UserServiceCoverageDedicatedTest {

    @Mock private UserRepository userRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private EmployeeSkillRepository employeeSkillRepository;
    @Mock private EmployeeAvailabilityRepository availabilityRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private TaskAssignmentRepository taskAssignmentRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private TaskPermissionRepository taskPermissionRepository;
    @Mock private ModelMapper modelMapper;

    @InjectMocks private UserService userService;

    private UUID userId;
    private User user;
    private Company company;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        company = new Company();
        company.setId(UUID.randomUUID());
        user = new User();
        user.setId(userId);
        user.setUsername("testuser");
        user.setEmail("test@test.com");
        user.setRole(UserRole.EMPLOYEE);
        user.setCompany(company);
    }

    @Test
    @DisplayName("getUserById returns mapped DTO")
    void getUserById_success() {
        UserDTO dto = new UserDTO();
        dto.setId(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(modelMapper.map(user, UserDTO.class)).thenReturn(dto);
        assertEquals(userId, userService.getUserById(userId).getId());
    }

    @Test
    @DisplayName("getUserById throws when not found")
    void getUserById_notFound_throws() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> userService.getUserById(userId));
    }

    @Test
    @DisplayName("getUserByUsername returns mapped DTO")
    void getUserByUsername_success() {
        UserDTO dto = new UserDTO();
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(modelMapper.map(user, UserDTO.class)).thenReturn(dto);
        assertNotNull(userService.getUserByUsername("testuser"));
    }

    @Test
    @DisplayName("getUserByUsername throws when not found")
    void getUserByUsername_notFound_throws() {
        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> userService.getUserByUsername("missing"));
    }

    @Test
    @DisplayName("getUserByEmail returns mapped DTO")
    void getUserByEmail_success() {
        UserDTO dto = new UserDTO();
        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(user));
        when(modelMapper.map(user, UserDTO.class)).thenReturn(dto);
        assertNotNull(userService.getUserByEmail("test@test.com"));
    }

    @Test
    @DisplayName("getUserByEmail throws when not found")
    void getUserByEmail_notFound_throws() {
        when(userRepository.findByEmail("none@x.com")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> userService.getUserByEmail("none@x.com"));
    }

    @Test
    @DisplayName("getAllUsers returns all users in current user's company")
    void getAllUsers_success() {
        User other = new User();
        other.setId(UUID.randomUUID());
        UserDTO dto = new UserDTO();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.findByCompanyId(company.getId())).thenReturn(List.of(user, other));
        when(modelMapper.map(any(User.class), eq(UserDTO.class))).thenReturn(dto);

        assertEquals(2, userService.getAllUsers(userId).size());
    }

    @Test
    @DisplayName("getUsersByRole returns filtered users")
    void getUsersByRole_returnsFiltered() {
        UserDTO dto = new UserDTO();
        when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of(user));
        when(modelMapper.map(user, UserDTO.class)).thenReturn(dto);

        assertEquals(1, userService.getUsersByRole(UserRole.ADMIN).size());
    }

    @Test
    @DisplayName("updateUser promotes to MANAGER and clears team")
    void updateUser_promoteToManager_clearsTeam() {
        Team team = new Team();
        team.setId(UUID.randomUUID());
        user.setTeam(team);

        UserUpdateDTO dto = new UserUpdateDTO();
        dto.setRole(UserRole.MANAGER);

        UserDTO mapped = new UserDTO();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(modelMapper.map(user, UserDTO.class)).thenReturn(mapped);

        userService.updateUser(userId, dto);
        assertNull(user.getTeam());
        assertEquals(UserRole.MANAGER, user.getRole());
    }

    @Test
    @DisplayName("updateUser updates email when different and not taken")
    void updateUser_updatesEmail() {
        UserUpdateDTO dto = new UserUpdateDTO();
        dto.setEmail("new@test.com");

        UserDTO mapped = new UserDTO();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.existsByEmail("new@test.com")).thenReturn(false);
        when(userRepository.save(user)).thenReturn(user);
        when(modelMapper.map(user, UserDTO.class)).thenReturn(mapped);

        userService.updateUser(userId, dto);
        assertEquals("new@test.com", user.getEmail());
    }

    @Test
    @DisplayName("updateUser keeps role-same without clearing team")
    void updateUser_sameRole_keepsTeam() {
        Team team = new Team();
        team.setId(UUID.randomUUID());
        user.setTeam(team);

        UserUpdateDTO dto = new UserUpdateDTO();
        dto.setRole(UserRole.EMPLOYEE);

        UserDTO mapped = new UserDTO();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(modelMapper.map(user, UserDTO.class)).thenReturn(mapped);

        userService.updateUser(userId, dto);
        assertNotNull(user.getTeam());
    }

    @Test
    @DisplayName("deleteUser with admin count > 1 allows deletion")
    void deleteUser_adminWithMultiple_succeeds() {
        user.setRole(UserRole.ADMIN);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.countByRole(UserRole.ADMIN)).thenReturn(3L);
        when(taskPermissionRepository.findByUserId(userId)).thenReturn(List.of());
        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());
        when(chatMessageRepository.findAllUserMessages(userId)).thenReturn(List.of());
        when(taskRepository.findByCreatedById(userId)).thenReturn(List.of());

        userService.deleteUser(userId);
        verify(userRepository).deleteById(userId);
    }

    @Test
    @DisplayName("deleteUser with manager count > 1 allows deletion")
    void deleteUser_managerWithMultiple_succeeds() {
        user.setRole(UserRole.MANAGER);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.countByRole(UserRole.MANAGER)).thenReturn(2L);
        when(taskPermissionRepository.findByUserId(userId)).thenReturn(List.of());
        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());
        when(chatMessageRepository.findAllUserMessages(userId)).thenReturn(List.of());
        when(taskRepository.findByCreatedById(userId)).thenReturn(List.of());

        userService.deleteUser(userId);
        verify(userRepository).deleteById(userId);
    }

    @Test
    @DisplayName("deleteUser wraps unexpected exception in RuntimeException")
    void deleteUser_exceptionWrapped() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(taskPermissionRepository.findByUserId(userId)).thenThrow(new RuntimeException("db error"));

        assertThrows(RuntimeException.class, () -> userService.deleteUser(userId));
    }

    @Test
    @DisplayName("deleteUser not found throws ResourceNotFoundException")
    void deleteUser_notFound_throws() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> userService.deleteUser(userId));
    }
}
