package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.EmployeeDTO;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.repository.EmployeeSkillRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import com.thesis.smart_resource_planner.repository.SkillRepository;
import com.thesis.smart_resource_planner.repository.EmployeeAvailabilityRepository;
import com.thesis.smart_resource_planner.repository.TaskAssignmentRepository;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("EmployeeService Tests")
class EmployeeServiceLegacyDedicatedTest {

    @Mock
    private EmployeeRepository employeeRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SkillRepository skillRepository;

    @Mock
    private EmployeeSkillRepository employeeSkillRepository;

    @Mock
    private EmployeeAvailabilityRepository availabilityRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private TaskAssignmentRepository taskAssignmentRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private WebSocketBroadcastService broadcastService;

    @Mock
    private ModelMapper modelMapper;

    @InjectMocks
    private EmployeeService employeeService;

    private UUID employeeId;
    private UUID userId;
    private Company company;
    private User user;
    private Employee employee;

    @BeforeEach
    void setUp() {
        employeeId = UUID.randomUUID();
        userId = UUID.randomUUID();

        company = new Company();
        company.setId(UUID.randomUUID());

        user = new User();
        user.setId(userId);
        user.setCompany(company);
        user.setRole(UserRole.EMPLOYEE);

        employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(user);
        employee.setFirstName("John");
        employee.setLastName("Doe");
        employee.setPosition("Senior Developer");
    }

    @Test
    @DisplayName("Should retrieve employee by ID successfully")
    void testGetEmployeeById_Success() {
        when(employeeRepository.findByIdWithSkills(employeeId)).thenReturn(Optional.of(employee));

        EmployeeDTO result = employeeService.getEmployeeById(employeeId);

        assertNotNull(result);
        assertEquals(employeeId, result.getId());
        assertEquals(userId, result.getUserId());
    }

    @Test
    @DisplayName("Should throw exception when employee not found")
    void testGetEmployeeById_NotFound() {
        when(employeeRepository.findByIdWithSkills(employeeId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> employeeService.getEmployeeById(employeeId));
    }

    @Test
    @DisplayName("getAllEmployees: hides hourlyRate for non-admin/non-manager")
    void getAllEmployees_hidesHourlyRateForEmployees() {
        UUID requesterId = UUID.randomUUID();

        User requester = new User();
        requester.setId(requesterId);
        requester.setCompany(company);
        requester.setRole(UserRole.EMPLOYEE);

        EmployeeDTO mapped = new EmployeeDTO();
        mapped.setId(employeeId);
        mapped.setHourlyRate(BigDecimal.valueOf(123.45));

        when(userRepository.findById(requesterId)).thenReturn(Optional.of(requester));
        when(employeeRepository.findByCompanyIdWithSkills(company.getId())).thenReturn(List.of(employee));
        when(employeeSkillRepository.findByEmployeeIdIn(anyList())).thenReturn(List.of());
        when(modelMapper.map(eq(employee), eq(EmployeeDTO.class))).thenReturn(mapped);

        List<EmployeeDTO> result = employeeService.getAllEmployees(requesterId);

        assertEquals(1, result.size());
        assertNull(result.get(0).getHourlyRate());
    }

    @Test
    @DisplayName("deleteEmployee: throws when employee does not exist")
    void deleteEmployee_notFound() {
        when(employeeRepository.existsById(employeeId)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> employeeService.deleteEmployee(employeeId));
    }

    @Test
    @DisplayName("getAllEmployees keeps hourlyRate for admins")
    void getAllEmployees_adminSeesHourlyRate() {
        UUID requesterId = UUID.randomUUID();
        User requester = new User();
        requester.setId(requesterId);
        requester.setCompany(company);
        requester.setRole(UserRole.ADMIN);

        EmployeeDTO mapped = new EmployeeDTO();
        mapped.setId(employeeId);
        mapped.setHourlyRate(BigDecimal.valueOf(99.99));

        when(userRepository.findById(requesterId)).thenReturn(Optional.of(requester));
        when(employeeRepository.findByCompanyIdWithSkills(company.getId())).thenReturn(List.of(employee));
        when(employeeSkillRepository.findByEmployeeIdIn(anyList())).thenReturn(List.of());
        when(modelMapper.map(eq(employee), eq(EmployeeDTO.class))).thenReturn(mapped);

        List<EmployeeDTO> result = employeeService.getAllEmployees(requesterId);
        assertEquals(BigDecimal.valueOf(99.99), result.get(0).getHourlyRate());
    }

    @Test
    @DisplayName("deleteEmployee: success deletes by id")
    void deleteEmployee_success() {
        when(employeeRepository.existsById(employeeId)).thenReturn(true);
        employeeService.deleteEmployee(employeeId);
        verify(employeeRepository).deleteById(employeeId);
    }

    @Test
    @DisplayName("getEmployeesPaginated: empty page returns empty result")
    void getEmployeesPaginated_emptyPage() {
        UUID requesterId = UUID.randomUUID();
        User requester = new User();
        requester.setId(requesterId);
        requester.setCompany(company);
        requester.setRole(UserRole.ADMIN);

        var pageable = PageRequest.of(0, 10);
        when(userRepository.findById(requesterId)).thenReturn(Optional.of(requester));
        when(employeeRepository.findByCompanyIdWithFiltersNative(eq(company.getId()), any(), any(), any(), eq(pageable)))
                .thenReturn(Page.empty(pageable));

        Page<EmployeeDTO> result = employeeService.getEmployeesPaginated(requesterId, pageable, null, null, null);
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("getEmployeesBySkill: supports null and min proficiency branches")
    void getEmployeesBySkill_branches() {
        when(employeeRepository.findBySkillId(employeeId)).thenReturn(List.of(employee));
        when(employeeRepository.findBySkillAndMinProficiency(employeeId, 3)).thenReturn(List.of(employee));
        when(modelMapper.map(eq(employee), eq(EmployeeDTO.class))).thenReturn(new EmployeeDTO());

        assertEquals(1, employeeService.getEmployeesBySkill(employeeId, null).size());
        assertEquals(1, employeeService.getEmployeesBySkill(employeeId, 3).size());
    }
}
