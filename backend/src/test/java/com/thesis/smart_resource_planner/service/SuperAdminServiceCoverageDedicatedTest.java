package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.TaskAssignmentStatus;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("SuperAdminService Coverage - Gap Tests")
class SuperAdminServiceCoverageDedicatedTest {

    @Mock private CompanyRepository companyRepository;
    @Mock private UserRepository userRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private ModelMapper modelMapper;
    @Mock private EmployeeSkillRepository employeeSkillRepository;

    @InjectMocks private SuperAdminService superAdminService;

    private UUID companyId;
    private Company company;

    @BeforeEach
    void setUp() {
        companyId = UUID.randomUUID();
        company = new Company();
        company.setId(companyId);
        company.setName("TestCo");
        company.setIsActive(true);
    }

    @Test
    @DisplayName("getCompanyById returns populated DTO with counts")
    void getCompanyById_returnsDtoWithCounts() {
        CompanyDTO dto = new CompanyDTO();
        when(companyRepository.findById(companyId)).thenReturn(Optional.of(company));
        when(modelMapper.map(company, CompanyDTO.class)).thenReturn(dto);
        when(employeeRepository.countEmployeesByCompanyIdForDashboard(companyId)).thenReturn(5L);
        when(departmentRepository.findByCompanyId(companyId)).thenReturn(List.of(new Department(), new Department()));
        when(teamRepository.findByCompanyId(companyId)).thenReturn(List.of(new Team()));

        CompanyDTO result = superAdminService.getCompanyById(companyId);
        assertEquals(5, result.getEmployeeCount());
        assertEquals(2, result.getDepartmentCount());
        assertEquals(1, result.getTeamCount());
    }

    @Test
    @DisplayName("getCompanyById throws when company not found")
    void getCompanyById_throws() {
        UUID missing = UUID.randomUUID();
        when(companyRepository.findById(missing)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> superAdminService.getCompanyById(missing));
    }

    @Test
    @DisplayName("toggleCompanyActive throws when company not found")
    void toggleCompanyActive_throws() {
        UUID missing = UUID.randomUUID();
        when(companyRepository.findById(missing)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> superAdminService.toggleCompanyActive(missing));
    }

    @Test
    @DisplayName("getTasksByCompany throws when company not found")
    void getTasksByCompany_companyNotFound_throws() {
        when(companyRepository.existsById(companyId)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> superAdminService.getTasksByCompany(companyId));
    }

    @Test
    @DisplayName("getTasksByCompany maps tasks with team and creator info")
    void getTasksByCompany_mapsTeamAndCreator() {
        when(companyRepository.existsById(companyId)).thenReturn(true);

        Team team = new Team();
        team.setId(UUID.randomUUID());
        team.setName("Alpha");

        User creator = new User();
        creator.setId(UUID.randomUUID());
        creator.setUsername("john");

        Employee emp = new Employee();
        emp.setId(UUID.randomUUID());
        emp.setFirstName("Jane");
        emp.setLastName("Doe");

        TaskAssignment assignment = new TaskAssignment();
        assignment.setId(UUID.randomUUID());
        assignment.setEmployee(emp);
        assignment.setStatus(TaskAssignmentStatus.ACCEPTED);

        Skill skill = new Skill();
        skill.setId(UUID.randomUUID());
        TaskRequiredSkill trs = TaskRequiredSkill.builder().skill(skill).build();

        Task task = new Task();
        task.setId(UUID.randomUUID());
        task.setTitle("Task with data");
        task.setTeam(team);
        task.setCreatedBy(creator);
        task.setRequiredSkills(List.of(trs));
        task.setAssignments(List.of(assignment));
        task.setIsArchived(true);
        task.setIsEmployeeRequest(true);
        task.setRequiresApproval(true);

        when(taskRepository.findByCompanyId(companyId)).thenReturn(List.of(task));

        List<TaskDTO> result = superAdminService.getTasksByCompany(companyId);
        assertEquals(1, result.size());
        assertEquals("Alpha", result.get(0).getTeamName());
        assertEquals("john", result.get(0).getCreatedByName());
        assertEquals(1, result.get(0).getRequiredSkillIds().size());
        assertEquals(1, result.get(0).getAssignments().size());
        assertTrue(result.get(0).getIsArchived());
    }

    @Test
    @DisplayName("getEmployeesByCompany returns empty skills for employee without skills")
    void getEmployeesByCompany_emptySkills() {
        when(companyRepository.existsById(companyId)).thenReturn(true);

        User user = new User();
        user.setId(UUID.randomUUID());
        Employee employee = new Employee();
        employee.setId(UUID.randomUUID());
        employee.setUser(user);
        employee.setFirstName("Al");
        employee.setLastName("B");

        when(employeeRepository.findEmployeesByCompanyIdForDashboard(companyId)).thenReturn(List.of(employee));
        when(employeeSkillRepository.findByEmployeeIdIn(anyList())).thenReturn(List.of());

        List<EmployeeDTO> result = superAdminService.getEmployeesByCompany(companyId);
        assertEquals(1, result.size());
        assertTrue(result.get(0).getSkills().isEmpty());
    }

    @Test
    @DisplayName("getEmployeesByCompany throws when company not found")
    void getEmployeesByCompany_companyNotFound_throws() {
        when(companyRepository.existsById(companyId)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> superAdminService.getEmployeesByCompany(companyId));
    }

    @Test
    @DisplayName("getDepartmentsByCompany throws when company not found")
    void getDepartmentsByCompany_companyNotFound_throws() {
        when(companyRepository.existsById(companyId)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> superAdminService.getDepartmentsByCompany(companyId));
    }

    @Test
    @DisplayName("getTeamsByCompany throws when company not found")
    void getTeamsByCompany_companyNotFound_throws() {
        when(companyRepository.existsById(companyId)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> superAdminService.getTeamsByCompany(companyId));
    }

    @Test
    @DisplayName("getSystemStatistics counts inactive companies")
    void getSystemStatistics_countsInactive() {
        Company inactive = new Company();
        inactive.setId(UUID.randomUUID());
        inactive.setIsActive(false);

        when(companyRepository.findAll()).thenReturn(List.of(company, inactive));
        when(userRepository.countByCompanyId(any(UUID.class))).thenReturn(0L);
        when(employeeRepository.countEmployeesByCompanyIdForDashboard(any(UUID.class))).thenReturn(0L);
        when(taskRepository.findByCompanyId(any(UUID.class))).thenReturn(List.of());
        when(departmentRepository.findByCompanyId(any(UUID.class))).thenReturn(List.of());
        when(teamRepository.findByCompanyId(any(UUID.class))).thenReturn(List.of());

        Map<String, Object> stats = superAdminService.getSystemStatistics();
        assertEquals(2, stats.get("totalCompanies"));
        assertEquals(1L, stats.get("activeCompanies"));
        assertEquals(1L, stats.get("inactiveCompanies"));
    }

    @Test
    @DisplayName("mapTaskToDTO handles exception gracefully returning partial DTO")
    void getTasksByCompany_handlesException() {
        when(companyRepository.existsById(companyId)).thenReturn(true);

        Task task = new Task();
        task.setId(UUID.randomUUID());
        task.setTitle("Broken");
        task.setRequiredSkills(null);
        task.setAssignments(null);
        task.setIsArchived(null);

        when(taskRepository.findByCompanyId(companyId)).thenReturn(List.of(task));

        List<TaskDTO> result = superAdminService.getTasksByCompany(companyId);
        assertEquals(1, result.size());
        assertEquals("Broken", result.get(0).getTitle());
    }
}
