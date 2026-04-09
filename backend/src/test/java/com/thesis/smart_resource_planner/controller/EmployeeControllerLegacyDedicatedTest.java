package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.EmployeeCreateDTO;
import com.thesis.smart_resource_planner.model.dto.EmployeeDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.EmployeeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("EmployeeController Tests")
class EmployeeControllerLegacyDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private EmployeeService employeeService;

    @MockBean
    private EmployeeRepository employeeRepository;

    private EmployeeDTO testEmployeeDTO;
    private EmployeeCreateDTO createDTO;
    private UUID employeeId;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        employeeId = UUID.randomUUID();
        testEmployeeDTO = new EmployeeDTO();
        testEmployeeDTO.setId(employeeId);
        testEmployeeDTO.setFirstName("John");
        testEmployeeDTO.setLastName("Doe");

        UUID userId = UUID.randomUUID();
        createDTO = EmployeeCreateDTO.builder()
                .userId(userId)
                .firstName("John")
                .lastName("Doe")
                .department("Engineering")
                .build();

        Company company = new Company();
        company.setId(UUID.randomUUID());
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setUsername("admin");
        u.setEmail("admin@example.com");
        u.setPasswordHash("hash");
        u.setRole(UserRole.ADMIN);
        u.setCompany(company);
        principal = UserPrincipal.create(u);
    }

    @Test
    @DisplayName("Should retrieve employee by ID with status 200")
    void testGetEmployeeById_Success() throws Exception {
        when(employeeService.getEmployeeById(employeeId)).thenReturn(testEmployeeDTO);

        mockMvc.perform(get("/api/employees/{id}", employeeId)
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(employeeId.toString()))
                .andExpect(jsonPath("$.firstName").value("John"));

        verify(employeeService, times(1)).getEmployeeById(employeeId);
    }

    @Test
    @DisplayName("Should retrieve all employees with status 200")
    void testGetAllEmployees_Success() throws Exception {
        when(employeeService.getAllEmployees(any(UUID.class))).thenReturn(Arrays.asList(testEmployeeDTO));

        mockMvc.perform(get("/api/employees")
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        verify(employeeService, times(1)).getAllEmployees(any(UUID.class));
    }

    @Test
    @DisplayName("Should create employee with status 201")
    void testCreateEmployee_Success() throws Exception {
        when(employeeService.createEmployee(any(EmployeeCreateDTO.class))).thenReturn(testEmployeeDTO);

        mockMvc.perform(post("/api/employees")
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createDTO)))
                .andExpect(status().isCreated());

        verify(employeeService, times(1)).createEmployee(any(EmployeeCreateDTO.class));
    }

    @Test
    @DisplayName("Should update employee with status 200")
    void testUpdateEmployee_Success() throws Exception {
        Employee existing = new Employee();
        existing.setId(employeeId);
        User existingUser = new User();
        existingUser.setId(UUID.randomUUID());
        existing.setUser(existingUser);
        when(employeeRepository.findById(employeeId)).thenReturn(java.util.Optional.of(existing));

        when(employeeService.updateEmployee(eq(employeeId), any(EmployeeCreateDTO.class))).thenReturn(testEmployeeDTO);

        mockMvc.perform(put("/api/employees/{id}", employeeId)
                .with(user(principal))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createDTO)))
                .andExpect(status().isOk());

        verify(employeeService, times(1)).updateEmployee(eq(employeeId), any(EmployeeCreateDTO.class));
    }

    @Test
    @DisplayName("Should delete employee with status 204")
    void testDeleteEmployee_Success() throws Exception {
        doNothing().when(employeeService).deleteEmployee(employeeId);

        mockMvc.perform(delete("/api/employees/{id}", employeeId).with(user(principal)))
                .andExpect(status().isNoContent());

        verify(employeeService, times(1)).deleteEmployee(employeeId);
    }
}
