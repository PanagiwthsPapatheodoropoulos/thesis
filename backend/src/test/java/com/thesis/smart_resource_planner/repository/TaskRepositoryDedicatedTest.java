package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.enums.TaskStatus;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@ActiveProfiles("test")
@DisplayName("TaskRepository Tests")
class TaskRepositoryTest {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CompanyRepository companyRepository;

    private Task testTask;
    private Company savedCompany;
    private User savedUser;

    @BeforeEach
    void setUp() {
        Company company = Company.builder()
                .name("Task Co")
                .joinCode("TASK01")
                .subscriptionTier("BASIC")
                .isActive(true)
                .build();
        savedCompany = companyRepository.save(company);

        User user = new User();
        user.setUsername("creator_" + UUID.randomUUID());
        user.setEmail("creator_" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash_" + UUID.randomUUID());
        user.setRole(UserRole.MANAGER);
        user.setCompany(savedCompany);
        savedUser = userRepository.save(user);

        testTask = new Task();
        testTask.setTitle("Test Task");
        testTask.setDescription("Task Description");
        testTask.setStatus(TaskStatus.PENDING);
        testTask.setCompany(savedCompany);
        testTask.setCreatedBy(savedUser);
        testTask.setDueDate(LocalDateTime.now().plusDays(5));
    }

    @Test
    @DisplayName("Should save task successfully")
    void testSaveTask_Success() {
        Task savedTask = taskRepository.save(testTask);

        assertNotNull(savedTask);
        assertEquals(testTask.getTitle(), savedTask.getTitle());
        assertEquals(testTask.getStatus(), savedTask.getStatus());
    }

    @Test
    @DisplayName("Should find task by ID")
    void testFindById_Success() {
        Task saved = taskRepository.save(testTask);
        Optional<Task> foundTask = taskRepository.findById(saved.getId());

        assertTrue(foundTask.isPresent());
        assertEquals(testTask.getTitle(), foundTask.get().getTitle());
    }

    @Test
    @DisplayName("Should find tasks by status")
    void testFindByStatus_Success() {
        taskRepository.save(testTask);
        List<Task> tasks = taskRepository.findByStatus(TaskStatus.PENDING);

        assertFalse(tasks.isEmpty());
        assertTrue(tasks.stream().anyMatch(t -> t.getTitle().equals("Test Task")));
    }

    @Test
    @DisplayName("Should find tasks with due date before today")
    void testFindByDueDateBefore_Success() {
        testTask.setDueDate(LocalDateTime.now().minusDays(1));
        testTask.setStatus(TaskStatus.PENDING);
        taskRepository.save(testTask);

        List<Task> overdueTasks = taskRepository.findOverdueTasks(TaskStatus.PENDING, LocalDateTime.now());

        assertFalse(overdueTasks.isEmpty());
        assertTrue(overdueTasks.stream().anyMatch(t -> t.getTitle().equals("Test Task")));
    }

    @Test
    @DisplayName("Should delete task successfully")
    void testDeleteTask_Success() {
        Task saved = taskRepository.save(testTask);
        taskRepository.deleteById(saved.getId());
        Optional<Task> foundTask = taskRepository.findById(saved.getId());

        assertTrue(foundTask.isEmpty());
    }

    @Test
    @DisplayName("Should return empty when task not found")
    void testFindById_NotFound() {
        Optional<Task> foundTask = taskRepository.findById(UUID.randomUUID());

        assertTrue(foundTask.isEmpty());
    }

    @Test
    @DisplayName("Should find all tasks")
    void testFindAll_Success() {
        taskRepository.save(testTask);
        List<Task> tasks = taskRepository.findAll();

        assertFalse(tasks.isEmpty());
    }
}
