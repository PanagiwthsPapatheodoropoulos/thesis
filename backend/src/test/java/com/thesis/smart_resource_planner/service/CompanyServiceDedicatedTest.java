package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.CompanyDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Department;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.EmployeeAvailability;
import com.thesis.smart_resource_planner.model.entity.EmployeeSkill;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskAssignment;
import com.thesis.smart_resource_planner.model.entity.TaskPermission;
import com.thesis.smart_resource_planner.model.entity.Team;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("CompanyService Tests")
class CompanyServiceDedicatedTest {

    @Mock
    private CompanyRepository companyRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private DepartmentRepository departmentRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private ModelMapper modelMapper;

    @Mock private EmployeeRepository employeeRepository;
    @Mock private EmployeeSkillRepository employeeSkillRepository;
    @Mock private EmployeeAvailabilityRepository availabilityRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private TaskPermissionRepository taskPermissionRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private TaskRequiredSkillRepository taskRequiredSkillRepository;
    @Mock private TaskCommentRepository taskCommentRepository;
    @Mock private TaskAuditLogRepository taskAuditLogRepository;
    @Mock private TaskTimeEntryRepository taskTimeEntryRepository;
    @Mock private TaskAssignmentRepository taskAssignmentRepository;

    @InjectMocks
    private CompanyService companyService;

    private Company testCompany;
    private UUID companyId;

    @BeforeEach
    void setUp() {
        companyId = UUID.randomUUID();
        testCompany = new Company();
        testCompany.setId(companyId);
        testCompany.setName("Test Company");
    }

    @Test
    @DisplayName("createCompany: creates company and seeds defaults")
    void createCompany_success() {
        when(companyRepository.existsByName("Test Company")).thenReturn(false);
        when(companyRepository.existsByJoinCode(anyString())).thenReturn(false);
        when(companyRepository.save(any(Company.class))).thenAnswer(inv -> {
            Company c = inv.getArgument(0);
            c.setId(companyId);
            return c;
        });

        Company created = companyService.createCompany("Test Company");

        assertNotNull(created.getJoinCode());
        assertEquals("Test Company", created.getName());
        verify(departmentRepository).saveAll(anyList());
        verify(teamRepository).saveAll(anyList());
    }

    @Test
    @DisplayName("createCompany: throws on duplicate name")
    void createCompany_duplicateName() {
        when(companyRepository.existsByName("Test Company")).thenReturn(true);
        assertThrows(DuplicateResourceException.class, () -> companyService.createCompany("Test Company"));
    }

    @Test
    @DisplayName("findByJoinCode: returns company or throws")
    void findByJoinCode_successAndNotFound() {
        when(companyRepository.findByJoinCode("ABC123")).thenReturn(Optional.of(testCompany));
        Company found = companyService.findByJoinCode("ABC123");
        assertEquals(companyId, found.getId());

        when(companyRepository.findByJoinCode("BAD")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> companyService.findByJoinCode("BAD"));
    }

    @Test
    @DisplayName("getAllCompanies: maps and enriches counts")
    void getAllCompanies_success() {
        when(companyRepository.findAll()).thenReturn(List.of(testCompany));
        when(modelMapper.map(eq(testCompany), eq(CompanyDTO.class))).thenReturn(new CompanyDTO());
        when(userRepository.countByCompanyId(companyId)).thenReturn(3L);
        when(departmentRepository.findByCompanyId(companyId)).thenReturn(List.of());
        when(teamRepository.findByCompanyId(companyId)).thenReturn(List.of());

        List<CompanyDTO> result = companyService.getAllCompanies();
        assertEquals(1, result.size());
        verify(companyRepository).findAll();
    }

    @Test
    @DisplayName("getCompanyById: resolves via user and maps")
    void getCompanyById_success() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setCompany(testCompany);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(modelMapper.map(eq(testCompany), eq(CompanyDTO.class))).thenReturn(new CompanyDTO());
        when(userRepository.countByCompanyId(userId)).thenReturn(3L);
        when(departmentRepository.findByCompanyId(userId)).thenReturn(List.of());
        when(teamRepository.findByCompanyId(userId)).thenReturn(List.of());

        CompanyDTO dto = companyService.getCompanyById(userId);
        assertNotNull(dto);
    }

    @Test
    @DisplayName("getDefaultCompany returns seeded company or throws")
    void getDefaultCompany_paths() {
        UUID defaultId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        Company defaultCompany = new Company();
        defaultCompany.setId(defaultId);
        when(companyRepository.findById(defaultId)).thenReturn(Optional.of(defaultCompany));
        assertEquals(defaultId, companyService.getDefaultCompany().getId());

        when(companyRepository.findById(defaultId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> companyService.getDefaultCompany());
    }

    @Test
    @DisplayName("regenerateJoinCode updates and saves company")
    void regenerateJoinCode_success() {
        when(companyRepository.findById(companyId)).thenReturn(Optional.of(testCompany));
        when(companyRepository.existsByJoinCode(anyString())).thenReturn(false);

        String code = companyService.regenerateJoinCode(companyId);
        assertNotNull(code);
        assertEquals(6, code.length());
        verify(companyRepository).save(testCompany);
    }

    @Test
    @DisplayName("deleteCompany throws when target company missing")
    void deleteCompany_notFound() {
        when(companyRepository.findById(companyId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> companyService.deleteCompany(companyId));
    }

    @Test
    @DisplayName("deleteCompany removes company in empty-data path")
    void deleteCompany_emptyAssociations_success() {
        when(companyRepository.findById(companyId)).thenReturn(Optional.of(testCompany));
        when(employeeRepository.findByCompanyId(companyId)).thenReturn(List.of());
        when(userRepository.findByCompanyId(companyId)).thenReturn(List.of());
        when(taskRepository.findByCompanyId(companyId)).thenReturn(List.of());
        when(teamRepository.findByCompanyId(companyId)).thenReturn(List.of());
        when(departmentRepository.findByCompanyId(companyId)).thenReturn(List.of());

        companyService.deleteCompany(companyId);

        verify(companyRepository).delete(testCompany);
        verify(companyRepository).flush();
    }

    @Test
    @DisplayName("deleteCompany removes nested entities and clears user team before team delete")
    void deleteCompany_fullAssociations_success() {
        UUID userId = UUID.randomUUID();
        UUID employeeId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();

        Team team = new Team();
        team.setId(UUID.randomUUID());
        team.setCompany(testCompany);

        User user = new User();
        user.setId(userId);
        user.setCompany(testCompany);
        user.setTeam(team);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(user);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(testCompany);

        when(companyRepository.findById(companyId)).thenReturn(Optional.of(testCompany));
        when(employeeRepository.findByCompanyId(companyId)).thenReturn(List.of(employee));
        when(userRepository.findByCompanyId(companyId)).thenReturn(List.of(user));
        when(taskRepository.findByCompanyId(companyId)).thenReturn(List.of(task));
        when(teamRepository.findByCompanyId(companyId)).thenReturn(List.of(team));
        when(departmentRepository.findByCompanyId(companyId)).thenReturn(List.of(new Department()));

        when(employeeSkillRepository.findByEmployeeId(employeeId)).thenReturn(List.of(new EmployeeSkill()));
        when(availabilityRepository.findByEmployeeId(employeeId)).thenReturn(List.of(new EmployeeAvailability()));
        when(taskAssignmentRepository.findByEmployeeId(employeeId)).thenReturn(List.of(new TaskAssignment()));
        when(notificationRepository.findByUserIdAndCompanyId(userId, companyId)).thenReturn(List.of());
        when(chatMessageRepository.findAllUserMessagesByCompany(userId, companyId)).thenReturn(List.of());
        when(taskPermissionRepository.findByUserId(userId)).thenReturn(List.of(new TaskPermission()));
        when(taskRequiredSkillRepository.findByTaskId(taskId)).thenReturn(List.of());
        when(taskCommentRepository.findByTaskIdOrderByCreatedAtDesc(taskId)).thenReturn(List.of());
        when(taskAuditLogRepository.findByTaskIdOrderByCreatedAtDesc(taskId)).thenReturn(List.of());
        when(taskTimeEntryRepository.findByTaskIdOrderByWorkDateDesc(taskId)).thenReturn(List.of());

        companyService.deleteCompany(companyId);

        verify(userRepository).save(argThat(u -> u.getTeam() == null));
        verify(teamRepository).deleteAll(anyList());
        verify(departmentRepository).deleteAll(anyList());
        verify(userRepository).deleteAll(anyList());
        verify(employeeRepository).deleteAll(anyList());
        verify(taskRepository).deleteAll(anyList());
        verify(companyRepository).delete(testCompany);
    }

    @Test
    @DisplayName("deleteCompany tolerates nested delete exceptions and still deletes company")
    void deleteCompany_nestedDeleteExceptions_stillSucceeds() {
        UUID userId = UUID.randomUUID();
        UUID employeeId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();

        User user = new User();
        user.setId(userId);
        user.setCompany(testCompany);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(user);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(testCompany);

        when(companyRepository.findById(companyId)).thenReturn(Optional.of(testCompany));
        when(employeeRepository.findByCompanyId(companyId)).thenReturn(List.of(employee));
        when(userRepository.findByCompanyId(companyId)).thenReturn(List.of(user));
        when(taskRepository.findByCompanyId(companyId)).thenReturn(List.of(task));
        when(teamRepository.findByCompanyId(companyId)).thenReturn(List.of());
        when(departmentRepository.findByCompanyId(companyId)).thenReturn(List.of());

        when(employeeSkillRepository.findByEmployeeId(employeeId)).thenThrow(new RuntimeException("skills"));
        when(availabilityRepository.findByEmployeeId(employeeId)).thenThrow(new RuntimeException("availability"));
        when(taskAssignmentRepository.findByEmployeeId(employeeId)).thenThrow(new RuntimeException("assignment"));
        when(notificationRepository.findByUserIdAndCompanyId(userId, companyId)).thenThrow(new RuntimeException("notif"));
        when(chatMessageRepository.findAllUserMessagesByCompany(userId, companyId)).thenThrow(new RuntimeException("chat"));
        when(taskPermissionRepository.findByUserId(userId)).thenThrow(new RuntimeException("perm"));
        when(taskRequiredSkillRepository.findByTaskId(taskId)).thenThrow(new RuntimeException("req"));
        when(taskCommentRepository.findByTaskIdOrderByCreatedAtDesc(taskId)).thenThrow(new RuntimeException("comment"));
        when(taskAuditLogRepository.findByTaskIdOrderByCreatedAtDesc(taskId)).thenThrow(new RuntimeException("audit"));
        when(taskTimeEntryRepository.findByTaskIdOrderByWorkDateDesc(taskId)).thenThrow(new RuntimeException("time"));

        assertDoesNotThrow(() -> companyService.deleteCompany(companyId));
        verify(companyRepository).delete(testCompany);
        verify(companyRepository).flush();
    }
}
