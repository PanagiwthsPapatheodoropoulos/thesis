// src/main/java/com/thesis/smart_resource_planner/service/AuthService.java
package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.UserRepository;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.LocalDate;


/**
 * Service class responsible for user and company authentication and
 * registration.
 * Handles login, token generation, user creation, and company setup logic.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AuthService {

    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final ModelMapper modelMapper;
    private final CompanyService companyService;

    @Value("${ADMIN_KEY_SECRET}")
    private String ADMIN_KEY;

    @Value("${MANAGER_KEY_SECRET}")
    private String MANAGER_KEY;

    /**
     * Authenticates a user and generates a JWT token.
     *
     * @param loginRequest DTO containing username/email and password.
     * @return LoginResponseDTO containing the JWT token and user details.
     */
    public LoginResponseDTO login(LoginRequestDTO loginRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        loginRequest.getUsernameOrEmail(),
                        loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        String token = tokenProvider.generateToken(authentication);

        User user = userRepository.findByUsernameOrEmail(
                loginRequest.getUsernameOrEmail(),
                loginRequest.getUsernameOrEmail()).orElseThrow(() -> new ResourceNotFoundException("User not found"));

        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        UserDTO userDTO = modelMapper.map(user, UserDTO.class);

        return LoginResponseDTO.builder()
                .token(token)
                .tokenType("Bearer")
                .user(userDTO)
                .build();
    }

    /**
     * Registers a new company along with its initial admin user and employee
     * profile.
     *
     * @param dto DTO containing company and admin details.
     * @return CompanyRegistrationResponseDTO with company info and join code.
     */
    @Transactional
    public CompanyRegistrationResponseDTO registerCompany(CompanyRegistrationDTO dto) {
        // 1. Create company
        Company company = companyService.createCompany(dto.getCompanyName());

        // 2. Create admin user
        User admin = new User();
        admin.setUsername(dto.getAdminUsername());
        admin.setEmail(dto.getAdminEmail());
        admin.setPasswordHash(passwordEncoder.encode(dto.getAdminPassword()));
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);
        admin.setIsActive(true);

        User savedAdmin = userRepository.save(admin);

        // 3. Auto-create employee profile for admin
        try {
            Employee adminEmployee = Employee.builder()
                    .user(savedAdmin)
                    .firstName(dto.getAdminUsername())
                    .lastName("Admin")
                    .position("Administrator")
                    .department("Administration")
                    .hireDate(LocalDate.now())
                    .maxWeeklyHours(40)
                    .timezone("UTC")
                    .build();

            employeeRepository.save(adminEmployee);
        } catch (Exception e) {
            log.warn("Failed to create admin employee profile: {}", e.getMessage());
        }

        return CompanyRegistrationResponseDTO.builder()
                .companyId(company.getId())
                .companyName(company.getName())
                .joinCode(company.getJoinCode())
                .adminUser(modelMapper.map(savedAdmin, UserDTO.class))
                .message("Company created successfully! Share the join code with employees.")
                .build();
    }

    /**
     * Registers a new regular user or manager within an existing or default
     * company.
     * Automatically creates an employee profile if the elevated permissions are
     * provided via keys.
     *
     * @param registrationDTO DTO containing user registration details and optional
     *                        admin key/company code.
     * @return UserDTO representing the newly created user.
     */
    @Transactional
    public UserDTO register(UserRegistrationDTO registrationDTO) {
        if (userRepository.existsByUsername(registrationDTO.getUsername())) {
            throw new DuplicateResourceException("Username already exists");
        }

        if (userRepository.existsByEmail(registrationDTO.getEmail())) {
            throw new DuplicateResourceException("Email already exists");
        }

        // DETERMINE COMPANY
        Company company;
        if (StringUtils.hasText(registrationDTO.getCompanyCode())) {
            // Join existing company
            company = companyService.findByJoinCode(registrationDTO.getCompanyCode());
        } else {
            // Assign to default company
            company = companyService.getDefaultCompany();
        }

        User user = new User();
        user.setUsername(registrationDTO.getUsername());
        user.setEmail(registrationDTO.getEmail());
        user.setPasswordHash(passwordEncoder.encode(registrationDTO.getPassword()));
        user.setCompany(company); // SET COMPANY

        // DEFAULT ROLE IS USER
        UserRole role = UserRole.USER;

        // Check admin key for elevated permissions
        if (registrationDTO.getAdminKey() != null && !registrationDTO.getAdminKey().isEmpty()) {
            if (ADMIN_KEY.equals(registrationDTO.getAdminKey())) {
                role = UserRole.ADMIN;
            } else if (MANAGER_KEY.equals(registrationDTO.getAdminKey())) {
                role = UserRole.MANAGER;
            } else {
                throw new IllegalArgumentException("Invalid admin key");
            }
        }

        user.setRole(role);
        user.setIsActive(true);
        user.setTeam(null);

        User savedUser = userRepository.save(user);

        // Auto-create employee profile for ADMIN and MANAGER
        if (role == UserRole.ADMIN || role == UserRole.MANAGER) {
            try {
                Employee employee = Employee.builder()
                        .user(savedUser)
                        .firstName(savedUser.getUsername())
                        .lastName(role.toString())
                        .position(role == UserRole.ADMIN ? "Administrator" : "Manager")
                        .department(role == UserRole.ADMIN ? "Administration" : "Management")
                        .hireDate(LocalDate.now())
                        .maxWeeklyHours(40)
                        .timezone("UTC")
                        .build();

                employeeRepository.save(employee);
            } catch (Exception e) {
                log.error("Failed to auto-create employee profile: {}", e.getMessage());
            }
        }

        return modelMapper.map(savedUser, UserDTO.class);
    }

}