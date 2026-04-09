package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
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
@DisplayName("EmployeeRepository Tests")
class EmployeeRepositoryTest {

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CompanyRepository companyRepository;

    private Employee testEmployee;
    private User savedUser;

    @BeforeEach
    void setUp() {
        Company company = Company.builder()
                .name("Test Co")
                .joinCode("ABC123")
                .subscriptionTier("BASIC")
                .isActive(true)
                .build();
        Company savedCompany = companyRepository.save(company);

        User user = new User();
        user.setUsername("testuser_" + UUID.randomUUID());
        user.setEmail("test_" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash_" + UUID.randomUUID());
        user.setRole(UserRole.EMPLOYEE);
        user.setCompany(savedCompany);
        savedUser = userRepository.save(user);

        testEmployee = new Employee();
        testEmployee.setUser(savedUser);
        testEmployee.setFirstName("John");
        testEmployee.setLastName("Doe");
        testEmployee.setPosition("Senior Developer");
    }

    @Test
    @DisplayName("Should save employee successfully")
    void testSaveEmployee_Success() {
        Employee savedEmployee = employeeRepository.save(testEmployee);

        assertNotNull(savedEmployee);
        assertEquals(testEmployee.getFirstName(), savedEmployee.getFirstName());
        assertEquals(testEmployee.getLastName(), savedEmployee.getLastName());
    }

    @Test
    @DisplayName("Should find employee by ID")
    void testFindById_Success() {
        Employee saved = employeeRepository.save(testEmployee);
        Optional<Employee> foundEmployee = employeeRepository.findById(saved.getId());

        assertTrue(foundEmployee.isPresent());
        assertEquals(testEmployee.getFirstName(), foundEmployee.get().getFirstName());
    }

    @Test
    @DisplayName("Should find all employees")
    void testFindAll_Success() {
        employeeRepository.save(testEmployee);
        List<Employee> employees = employeeRepository.findAll();

        assertFalse(employees.isEmpty());
    }

    @Test
    @DisplayName("Should delete employee successfully")
    void testDeleteEmployee_Success() {
        Employee saved = employeeRepository.save(testEmployee);
        employeeRepository.deleteById(saved.getId());
        Optional<Employee> foundEmployee = employeeRepository.findById(saved.getId());

        assertTrue(foundEmployee.isEmpty());
    }

    @Test
    @DisplayName("Should return empty when employee not found")
    void testFindById_NotFound() {
        Optional<Employee> foundEmployee = employeeRepository.findById(UUID.randomUUID());

        assertTrue(foundEmployee.isEmpty());
    }
}
