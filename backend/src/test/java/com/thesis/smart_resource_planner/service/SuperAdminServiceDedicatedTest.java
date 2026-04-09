package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.CompanyDTO;
import com.thesis.smart_resource_planner.model.dto.DepartmentDTO;
import com.thesis.smart_resource_planner.model.dto.EmployeeDTO;
import com.thesis.smart_resource_planner.model.dto.TaskDTO;
import com.thesis.smart_resource_planner.model.dto.TeamDTO;
import com.thesis.smart_resource_planner.model.dto.UserDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Department;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.EmployeeSkill;
import com.thesis.smart_resource_planner.model.entity.Skill;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskRequiredSkill;
import com.thesis.smart_resource_planner.model.entity.Team;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.CompanyRepository;
import com.thesis.smart_resource_planner.repository.DepartmentRepository;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.repository.EmployeeSkillRepository;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.repository.TeamRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.modelmapper.ModelMapper;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SuperAdminServiceDedicatedTest {

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
        company.setName("Acme");
        company.setIsActive(true);
    }

    @Test
    @DisplayName("getAllCompanies maps counts for each company")
    void getAllCompanies_mapsCounts() {
        CompanyDTO mapped = new CompanyDTO();
        when(companyRepository.findAll()).thenReturn(List.of(company));
        when(modelMapper.map(company, CompanyDTO.class)).thenReturn(mapped);
        when(employeeRepository.countEmployeesByCompanyIdForDashboard(companyId)).thenReturn(2L);
        when(departmentRepository.findByCompanyId(companyId)).thenReturn(List.of(new Department()));
        when(teamRepository.findByCompanyId(companyId)).thenReturn(List.of(new Team(), new Team()));

        List<CompanyDTO> result = superAdminService.getAllCompanies();
        assertEquals(1, result.size());
        assertEquals(2, result.get(0).getEmployeeCount());
        assertEquals(1, result.get(0).getDepartmentCount());
        assertEquals(2, result.get(0).getTeamCount());
    }

    @Test
    @DisplayName("toggleCompanyActive flips active flag and saves")
    void toggleCompanyActive_flipsFlag() {
        CompanyDTO mapped = new CompanyDTO();
        when(companyRepository.findById(companyId)).thenReturn(Optional.of(company));
        when(companyRepository.save(company)).thenReturn(company);
        when(modelMapper.map(company, CompanyDTO.class)).thenReturn(mapped);

        superAdminService.toggleCompanyActive(companyId);
        assertFalse(company.getIsActive());
        verify(companyRepository).save(company);
    }

    @Test
    @DisplayName("getUsersByCompany throws when company missing")
    void getUsersByCompany_companyMissing() {
        when(companyRepository.existsById(companyId)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> superAdminService.getUsersByCompany(companyId));
    }

    @Test
    @DisplayName("getUsersByCompany maps users")
    void getUsersByCompany_mapsUsers() {
        User user = new User();
        UserDTO dto = new UserDTO();
        when(companyRepository.existsById(companyId)).thenReturn(true);
        when(userRepository.findByCompanyId(companyId)).thenReturn(List.of(user));
        when(modelMapper.map(user, UserDTO.class)).thenReturn(dto);

        assertEquals(1, superAdminService.getUsersByCompany(companyId).size());
    }

    @Test
    @DisplayName("getTasksByCompany maps task defaults for null fields")
    void getTasksByCompany_mapsTaskDefaults() {
        when(companyRepository.existsById(companyId)).thenReturn(true);
        Task task = new Task();
        task.setId(UUID.randomUUID());
        task.setTitle("T");
        task.setRequiredSkills(List.of());
        task.setAssignments(List.of());
        task.setIsArchived(null);
        task.setIsEmployeeRequest(null);
        task.setRequiresApproval(null);
        when(taskRepository.findByCompanyId(companyId)).thenReturn(List.of(task));

        List<TaskDTO> result = superAdminService.getTasksByCompany(companyId);
        assertEquals(1, result.size());
        assertFalse(Boolean.TRUE.equals(result.get(0).getIsArchived()));
        assertFalse(Boolean.TRUE.equals(result.get(0).getIsEmployeeRequest()));
        assertFalse(Boolean.TRUE.equals(result.get(0).getRequiresApproval()));
    }

    @Test
    @DisplayName("getEmployeesByCompany maps employees with skills map")
    void getEmployeesByCompany_mapsSkills() {
        when(companyRepository.existsById(companyId)).thenReturn(true);

        User user = new User();
        user.setId(UUID.randomUUID());
        Employee employee = new Employee();
        UUID employeeId = UUID.randomUUID();
        employee.setId(employeeId);
        employee.setUser(user);
        employee.setFirstName("John");
        employee.setLastName("Doe");

        Skill skill = new Skill();
        skill.setId(UUID.randomUUID());
        skill.setName("Java");
        EmployeeSkill employeeSkill = new EmployeeSkill();
        employeeSkill.setEmployee(employee);
        employeeSkill.setSkill(skill);

        when(employeeRepository.findEmployeesByCompanyIdForDashboard(companyId)).thenReturn(List.of(employee));
        when(employeeSkillRepository.findByEmployeeIdIn(List.of(employeeId))).thenReturn(List.of(employeeSkill));

        List<EmployeeDTO> result = superAdminService.getEmployeesByCompany(companyId);
        assertEquals(1, result.size());
        assertEquals(1, result.get(0).getSkills().size());
        assertEquals("Java", result.get(0).getSkills().get(0).getSkillName());
    }

    @Test
    @DisplayName("getDepartmentsByCompany maps names and employee counts")
    void getDepartmentsByCompany_mapsCounts() {
        when(companyRepository.existsById(companyId)).thenReturn(true);
        Department dep = new Department();
        dep.setName("Engineering");
        dep.setDescription("desc");
        when(departmentRepository.findByCompanyId(companyId)).thenReturn(List.of(dep));
        when(employeeRepository.countEmployeesByDepartmentAndCompanyIdForDashboard("Engineering", companyId)).thenReturn(4L);

        List<DepartmentDTO> result = superAdminService.getDepartmentsByCompany(companyId);
        assertEquals(1, result.size());
        assertEquals(4, result.get(0).getEmployeeCount());
    }

    @Test
    @DisplayName("getTeamsByCompany maps member counts")
    void getTeamsByCompany_mapsMemberCount() {
        when(companyRepository.existsById(companyId)).thenReturn(true);
        Team team = new Team();
        team.setId(UUID.randomUUID());
        TeamDTO mapped = new TeamDTO();
        when(teamRepository.findByCompanyId(companyId)).thenReturn(List.of(team));
        when(modelMapper.map(team, TeamDTO.class)).thenReturn(mapped);
        when(userRepository.countByTeamId(team.getId())).thenReturn(3L);

        List<TeamDTO> result = superAdminService.getTeamsByCompany(companyId);
        assertEquals(1, result.size());
        assertEquals(3, result.get(0).getMemberCount());
    }

    @Test
    @DisplayName("statistics methods aggregate and validate company")
    void statistics_methods() {
        when(companyRepository.findAll()).thenReturn(List.of(company));
        when(userRepository.countByCompanyId(companyId)).thenReturn(5L);
        when(employeeRepository.countEmployeesByCompanyIdForDashboard(companyId)).thenReturn(2L);
        when(taskRepository.findByCompanyId(companyId)).thenReturn(List.of(new Task(), new Task(), new Task()));
        when(departmentRepository.findByCompanyId(companyId)).thenReturn(List.of(new Department()));
        when(teamRepository.findByCompanyId(companyId)).thenReturn(List.of(new Team()));

        Map<String, Object> system = superAdminService.getSystemStatistics();
        assertEquals(1, system.get("totalCompanies"));
        assertEquals(3, system.get("totalTasks"));

        when(companyRepository.existsById(companyId)).thenReturn(true);
        Map<String, Object> companyStats = superAdminService.getCompanyStatistics(companyId);
        assertEquals(5L, companyStats.get("userCount"));

        UUID missing = UUID.randomUUID();
        when(companyRepository.existsById(missing)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> superAdminService.getCompanyStatistics(missing));
    }
}
