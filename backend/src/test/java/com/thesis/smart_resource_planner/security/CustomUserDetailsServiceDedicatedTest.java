package com.thesis.smart_resource_planner.security;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("CustomUserDetailsService Tests")
class CustomUserDetailsServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private CustomUserDetailsService userDetailsService;

    private User testUser;
    private UUID userId;
    private final String username = "testuser";

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        testUser = new User();
        testUser.setId(userId);
        testUser.setUsername(username);
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash("encodedPassword");
        testUser.setRole(UserRole.EMPLOYEE);
    }

    @Test
    @DisplayName("Should load user by username/email successfully")
    void testLoadUserByUsername_Success() {
        when(userRepository.findByUsernameOrEmail(username, username)).thenReturn(Optional.of(testUser));

        UserDetails userDetails = userDetailsService.loadUserByUsername(username);

        assertNotNull(userDetails);
        assertEquals(username, userDetails.getUsername());
        verify(userRepository, times(1)).findByUsernameOrEmail(username, username);
    }

    @Test
    @DisplayName("Should throw exception when user not found")
    void testLoadUserByUsername_NotFound() {
        when(userRepository.findByUsernameOrEmail("nonexistent", "nonexistent")).thenReturn(Optional.empty());

        assertThrows(UsernameNotFoundException.class, () -> userDetailsService.loadUserByUsername("nonexistent"));
        verify(userRepository, times(1)).findByUsernameOrEmail("nonexistent", "nonexistent");
    }

    @Test
    @DisplayName("Should load user by id successfully")
    void testLoadUserById_Success() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));

        UserDetails userDetails = userDetailsService.loadUserById(userId);

        assertNotNull(userDetails);
        assertEquals(username, userDetails.getUsername());
        verify(userRepository, times(1)).findById(userId);
    }
}
