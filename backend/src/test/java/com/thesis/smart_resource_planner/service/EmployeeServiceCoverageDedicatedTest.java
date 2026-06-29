package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.TaskStatus;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.enums.TaskAssignmentStatus;
import com.thesis.smart_resource_planner.exception.BadRequestException;
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
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("EmployeeService Coverage Dedicated Tests")
class EmployeeServiceCoverageDedicatedTest {

    @Mock
    private EmployeeRepository employeeRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TeamRepository teamRepository;
    @Mock
    private DepartmentRepository departmentRepository;
    @Mock
    private EmployeeSkillRepository employeeSkillRepository;
    @Mock
    private SkillRepository skillRepository;
    @Mock
    private EmployeeAvailabilityRepository availabilityRepository;
    @Mock
    private TaskAssignmentRepository taskAssignmentRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private ModelMapper modelMapper;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private EmployeeService employeeService;

    private User user;
    private Company company;

    @BeforeEach
    void setUp() {
        company = new Company();
        company.setId(UUID.randomUUID());

        user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("testuser");
        user.setRole(UserRole.EMPLOYEE);
        user.setCompany(company);
    }

    @Test
    @DisplayName("createEmployee cleans up orphaned record when user is null")
    void createEmployee_orphanedRecordCleanup() {
        EmployeeCreateDTO createDTO = new EmployeeCreateDTO();
        createDTO.setUserId(user.getId());
        createDTO.setFirstName("John");
        createDTO.setLastName("Doe");

        Employee existingOrphan = new Employee();
        existingOrphan.setId(UUID.randomUUID());
        existingOrphan.setUser(null); // Orphaned record

        when(employeeRepository.findByUserId(user.getId())).thenReturn(Optional.of(existingOrphan));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(employeeRepository.saveAndFlush(any(Employee.class))).thenAnswer(invocation -> {
            Employee emp = invocation.getArgument(0);
            emp.setId(UUID.randomUUID());
            return emp;
        });
        when(modelMapper.map(any(), eq(EmployeeDTO.class))).thenReturn(new EmployeeDTO());

        EmployeeDTO result = employeeService.createEmployee(createDTO);

        verify(employeeSkillRepository).deleteByEmployeeId(existingOrphan.getId());
        verify(availabilityRepository).deleteByEmployeeId(existingOrphan.getId());
        verify(taskAssignmentRepository).deleteByEmployeeId(existingOrphan.getId());
        verify(employeeRepository).delete(existingOrphan);
        assertNotNull(result);
    }

    @Test
    @DisplayName("createEmployee throws BadRequestException when orphaned record cleanup fails")
    void createEmployee_orphanedRecordCleanupFailure() {
        EmployeeCreateDTO createDTO = new EmployeeCreateDTO();
        createDTO.setUserId(user.getId());

        Employee existingOrphan = new Employee();
        existingOrphan.setId(UUID.randomUUID());
        existingOrphan.setUser(null);

        when(employeeRepository.findByUserId(user.getId())).thenReturn(Optional.of(existingOrphan));
        doThrow(new RuntimeException("DB error")).when(employeeSkillRepository)
                .deleteByEmployeeId(existingOrphan.getId());

        assertThrows(BadRequestException.class, () -> employeeService.createEmployee(createDTO));
    }

    @Test
    @DisplayName("getEmployeeSkills throws ResourceNotFoundException when employee does not exist")
    void getEmployeeSkills_employeeNotFound() {
        UUID empId = UUID.randomUUID();
        when(employeeRepository.existsById(empId)).thenReturn(false);

        assertThrows(ResourceNotFoundException.class, () -> employeeService.getEmployeeSkills(empId));
    }

    @Test
    @DisplayName("getEmployeeSkills handles null skill entity gracefully")
    void getEmployeeSkills_nullSkillEntity() {
        UUID empId = UUID.randomUUID();
        when(employeeRepository.existsById(empId)).thenReturn(true);

        EmployeeSkill empSkill = new EmployeeSkill();
        empSkill.setId(UUID.randomUUID());
        empSkill.setSkill(null); // null skill
        empSkill.setProficiencyLevel(4);
        empSkill.setYearsOfExperience(BigDecimal.valueOf(2));

        when(employeeSkillRepository.findByEmployeeId(empId)).thenReturn(List.of(empSkill));

        List<EmployeeSkillDTO> result = employeeService.getEmployeeSkills(empId);
        assertEquals(1, result.size());
        assertNull(result.get(0).getSkillId());
    }

    @Test
    @DisplayName("getEmployeeWorkload calculates correct workload percentages with dampening")
    void getEmployeeWorkload_calculations() {
        user.setRole(UserRole.EMPLOYEE); // Role must be EMPLOYEE to not get filtered out
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        Employee emp = new Employee();
        emp.setId(UUID.randomUUID());
        emp.setFirstName("Jane");
        emp.setLastName("Smith");
        emp.setUser(user);
        emp.setMaxWeeklyHours(40);

        Task task1 = new Task();
        task1.setId(UUID.randomUUID());
        task1.setTitle("Task 1");
        task1.setAssignedEmployeeId(emp.getId());
        task1.setStatus(TaskStatus.IN_PROGRESS);
        task1.setEstimatedHours(BigDecimal.valueOf(20)); // > 8 hours, dampening applies (8 + 12*0.25 = 11)

        Task task2 = new Task();
        task2.setId(UUID.randomUUID());
        task2.setTitle("Task 2");
        task2.setAssignedEmployeeId(emp.getId());
        task2.setStatus(TaskStatus.COMPLETED); // should be skipped in active count and workload

        when(taskRepository.findByCompanyId(company.getId())).thenReturn(List.of(task1, task2));
        when(taskAssignmentRepository.findByCompanyIdAndStatus(company.getId(), TaskAssignmentStatus.ACCEPTED))
                .thenReturn(Collections.emptyList());
        when(employeeRepository.findByCompanyIdWithTeam(company.getId())).thenReturn(List.of(emp));

        List<EmployeeWorkloadDTO> workloads = employeeService.getEmployeeWorkload(user.getId());
        assertEquals(1, workloads.size());
        EmployeeWorkloadDTO dto = workloads.get(0);
        assertEquals(emp.getId(), dto.getEmployeeId());
        assertEquals(1, dto.getActiveTasks());
        assertEquals(1, dto.getCompletedTasks());
        assertEquals(27.5, dto.getWorkloadPercentage(), 0.001); // 11 hours used / 40 max * 100
    }

    @Test
    @DisplayName("addSkillToEmployee updates existing skill mapping")
    void addSkillToEmployee_updatesExisting() {
        UUID empId = UUID.randomUUID();
        UUID skillId = UUID.randomUUID();

        Employee emp = new Employee();
        emp.setId(empId);

        Skill skill = new Skill();
        skill.setId(skillId);
        skill.setName("Docker");
        skill.setCategory("DevOps");

        EmployeeSkill existingSkill = new EmployeeSkill();
        existingSkill.setId(UUID.randomUUID());
        existingSkill.setEmployee(emp);
        existingSkill.setSkill(skill);

        EmployeeSkillDTO inputDTO = new EmployeeSkillDTO();
        inputDTO.setSkillId(skillId);
        inputDTO.setProficiencyLevel(5);

        when(employeeRepository.findById(empId)).thenReturn(Optional.of(emp));
        when(skillRepository.findById(skillId)).thenReturn(Optional.of(skill));
        when(employeeSkillRepository.findByEmployeeIdAndSkillId(empId, skillId)).thenReturn(Optional.of(existingSkill));
        when(employeeSkillRepository.saveAndFlush(any(EmployeeSkill.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        EmployeeSkillDTO mappedDto = new EmployeeSkillDTO();
        mappedDto.setProficiencyLevel(5);
        when(modelMapper.map(any(), eq(EmployeeSkillDTO.class))).thenReturn(mappedDto);

        EmployeeSkillDTO result = employeeService.addSkillToEmployee(empId, inputDTO);
        assertNotNull(result);
        assertEquals(5, result.getProficiencyLevel());
    }

    @Test
    @DisplayName("removeSkillFromEmployee throws ResourceNotFoundException when mapping not found")
    void removeSkillFromEmployee_notFound() {
        UUID empId = UUID.randomUUID();
        UUID skillId = UUID.randomUUID();

        when(employeeSkillRepository.findByEmployeeIdAndSkillId(empId, skillId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> employeeService.removeSkillFromEmployee(empId, skillId));
    }
}
