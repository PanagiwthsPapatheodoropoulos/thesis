package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@ActiveProfiles("test")
@DisplayName("UserRepository Tests")
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash("encodedPassword");
        testUser.setRole(UserRole.EMPLOYEE);
    }

    @Test
    @DisplayName("Should save user successfully")
    void testSaveUser_Success() {
        User savedUser = userRepository.save(testUser);

        assertNotNull(savedUser);
        assertEquals(testUser.getUsername(), savedUser.getUsername());
        assertEquals(testUser.getEmail(), savedUser.getEmail());
    }

    @Test
    @DisplayName("Should find user by ID")
    void testFindById_Success() {
        User saved = userRepository.save(testUser);
        Optional<User> foundUser = userRepository.findById(saved.getId());

        assertTrue(foundUser.isPresent());
        assertEquals(testUser.getUsername(), foundUser.get().getUsername());
    }

    @Test
    @DisplayName("Should find user by username")
    void testFindByUsername_Success() {
        userRepository.save(testUser);
        Optional<User> foundUser = userRepository.findByUsername("testuser");

        assertTrue(foundUser.isPresent());
        assertEquals(testUser.getEmail(), foundUser.get().getEmail());
    }

    @Test
    @DisplayName("Should find user by email")
    void testFindByEmail_Success() {
        userRepository.save(testUser);
        Optional<User> foundUser = userRepository.findByEmail("test@example.com");

        assertTrue(foundUser.isPresent());
        assertEquals(testUser.getUsername(), foundUser.get().getUsername());
    }

    @Test
    @DisplayName("Should find user by username or email")
    void testFindByUsernameOrEmail_Success() {
        userRepository.save(testUser);
        Optional<User> foundUser = userRepository.findByUsernameOrEmail("testuser", "test@example.com");

        assertTrue(foundUser.isPresent());
        assertEquals("testuser", foundUser.get().getUsername());
    }

    @Test
    @DisplayName("Should find users by role")
    void testFindByRole_Success() {
        userRepository.save(testUser);
        List<User> users = userRepository.findByRole(UserRole.EMPLOYEE);

        assertFalse(users.isEmpty());
        assertTrue(users.stream().anyMatch(u -> u.getUsername().equals("testuser")));
    }

    @Test
    @DisplayName("Should check if username exists")
    void testExistsByUsername_Success() {
        userRepository.save(testUser);
        boolean exists = userRepository.existsByUsername("testuser");

        assertTrue(exists);
    }

    @Test
    @DisplayName("Should check if email exists")
    void testExistsByEmail_Success() {
        userRepository.save(testUser);
        boolean exists = userRepository.existsByEmail("test@example.com");

        assertTrue(exists);
    }

    @Test
    @DisplayName("Should delete user successfully")
    void testDeleteUser_Success() {
        User saved = userRepository.save(testUser);
        userRepository.deleteById(saved.getId());
        Optional<User> foundUser = userRepository.findById(saved.getId());

        assertTrue(foundUser.isEmpty());
    }

    @Test
    @DisplayName("Should return empty when user not found")
    void testFindById_NotFound() {
        Optional<User> foundUser = userRepository.findById(UUID.randomUUID());

        assertTrue(foundUser.isEmpty());
    }
}
