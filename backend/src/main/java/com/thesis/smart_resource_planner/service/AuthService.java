// src/main/java/com/thesis/smart_resource_planner/service/AuthService.java
package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.BadRequestException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.UserRepository;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.security.JwtTokenProvider;
import com.thesis.smart_resource_planner.enums.NotificationType;
import com.thesis.smart_resource_planner.enums.NotificationSeverity;
import com.thesis.smart_resource_planner.enums.EntityType;
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
import com.thesis.smart_resource_planner.model.enums.UserStatus;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.List;


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
    private final NotificationService notificationService;
    private final BrevoEmailService brevoEmailService;
    private final CompanyBlocklistService blocklistService;
    private final com.thesis.smart_resource_planner.service.WebSocketBroadcastService webSocketBroadcastService;

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
        user.setStatus(UserStatus.ONLINE);
        userRepository.save(user);

        // Notify others
        if (webSocketBroadcastService != null) {
            webSocketBroadcastService.broadcastUserPresence(user.getId(), UserStatus.ONLINE);
        }

        // Generate refresh token for seamless session renewal
        String refreshToken = tokenProvider.generateRefreshToken(user.getUsername());

        UserDTO userDTO = modelMapper.map(user, UserDTO.class);

        return LoginResponseDTO.builder()
                .token(token)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .user(userDTO)
                .build();
    }

    public void logout(java.util.UUID userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setStatus(UserStatus.OFFLINE);
        userRepository.save(user);
        if (webSocketBroadcastService != null) {
            webSocketBroadcastService.broadcastUserPresence(user.getId(), UserStatus.OFFLINE);
        }
    }

    /**
     * Registers a new company along with its initial admin user and employee
     * profile. Sends a welcome email with the join code via Brevo.
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
        admin.setStatus(UserStatus.OFFLINE);

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

        // 4. Send welcome email with join code via Brevo (async, non-blocking)
        try {
            brevoEmailService.sendCompanyWelcomeEmail(
                    dto.getAdminEmail(),
                    dto.getAdminUsername(),
                    company.getName(),
                    company.getJoinCode());
        } catch (Exception e) {
            log.warn("Failed to send company welcome email: {}", e.getMessage());
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
     * company. Checks the company blocklist before allowing registration.
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

            // Check if email is blocked from this company
            if (blocklistService.isBlocked(company.getId(), registrationDTO.getEmail())) {
                throw new BadRequestException("Your email address has been blocked from joining this company.");
            }
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
        user.setStatus(UserStatus.OFFLINE);
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
        } else if (role == UserRole.USER && StringUtils.hasText(registrationDTO.getCompanyCode())) {
            // Send JOIN_REQUEST notification to Admins and Managers
            try {
                List<User> adminsAndManagers = userRepository.findByRoleAndCompanyId(UserRole.ADMIN, company.getId());
                adminsAndManagers.addAll(userRepository.findByRoleAndCompanyId(UserRole.MANAGER, company.getId()));

                for (User adminOrManager : adminsAndManagers) {
                    NotificationCreateDTO notification = new NotificationCreateDTO();
                    notification.setUserId(adminOrManager.getId());
                    notification.setType(NotificationType.JOIN_REQUEST);
                    notification.setTitle("🔔 New Join Request");
                    notification.setMessage(String.format(
                            "User '%s' (%s) is waiting for approval to join your company. Review their request in the Employees page.",
                            savedUser.getUsername(), savedUser.getEmail()));
                    notification.setSeverity(NotificationSeverity.INFO);
                    notification.setRelatedEntityType(EntityType.EMPLOYEE);

                    notificationService.createNotification(notification);
                }
            } catch (Exception e) {
                log.error("Failed to send join request notification: {}", e.getMessage());
            }

            // Send confirmation email to the user
            try {
                brevoEmailService.sendJoinRequestConfirmation(
                        savedUser.getEmail(),
                        savedUser.getUsername(),
                        company.getName());
            } catch (Exception e) {
                log.warn("Failed to send join request confirmation email: {}", e.getMessage());
            }
        }

        return modelMapper.map(savedUser, UserDTO.class);
    }

}
