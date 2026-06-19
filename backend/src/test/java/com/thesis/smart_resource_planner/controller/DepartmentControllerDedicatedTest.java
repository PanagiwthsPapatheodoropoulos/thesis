package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.DepartmentCreateDTO;
import com.thesis.smart_resource_planner.model.dto.DepartmentDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.DepartmentService;
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
import java.util.Optional;
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
@DisplayName("DepartmentController Dedicated Tests")
@SuppressWarnings("removal")
class DepartmentControllerDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DepartmentService departmentService;

    @MockBean
    private EmployeeRepository employeeRepository;

    private DepartmentDTO testDeptDTO;
    private DepartmentCreateDTO createDTO;
    private UserPrincipal adminPrincipal;
    private UserPrincipal employeePrincipal;
    private UUID adminUserId;
    private UUID employeeUserId;

    @BeforeEach
    void setUp() {
        adminUserId = UUID.randomUUID();
        employeeUserId = UUID.randomUUID();

        testDeptDTO = new DepartmentDTO();
        testDeptDTO.setName("Engineering");
        testDeptDTO.setDescription("Engineering Department");
        testDeptDTO.setDevInfoEnabled(true);

        createDTO = new DepartmentCreateDTO();
        createDTO.setName("Engineering");
        createDTO.setDescription("Engineering Department");

        Company company = new Company();
        company.setId(UUID.randomUUID());

        // Admin User
        User admin = new User();
        admin.setId(adminUserId);
        admin.setUsername("adminUser");
        admin.setEmail("admin@example.com");
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);
        adminPrincipal = UserPrincipal.create(admin);

        // Employee User
        User employee = new User();
        employee.setId(employeeUserId);
        employee.setUsername("employeeUser");
        employee.setEmail("emp@example.com");
        employee.setRole(UserRole.EMPLOYEE);
        employee.setCompany(company);
        employeePrincipal = UserPrincipal.create(employee);
    }

    @Test
    @DisplayName("Should create department when requesting user is ADMIN")
    void testCreateDepartment_Success() throws Exception {
        when(departmentService.createDepartment(any(DepartmentCreateDTO.class), eq(adminUserId)))
                .thenReturn(testDeptDTO);

        mockMvc.perform(post("/api/departments")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Engineering"))
                .andExpect(jsonPath("$.devInfoEnabled").value(true));

        verify(departmentService, times(1)).createDepartment(any(DepartmentCreateDTO.class), eq(adminUserId));
    }

    @Test
    @DisplayName("Should retrieve all departments as ADMIN")
    void testGetAllDepartments_Admin_Success() throws Exception {
        when(departmentService.getAllDepartments(adminUserId))
                .thenReturn(Arrays.asList(testDeptDTO));

        mockMvc.perform(get("/api/departments")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Engineering"));

        verify(departmentService, times(1)).getAllDepartments(adminUserId);
    }

    @Test
    @DisplayName("Should retrieve user department only as EMPLOYEE")
    void testGetAllDepartments_Employee_Success() throws Exception {
        User u = new User();
        u.setId(employeeUserId);
        Employee emp = new Employee();
        emp.setUser(u);
        emp.setDepartment("Engineering");

        when(employeeRepository.findByUserId(employeeUserId)).thenReturn(Optional.of(emp));
        when(departmentService.getDepartmentByName("Engineering", employeeUserId)).thenReturn(testDeptDTO);


        mockMvc.perform(get("/api/departments")
                        .with(user(employeePrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Engineering"))
                .andExpect(jsonPath("$.length()").value(1));

        verify(employeeRepository, times(1)).findByUserId(employeeUserId);
        verify(departmentService, times(1)).getDepartmentByName("Engineering", employeeUserId);
    }

    @Test
    @DisplayName("Should retrieve department by name")
    void testGetDepartmentByName_Success() throws Exception {
        when(departmentService.getDepartmentByName("Engineering", adminUserId)).thenReturn(testDeptDTO);

        mockMvc.perform(get("/api/departments/{name}", "Engineering")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Engineering"));

        verify(departmentService, times(1)).getDepartmentByName("Engineering", adminUserId);
    }

    @Test
    @DisplayName("Should retrieve department names list")
    void testGetDepartmentNames_Success() throws Exception {
        when(departmentService.getDepartmentNames(adminUserId))
                .thenReturn(Arrays.asList("Engineering", "Marketing"));

        mockMvc.perform(get("/api/departments/list")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("Engineering"))
                .andExpect(jsonPath("$[1]").value("Marketing"));

        verify(departmentService, times(1)).getDepartmentNames(adminUserId);
    }

    @Test
    @DisplayName("Should delete department")
    void testDeleteDepartment_Success() throws Exception {
        doNothing().when(departmentService).deleteDepartment("Engineering", adminUserId);

        mockMvc.perform(delete("/api/departments/{name}", "Engineering")
                        .with(user(adminPrincipal)))
                .andExpect(status().isNoContent());

        verify(departmentService, times(1)).deleteDepartment("Engineering", adminUserId);
    }

    @Test
    @DisplayName("Should toggle dev info enabled state")
    void testToggleDevInfo_Success() throws Exception {
        when(departmentService.toggleDevInfo("Engineering", false, adminUserId))
                .thenReturn(testDeptDTO); // normally returns with false, but returning testDeptDTO is fine for MockMvc status check

        mockMvc.perform(put("/api/departments/{name}/toggle-dev-info", "Engineering")
                        .param("enabled", "false")
                        .with(user(adminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        verify(departmentService, times(1)).toggleDevInfo("Engineering", false, adminUserId);
    }
}
