package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.UserDTO;
import com.thesis.smart_resource_planner.model.dto.UserUpdateDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Team;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserService Tests")
class UserServiceLegacyDedicatedTest {

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

    private User testUser;
    private UserDTO testUserDTO;
    private UUID userId;
    private Company company;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        company = new Company();
        company.setId(UUID.randomUUID());

        testUser = new User();
        testUser.setId(userId);
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setRole(UserRole.EMPLOYEE);
        testUser.setCompany(company);
        testUser.setCreatedAt(LocalDateTime.now());

        testUserDTO = new UserDTO();
        testUserDTO.setId(userId);
        testUserDTO.setUsername("testuser");
        testUserDTO.setEmail("test@example.com");
    }

    @Test
    @DisplayName("Should retrieve user by ID successfully")
    void testGetUserById_Success() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(modelMapper.map(testUser, UserDTO.class)).thenReturn(testUserDTO);

        UserDTO result = userService.getUserById(userId);

        assertNotNull(result);
        assertEquals(testUserDTO.getId(), result.getId());
        assertEquals(testUserDTO.getUsername(), result.getUsername());
        verify(userRepository, times(1)).findById(userId);
    }

    @Test
    @DisplayName("Should throw ResourceNotFoundException when user not found by ID")
    void testGetUserById_NotFound() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> userService.getUserById(userId));
        verify(userRepository, times(1)).findById(userId);
    }

    @Test
    @DisplayName("Should retrieve user by username successfully")
    void testGetUserByUsername_Success() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(modelMapper.map(testUser, UserDTO.class)).thenReturn(testUserDTO);

        UserDTO result = userService.getUserByUsername("testuser");

        assertNotNull(result);
        assertEquals(testUserDTO.getUsername(), result.getUsername());
        verify(userRepository, times(1)).findByUsername("testuser");
    }

    @Test
    @DisplayName("Should throw ResourceNotFoundException when user not found by username")
    void testGetUserByUsername_NotFound() {
        when(userRepository.findByUsername("nonexistent")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> userService.getUserByUsername("nonexistent"));
        verify(userRepository, times(1)).findByUsername("nonexistent");
    }

    @Test
    @DisplayName("Should retrieve user by email successfully")
    void testGetUserByEmail_Success() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(modelMapper.map(testUser, UserDTO.class)).thenReturn(testUserDTO);

        UserDTO result = userService.getUserByEmail("test@example.com");

        assertNotNull(result);
        assertEquals(testUserDTO.getEmail(), result.getEmail());
        verify(userRepository, times(1)).findByEmail("test@example.com");
    }

    @Test
    @DisplayName("Should throw ResourceNotFoundException when user not found by email")
    void testGetUserByEmail_NotFound() {
        when(userRepository.findByEmail("notfound@example.com")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> userService.getUserByEmail("notfound@example.com"));
        verify(userRepository, times(1)).findByEmail("notfound@example.com");
    }

    @Test
    @DisplayName("Should retrieve all users successfully")
    void testGetAllUsers_Success() {
        List<User> users = List.of(testUser);

        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userRepository.findByCompanyId(company.getId())).thenReturn(users);
        when(modelMapper.map(any(User.class), eq(UserDTO.class))).thenReturn(testUserDTO);

        List<UserDTO> result = userService.getAllUsers(userId);

        assertNotNull(result);
        assertEquals(1, result.size());
        verify(userRepository, times(1)).findByCompanyId(company.getId());
    }

    @Test
    @DisplayName("Should retrieve users by role successfully")
    void testGetUsersByRole_Success() {
        List<User> users = Arrays.asList(testUser);

        when(userRepository.findByRole(UserRole.EMPLOYEE)).thenReturn(users);
        when(modelMapper.map(testUser, UserDTO.class)).thenReturn(testUserDTO);

        List<UserDTO> result = userService.getUsersByRole(UserRole.EMPLOYEE);

        assertNotNull(result);
        assertEquals(1, result.size());
        verify(userRepository, times(1)).findByRole(UserRole.EMPLOYEE);
    }

    @Test
    @DisplayName("updateUser throws duplicate resource when email already exists")
    void testUpdateUser_DuplicateEmail_Throws() {
        UserUpdateDTO dto = new UserUpdateDTO();
        dto.setEmail("new@example.com");

        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userRepository.existsByEmail("new@example.com")).thenReturn(true);

        assertThrows(com.thesis.smart_resource_planner.exception.DuplicateResourceException.class,
                () -> userService.updateUser(userId, dto));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    @DisplayName("updateUser assigns team and manager role successfully")
    void testUpdateUser_AssignsTeamAndRole() {
        UUID teamId = UUID.randomUUID();
        Team team = new Team();
        team.setId(teamId);

        UserUpdateDTO dto = new UserUpdateDTO();
        dto.setRole(UserRole.MANAGER);
        dto.setTeamId(teamId);
        dto.setIsActive(false);

        UserDTO mapped = new UserDTO();
        mapped.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(modelMapper.map(any(User.class), eq(UserDTO.class))).thenReturn(mapped);

        UserDTO result = userService.updateUser(userId, dto);
        assertNotNull(result);
        assertEquals(UserRole.MANAGER, testUser.getRole());
        assertEquals(teamId, testUser.getTeam().getId());
        assertFalse(testUser.getIsActive());
    }

    @Test
    @DisplayName("deleteUser blocks deleting last admin")
    void testDeleteUser_LastAdminBlocked() {
        testUser.setRole(UserRole.ADMIN);
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userRepository.countByRole(UserRole.ADMIN)).thenReturn(1L);

        assertThrows(IllegalStateException.class, () -> userService.deleteUser(userId));
    }
}
