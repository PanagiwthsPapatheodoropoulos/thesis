package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.CompanyRegistrationDTO;
import com.thesis.smart_resource_planner.model.dto.UserDTO;
import com.thesis.smart_resource_planner.model.dto.UserRegistrationDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.util.ReflectionTestUtils.setField;

@ExtendWith(MockitoExtension.class)
class AuthServiceDedicatedTest {

    @Mock private UserRepository userRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private com.thesis.smart_resource_planner.security.JwtTokenProvider tokenProvider;
    @Mock private ModelMapper modelMapper;
    @Mock private CompanyService companyService;

    @InjectMocks private AuthService authService;

    @BeforeEach
    void setUp() {
        setField(authService, "ADMIN_KEY", "admin-secret");
        setField(authService, "MANAGER_KEY", "manager-secret");
    }

    @Test
    @DisplayName("register assigns ADMIN role when admin key matches")
    void register_adminKey_assignsAdminRole() {
        UserRegistrationDTO dto = new UserRegistrationDTO();
        dto.setUsername("admin");
        dto.setEmail("a@x.com");
        dto.setPassword("pw");
        dto.setAdminKey("admin-secret");

        Company company = new Company();
        company.setId(UUID.randomUUID());
        when(userRepository.existsByUsername("admin")).thenReturn(false);
        when(userRepository.existsByEmail("a@x.com")).thenReturn(false);
        when(passwordEncoder.encode("pw")).thenReturn("enc");
        when(companyService.getDefaultCompany()).thenReturn(company);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(modelMapper.map(any(User.class), eq(UserDTO.class))).thenReturn(new UserDTO());

        authService.register(dto);

        verify(userRepository).save(argThat(u -> u.getRole() == UserRole.ADMIN));
    }

    @Test
    @DisplayName("register throws for invalid admin key")
    void register_invalidAdminKey_throws() {
        UserRegistrationDTO dto = new UserRegistrationDTO();
        dto.setUsername("u1");
        dto.setEmail("u1@x.com");
        dto.setPassword("pw");
        dto.setAdminKey("bad-key");

        Company company = new Company();
        when(userRepository.existsByUsername("u1")).thenReturn(false);
        when(userRepository.existsByEmail("u1@x.com")).thenReturn(false);
        when(companyService.getDefaultCompany()).thenReturn(company);

        assertThrows(IllegalArgumentException.class, () -> authService.register(dto));
    }

    @Test
    @DisplayName("registerCompany creates admin user and maps response")
    void registerCompany_success() {
        CompanyRegistrationDTO dto = new CompanyRegistrationDTO();
        dto.setCompanyName("Acme");
        dto.setAdminUsername("admin");
        dto.setAdminEmail("admin@acme.com");
        dto.setAdminPassword("pw");

        Company company = new Company();
        company.setId(UUID.randomUUID());
        company.setName("Acme");
        company.setJoinCode("JOIN123");

        User savedAdmin = new User();
        savedAdmin.setId(UUID.randomUUID());
        savedAdmin.setRole(UserRole.ADMIN);

        when(companyService.createCompany("Acme")).thenReturn(company);
        when(passwordEncoder.encode("pw")).thenReturn("enc");
        when(userRepository.save(any(User.class))).thenReturn(savedAdmin);
        when(modelMapper.map(eq(savedAdmin), eq(UserDTO.class))).thenReturn(new UserDTO());

        var response = authService.registerCompany(dto);

        assertNotNull(response);
        assertEquals("Acme", response.getCompanyName());
        assertEquals("JOIN123", response.getJoinCode());
        verify(employeeRepository).save(any());
    }

    @Test
    @DisplayName("register assigns MANAGER role when manager key matches")
    void register_managerKey_assignsManagerRole() {
        UserRegistrationDTO dto = new UserRegistrationDTO();
        dto.setUsername("manager");
        dto.setEmail("m@x.com");
        dto.setPassword("pw");
        dto.setAdminKey("manager-secret");

        Company company = new Company();
        when(userRepository.existsByUsername("manager")).thenReturn(false);
        when(userRepository.existsByEmail("m@x.com")).thenReturn(false);
        when(passwordEncoder.encode("pw")).thenReturn("enc");
        when(companyService.getDefaultCompany()).thenReturn(company);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(modelMapper.map(any(User.class), eq(UserDTO.class))).thenReturn(new UserDTO());

        authService.register(dto);

        verify(userRepository).save(argThat(u -> u.getRole() == UserRole.MANAGER));
        verify(employeeRepository).save(any());
    }

    @Test
    @DisplayName("register uses company join code when provided")
    void register_withCompanyCode_usesFindByJoinCode() {
        UserRegistrationDTO dto = new UserRegistrationDTO();
        dto.setUsername("user2");
        dto.setEmail("u2@x.com");
        dto.setPassword("pw");
        dto.setCompanyCode("JOIN123");

        Company company = new Company();
        when(userRepository.existsByUsername("user2")).thenReturn(false);
        when(userRepository.existsByEmail("u2@x.com")).thenReturn(false);
        when(passwordEncoder.encode("pw")).thenReturn("enc");
        when(companyService.findByJoinCode("JOIN123")).thenReturn(company);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(modelMapper.map(any(User.class), eq(UserDTO.class))).thenReturn(new UserDTO());

        authService.register(dto);

        verify(companyService).findByJoinCode("JOIN123");
        verify(companyService, never()).getDefaultCompany();
    }
}

