package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.CompanyService;
import com.thesis.smart_resource_planner.service.SuperAdminService;
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
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("SuperAdminController Dedicated Tests")
@SuppressWarnings("removal")
class SuperAdminControllerDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CompanyService companyService;

    @MockBean
    private SuperAdminService superAdminService;

    private CompanyDTO testCompanyDTO;
    private UserPrincipal superAdminPrincipal;
    private UserPrincipal employeePrincipal;
    private UUID superAdminUserId;
    private UUID employeeUserId;
    private UUID companyId;

    @BeforeEach
    void setUp() {
        companyId = UUID.randomUUID();
        superAdminUserId = UUID.randomUUID();
        employeeUserId = UUID.randomUUID();

        testCompanyDTO = new CompanyDTO();
        testCompanyDTO.setId(companyId);
        testCompanyDTO.setName("Global Corp");
        testCompanyDTO.setIsActive(true);

        Company company = new Company();
        company.setId(UUID.randomUUID());

        // Super Admin User
        User superAdmin = new User();
        superAdmin.setId(superAdminUserId);
        superAdmin.setUsername("superAdminUser");
        superAdmin.setEmail("super@example.com");
        superAdmin.setRole(UserRole.SUPER_ADMIN);
        superAdmin.setCompany(company);
        superAdminPrincipal = UserPrincipal.create(superAdmin);

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
    @DisplayName("Should return 403 Forbidden when non-SUPER_ADMIN attempts access")
    void testAccessDenied_NonSuperAdmin() throws Exception {
        mockMvc.perform(get("/api/super-admin/companies")
                        .with(user(employeePrincipal)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Should retrieve all companies successfully")
    void testGetAllCompanies_Success() throws Exception {
        when(superAdminService.getAllCompanies()).thenReturn(Arrays.asList(testCompanyDTO));

        mockMvc.perform(get("/api/super-admin/companies")
                        .with(user(superAdminPrincipal))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Global Corp"));

        verify(superAdminService, times(1)).getAllCompanies();
    }

    @Test
    @DisplayName("Should retrieve company by ID successfully")
    void testGetCompanyById_Success() throws Exception {
        when(superAdminService.getCompanyById(companyId)).thenReturn(testCompanyDTO);

        mockMvc.perform(get("/api/super-admin/companies/{companyId}", companyId)
                        .with(user(superAdminPrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Global Corp"));

        verify(superAdminService, times(1)).getCompanyById(companyId);
    }

    @Test
    @DisplayName("Should delete company successfully")
    void testDeleteCompany_Success() throws Exception {
        doNothing().when(companyService).deleteCompany(companyId);

        mockMvc.perform(delete("/api/super-admin/companies/{companyId}", companyId)
                        .with(user(superAdminPrincipal)))
                .andExpect(status().isNoContent());

        verify(companyService, times(1)).deleteCompany(companyId);
    }

    @Test
    @DisplayName("Should toggle company active state successfully")
    void testToggleCompanyActive_Success() throws Exception {
        when(superAdminService.toggleCompanyActive(companyId)).thenReturn(testCompanyDTO);

        mockMvc.perform(patch("/api/super-admin/companies/{companyId}/toggle-active", companyId)
                        .with(user(superAdminPrincipal)))
                .andExpect(status().isOk());

        verify(superAdminService, times(1)).toggleCompanyActive(companyId);
    }

    @Test
    @DisplayName("Should retrieve company users successfully")
    void testGetCompanyUsers_Success() throws Exception {
        UserDTO userDTO = new UserDTO();
        userDTO.setId(UUID.randomUUID());
        userDTO.setUsername("john_doe");

        when(superAdminService.getUsersByCompany(companyId)).thenReturn(Arrays.asList(userDTO));

        mockMvc.perform(get("/api/super-admin/companies/{companyId}/users", companyId)
                        .with(user(superAdminPrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value("john_doe"));

        verify(superAdminService, times(1)).getUsersByCompany(companyId);
    }

    @Test
    @DisplayName("Should retrieve company tasks successfully")
    void testGetCompanyTasks_Success() throws Exception {
        TaskDTO taskDTO = new TaskDTO();
        taskDTO.setId(UUID.randomUUID());
        taskDTO.setTitle("Test Task");

        when(superAdminService.getTasksByCompany(companyId)).thenReturn(Arrays.asList(taskDTO));

        mockMvc.perform(get("/api/super-admin/companies/{companyId}/tasks", companyId)
                        .with(user(superAdminPrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Test Task"));

        verify(superAdminService, times(1)).getTasksByCompany(companyId);
    }

    @Test
    @DisplayName("Should retrieve company employees successfully")
    void testGetCompanyEmployees_Success() throws Exception {
        EmployeeDTO employeeDTO = new EmployeeDTO();
        employeeDTO.setId(UUID.randomUUID());
        employeeDTO.setFirstName("Jane");

        when(superAdminService.getEmployeesByCompany(companyId)).thenReturn(Arrays.asList(employeeDTO));

        mockMvc.perform(get("/api/super-admin/companies/{companyId}/employees", companyId)
                        .with(user(superAdminPrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].firstName").value("Jane"));

        verify(superAdminService, times(1)).getEmployeesByCompany(companyId);
    }

    @Test
    @DisplayName("Should retrieve company departments successfully")
    void testGetCompanyDepartments_Success() throws Exception {
        DepartmentDTO deptDTO = new DepartmentDTO();
        deptDTO.setName("Sales");

        when(superAdminService.getDepartmentsByCompany(companyId)).thenReturn(Arrays.asList(deptDTO));

        mockMvc.perform(get("/api/super-admin/companies/{companyId}/departments", companyId)
                        .with(user(superAdminPrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Sales"));

        verify(superAdminService, times(1)).getDepartmentsByCompany(companyId);
    }

    @Test
    @DisplayName("Should retrieve company teams successfully")
    void testGetCompanyTeams_Success() throws Exception {
        TeamDTO teamDTO = new TeamDTO();
        teamDTO.setName("Support");

        when(superAdminService.getTeamsByCompany(companyId)).thenReturn(Arrays.asList(teamDTO));

        mockMvc.perform(get("/api/super-admin/companies/{companyId}/teams", companyId)
                        .with(user(superAdminPrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Support"));

        verify(superAdminService, times(1)).getTeamsByCompany(companyId);
    }

    @Test
    @DisplayName("Should retrieve system statistics successfully")
    void testGetSystemStatistics_Success() throws Exception {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalCompanies", 5);

        when(superAdminService.getSystemStatistics()).thenReturn(stats);

        mockMvc.perform(get("/api/super-admin/statistics")
                        .with(user(superAdminPrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCompanies").value(5));

        verify(superAdminService, times(1)).getSystemStatistics();
    }

    @Test
    @DisplayName("Should retrieve company statistics successfully")
    void testGetCompanyStatistics_Success() throws Exception {
        Map<String, Object> stats = new HashMap<>();
        stats.put("activeTasks", 10);

        when(superAdminService.getCompanyStatistics(companyId)).thenReturn(stats);

        mockMvc.perform(get("/api/super-admin/companies/{companyId}/statistics", companyId)
                        .with(user(superAdminPrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeTasks").value(10));

        verify(superAdminService, times(1)).getCompanyStatistics(companyId);
    }
}
