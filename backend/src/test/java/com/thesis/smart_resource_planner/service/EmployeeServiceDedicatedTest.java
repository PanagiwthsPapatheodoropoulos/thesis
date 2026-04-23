package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.enums.TaskAssignmentStatus;
import com.thesis.smart_resource_planner.enums.TaskStatus;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.EmployeeAvailabilityDTO;
import com.thesis.smart_resource_planner.model.dto.EmployeeCreateDTO;
import com.thesis.smart_resource_planner.model.dto.EmployeeDTO;
import com.thesis.smart_resource_planner.model.dto.EmployeeSkillDTO;
import com.thesis.smart_resource_planner.model.entity.EmployeeAvailability;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.EmployeeSkill;
import com.thesis.smart_resource_planner.model.entity.Skill;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.Team;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmployeeServiceDedicatedTest {

    @Mock
    private EmployeeRepository employeeRepository;
    @Mock
    private com.thesis.smart_resource_planner.repository.UserRepository userRepository;
    @Mock
    private com.thesis.smart_resource_planner.repository.SkillRepository skillRepository;
    @Mock
    private com.thesis.smart_resource_planner.repository.EmployeeSkillRepository employeeSkillRepository;
    @Mock
    private com.thesis.smart_resource_planner.repository.EmployeeAvailabilityRepository availabilityRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private ModelMapper modelMapper;
    @Mock
    private com.thesis.smart_resource_planner.repository.TaskAssignmentRepository taskAssignmentRepository;
    @Mock
    private com.thesis.smart_resource_planner.repository.TaskRepository taskRepository;
    @Mock
    private SimpMessagingTemplate messagingTemplate;
    @Mock
    private WebSocketBroadcastService broadcastService;

    @InjectMocks
    private EmployeeService employeeService;

    private UUID userId;
    private UUID employeeId;
    private Company company;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        employeeId = UUID.randomUUID();
        company = new Company();
        company.setId(UUID.randomUUID());
    }

    @Test
    @DisplayName("getEmployeeSkills throws when employee does not exist")
    void getEmployeeSkills_notFound() {
        when(employeeRepository.existsById(employeeId)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> employeeService.getEmployeeSkills(employeeId));
    }

    @Test
    @DisplayName("updateEmployee throws when employee missing")
    void updateEmployee_notFound() {
        when(employeeRepository.findById(employeeId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class,
                () -> employeeService.updateEmployee(employeeId, new EmployeeCreateDTO()));
    }

    @Test
    @DisplayName("getEmployeeSkills returns empty list when no skills")
    void getEmployeeSkills_emptyList() {
        when(employeeRepository.existsById(employeeId)).thenReturn(true);
        when(employeeSkillRepository.findByEmployeeId(employeeId)).thenReturn(List.of());
        List<EmployeeSkillDTO> result = employeeService.getEmployeeSkills(employeeId);
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("getEmployeesPaginated returns empty page shortcut")
    void getEmployeesPaginated_emptyPage() {
        User requester = new User();
        requester.setId(userId);
        requester.setRole(UserRole.ADMIN);
        requester.setCompany(company);
        var pageable = PageRequest.of(0, 10);

        when(userRepository.findById(userId)).thenReturn(Optional.of(requester));
        when(employeeRepository.findByCompanyIdWithFiltersNative(eq(company.getId()), any(), any(), any(),
                eq(pageable)))
                .thenReturn(org.springframework.data.domain.Page.empty(pageable));

        var page = employeeService.getEmployeesPaginated(userId, pageable, null, null, null);
        assertTrue(page.isEmpty());
        verify(employeeSkillRepository, never()).findByEmployeeIdIn(anyList());
    }

    @Test
    @DisplayName("getEmployeesPaginated hides hourlyRate for non-privileged caller")
    void getEmployeesPaginated_hidesSalaryForEmployeeRole() {
        User requester = new User();
        requester.setId(userId);
        requester.setRole(UserRole.EMPLOYEE);
        requester.setCompany(company);

        User employeeUser = new User();
        employeeUser.setId(UUID.randomUUID());
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(employeeUser);

        EmployeeDTO dto = new EmployeeDTO();
        dto.setId(employeeId);
        dto.setHourlyRate(BigDecimal.valueOf(42));

        var pageable = PageRequest.of(0, 10);
        when(userRepository.findById(userId)).thenReturn(Optional.of(requester));
        when(employeeRepository.findByCompanyIdWithFiltersNative(eq(company.getId()), any(), any(), any(),
                eq(pageable)))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(employee), pageable, 1));
        when(employeeSkillRepository.findByEmployeeIdIn(anyList())).thenReturn(List.of());
        when(modelMapper.map(eq(employee), eq(EmployeeDTO.class))).thenReturn(dto);

        var page = employeeService.getEmployeesPaginated(userId, pageable, null, null, null);
        assertEquals(1, page.getContent().size());
        assertNull(page.getContent().get(0).getHourlyRate());
    }

    @Test
    @DisplayName("deleteEmployee throws when employee does not exist")
    void deleteEmployee_notFound() {
        when(employeeRepository.existsById(employeeId)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> employeeService.deleteEmployee(employeeId));
        verify(employeeRepository, never()).deleteById(any());
    }

    @Test
    @DisplayName("deleteEmployee removes existing employee")
    void deleteEmployee_success() {
        when(employeeRepository.existsById(employeeId)).thenReturn(true);
        employeeService.deleteEmployee(employeeId);
        verify(employeeRepository).deleteById(employeeId);
    }

    @Test
    @DisplayName("getEmployeesBySkill uses minProficiency repository path")
    void getEmployeesBySkill_withMinProficiency() {
        UUID skillId = UUID.randomUUID();
        Employee employee = new Employee();
        employee.setId(employeeId);
        EmployeeDTO dto = new EmployeeDTO();
        dto.setId(employeeId);

        when(employeeRepository.findBySkillAndMinProficiency(skillId, 4)).thenReturn(List.of(employee));
        when(modelMapper.map(employee, EmployeeDTO.class)).thenReturn(dto);

        var result = employeeService.getEmployeesBySkill(skillId, 4);
        assertEquals(1, result.size());
        verify(employeeRepository).findBySkillAndMinProficiency(skillId, 4);
        verify(employeeRepository, never()).findBySkillId(any());
    }

    @Test
    @DisplayName("getEmployeesBySkill uses fallback repository path when minProficiency absent")
    void getEmployeesBySkill_withoutMinProficiency() {
        UUID skillId = UUID.randomUUID();
        Employee employee = new Employee();
        employee.setId(employeeId);
        EmployeeDTO dto = new EmployeeDTO();
        dto.setId(employeeId);

        when(employeeRepository.findBySkillId(skillId)).thenReturn(List.of(employee));
        when(modelMapper.map(employee, EmployeeDTO.class)).thenReturn(dto);

        var result = employeeService.getEmployeesBySkill(skillId, null);
        assertEquals(1, result.size());
        verify(employeeRepository).findBySkillId(skillId);
        verify(employeeRepository, never()).findBySkillAndMinProficiency(any(), anyInt());
    }

    @Test
    @DisplayName("addSkillToEmployee updates existing skill mapping")
    void addSkillToEmployee_updatesExisting() {
        UUID skillId = UUID.randomUUID();
        Employee employee = new Employee();
        employee.setId(employeeId);
        Skill skill = new Skill();
        skill.setId(skillId);
        skill.setName("Java");
        skill.setCategory("Backend");

        EmployeeSkill existing = new EmployeeSkill();
        existing.setId(UUID.randomUUID());
        existing.setEmployee(employee);
        existing.setSkill(skill);

        EmployeeSkillDTO input = new EmployeeSkillDTO();
        input.setSkillId(skillId);
        input.setProficiencyLevel(5);

        EmployeeSkillDTO mapped = new EmployeeSkillDTO();

        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(skillRepository.findById(skillId)).thenReturn(Optional.of(skill));
        when(employeeSkillRepository.findByEmployeeIdAndSkillId(employeeId, skillId)).thenReturn(Optional.of(existing));
        when(employeeSkillRepository.saveAndFlush(existing)).thenReturn(existing);
        when(modelMapper.map(existing, EmployeeSkillDTO.class)).thenReturn(mapped);

        EmployeeSkillDTO result = employeeService.addSkillToEmployee(employeeId, input);
        assertNotNull(result);
        verify(employeeSkillRepository).saveAndFlush(existing);
    }

    @Test
    @DisplayName("removeSkillFromEmployee throws when mapping not found")
    void removeSkillFromEmployee_notFound() {
        UUID skillId = UUID.randomUUID();
        when(employeeSkillRepository.findByEmployeeIdAndSkillId(employeeId, skillId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class,
                () -> employeeService.removeSkillFromEmployee(employeeId, skillId));
    }

    @Test
    @DisplayName("createEmployee throws validation when active profile already exists")
    void createEmployee_existingProfile_throwsValidation() {
        Employee existing = new Employee();
        existing.setId(employeeId);
        existing.setUser(new User());

        EmployeeCreateDTO dto = new EmployeeCreateDTO();
        dto.setUserId(userId);

        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.of(existing));

        assertThrows(jakarta.validation.ValidationException.class, () -> employeeService.createEmployee(dto));
    }

    @Test
    @DisplayName("createEmployee creates profile for already employee-role user")
    void createEmployee_existingEmployeeRole_successNoPromotion() {
        User user = new User();
        user.setId(userId);
        user.setRole(UserRole.EMPLOYEE);
        user.setCompany(company);

        EmployeeCreateDTO dto = new EmployeeCreateDTO();
        dto.setUserId(userId);
        dto.setFirstName("A");
        dto.setLastName("B");
        dto.setDepartment("Eng");
        dto.setPosition("Dev");
        dto.setHireDate(LocalDate.now());

        Employee saved = new Employee();
        saved.setId(employeeId);
        saved.setUser(user);

        EmployeeDTO mapped = new EmployeeDTO();
        mapped.setId(employeeId);

        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(employeeRepository.saveAndFlush(any(Employee.class))).thenReturn(saved);
        when(modelMapper.map(saved, EmployeeDTO.class)).thenReturn(mapped);

        EmployeeDTO result = employeeService.createEmployee(dto);
        assertNotNull(result);
        assertEquals(employeeId, result.getId());
        verify(userRepository, never()).saveAndFlush(any(User.class));
    }

    @Test
    @DisplayName("removeSkillFromEmployee deletes mapping when present")
    void removeSkillFromEmployee_success() {
        UUID skillId = UUID.randomUUID();
        EmployeeSkill mapping = new EmployeeSkill();
        when(employeeSkillRepository.findByEmployeeIdAndSkillId(employeeId, skillId)).thenReturn(Optional.of(mapping));

        assertDoesNotThrow(() -> employeeService.removeSkillFromEmployee(employeeId, skillId));
        verify(employeeSkillRepository).delete(mapping);
    }

    @Test
    @DisplayName("setEmployeeAvailability creates new record when date does not exist")
    void setEmployeeAvailability_createsWhenMissing() {
        LocalDate date = LocalDate.now();
        User user = new User();
        user.setCompany(company);
        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(user);

        EmployeeAvailabilityDTO dto = new EmployeeAvailabilityDTO();
        dto.setEmployeeId(employeeId);
        dto.setDate(date);
        dto.setAvailableHours(BigDecimal.valueOf(6));
        dto.setIsAvailable(true);
        dto.setNotes("focus");

        EmployeeAvailability saved = new EmployeeAvailability();
        saved.setEmployee(employee);
        saved.setDate(date);

        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(availabilityRepository.findByEmployeeIdAndDateAndCompanyId(employeeId, date, company.getId()))
                .thenReturn(Optional.empty());
        when(availabilityRepository.save(any(EmployeeAvailability.class))).thenReturn(saved);
        when(modelMapper.map(saved, EmployeeAvailabilityDTO.class)).thenReturn(dto);

        EmployeeAvailabilityDTO result = employeeService.setEmployeeAvailability(dto);
        assertNotNull(result);
        verify(availabilityRepository).save(any(EmployeeAvailability.class));
    }

    @Test
    @DisplayName("getEmployeeAvailability returns mapped range results")
    void getEmployeeAvailability_mapsRangeResults() {
        LocalDate start = LocalDate.now();
        LocalDate end = start.plusDays(2);
        User user = new User();
        user.setCompany(company);
        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(user);
        EmployeeAvailability availability = new EmployeeAvailability();
        EmployeeAvailabilityDTO mapped = new EmployeeAvailabilityDTO();

        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(availabilityRepository.findByEmployeeIdAndDateBetweenAndCompanyId(employeeId, start, end, company.getId()))
                .thenReturn(List.of(availability));
        when(modelMapper.map(availability, EmployeeAvailabilityDTO.class)).thenReturn(mapped);

        List<EmployeeAvailabilityDTO> result = employeeService.getEmployeeAvailability(employeeId, start, end);
        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("getEmployeeById maps skills and ignores null-skill entries")
    void getEmployeeById_mapsSkills() {
        User user = new User();
        user.setId(userId);
        Skill java = new Skill();
        java.setId(UUID.randomUUID());
        java.setName("Java");
        java.setCategory("Backend");

        EmployeeSkill valid = new EmployeeSkill();
        valid.setId(UUID.randomUUID());
        valid.setSkill(java);
        valid.setProficiencyLevel(4);

        EmployeeSkill invalid = new EmployeeSkill();
        invalid.setId(UUID.randomUUID());
        invalid.setSkill(null);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(user);
        employee.setFirstName("A");
        employee.setLastName("B");
        employee.setEmployeeSkills(List.of(valid, invalid));

        when(employeeRepository.findByIdWithSkills(employeeId)).thenReturn(Optional.of(employee));

        EmployeeDTO dto = employeeService.getEmployeeById(employeeId);
        assertEquals(employeeId, dto.getId());
        assertEquals(1, dto.getSkills().size());
        assertEquals("Java", dto.getSkills().get(0).getSkillName());
    }

    @Test
    @DisplayName("getAllEmployees keeps salary visible for admin caller")
    void getAllEmployees_adminCanSeeSalary() {
        User admin = new User();
        admin.setId(userId);
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);

        User employeeUser = new User();
        employeeUser.setId(UUID.randomUUID());
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(employeeUser);
        EmployeeDTO dto = new EmployeeDTO();
        dto.setId(employeeId);
        dto.setHourlyRate(BigDecimal.valueOf(50));

        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        when(employeeRepository.findByCompanyIdWithSkills(company.getId())).thenReturn(List.of(employee));
        when(employeeSkillRepository.findByEmployeeIdIn(List.of(employeeId))).thenReturn(List.of());
        when(modelMapper.map(employee, EmployeeDTO.class)).thenReturn(dto);

        List<EmployeeDTO> result = employeeService.getAllEmployees(userId);
        assertEquals(1, result.size());
        assertEquals(BigDecimal.valueOf(50), result.get(0).getHourlyRate());
    }

    @Test
    @DisplayName("getEmployeeWorkload computes weighted hours and status")
    void getEmployeeWorkload_weightedStatus() {
        UUID requesterId = UUID.randomUUID();
        User requester = new User();
        requester.setId(requesterId);
        requester.setRole(UserRole.MANAGER);
        requester.setCompany(company);

        Team team = new Team();
        team.setId(UUID.randomUUID());
        User empUser = new User();
        empUser.setRole(UserRole.EMPLOYEE);
        empUser.setCompany(company);
        empUser.setTeam(team);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(empUser);
        employee.setFirstName("John");
        employee.setLastName("Doe");
        employee.setMaxWeeklyHours(40);

        Task big = new Task();
        big.setId(UUID.randomUUID());
        big.setTitle("Big task");
        big.setStatus(TaskStatus.IN_PROGRESS);
        big.setEstimatedHours(BigDecimal.valueOf(72));
        big.setAssignedEmployeeId(employeeId);

        Task done = new Task();
        done.setId(UUID.randomUUID());
        done.setTitle("Done");
        done.setStatus(TaskStatus.COMPLETED);
        done.setEstimatedHours(BigDecimal.valueOf(8));
        done.setAssignedEmployeeId(employeeId);

        Task request = new Task();
        request.setId(UUID.randomUUID());
        request.setTitle("[REQUEST] hidden");
        request.setStatus(TaskStatus.PENDING);
        request.setAssignedEmployeeId(employeeId);

        when(userRepository.findById(requesterId)).thenReturn(Optional.of(requester));
        when(taskRepository.findByCompanyId(company.getId())).thenReturn(List.of(big, done, request));
        when(taskAssignmentRepository.findByCompanyIdAndStatus(company.getId(), TaskAssignmentStatus.ACCEPTED))
                .thenReturn(List.of());
        when(employeeRepository.findByCompanyIdWithTeam(company.getId())).thenReturn(List.of(employee));

        var workloads = employeeService.getEmployeeWorkload(requesterId);
        assertEquals(1, workloads.size());
        assertEquals(1, workloads.get(0).getActiveTasks());
        assertEquals(1, workloads.get(0).getCompletedTasks());
        assertEquals("OPTIMAL", workloads.get(0).getStatus());
    }

    @Test
    @DisplayName("createEmployee cleans orphaned profile and retries creation")
    void createEmployee_orphanedProfile_cleanupAndRetry() {
        User user = new User();
        user.setId(userId);
        user.setRole(UserRole.USER);
        user.setCompany(company);

        Employee orphan = new Employee();
        orphan.setId(employeeId);
        orphan.setUser(null);

        EmployeeCreateDTO dto = new EmployeeCreateDTO();
        dto.setUserId(userId);
        dto.setFirstName("Jane");
        dto.setLastName("Doe");
        dto.setDepartment("Ops");
        dto.setPosition("Analyst");

        Employee saved = new Employee();
        saved.setId(UUID.randomUUID());
        saved.setUser(user);

        EmployeeDTO mapped = new EmployeeDTO();
        mapped.setId(saved.getId());

        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.of(orphan), Optional.empty());
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(employeeRepository.saveAndFlush(any(Employee.class))).thenReturn(saved);
        when(modelMapper.map(saved, EmployeeDTO.class)).thenReturn(mapped);

        TransactionSynchronizationManager.initSynchronization();
        try {
            EmployeeDTO result = employeeService.createEmployee(dto);
            assertEquals(saved.getId(), result.getId());
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        verify(employeeSkillRepository).deleteByEmployeeId(employeeId);
        verify(availabilityRepository).deleteByEmployeeId(employeeId);
        verify(taskAssignmentRepository).deleteByEmployeeId(employeeId);
        verify(employeeRepository).delete(orphan);
        verify(userRepository).saveAndFlush(user);
        verify(notificationService).createNotification(any());
    }

    @Test
    @DisplayName("updateEmployee broadcasts profile update event after commit")
    void updateEmployee_afterCommitBroadcasts() {
        User user = new User();
        user.setId(userId);
        user.setCompany(company);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(user);
        employee.setFirstName("Old");

        EmployeeCreateDTO dto = new EmployeeCreateDTO();
        dto.setFirstName("New");
        dto.setProfileImageUrl("https://img/new.png");

        EmployeeDTO mapped = new EmployeeDTO();
        mapped.setId(employeeId);

        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(employeeRepository.save(any(Employee.class))).thenReturn(employee);
        when(modelMapper.map(employee, EmployeeDTO.class)).thenReturn(mapped);

        TransactionSynchronizationManager.initSynchronization();
        try {
            EmployeeDTO result = employeeService.updateEmployee(employeeId, dto);
            assertEquals(employeeId, result.getId());
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        verify(messagingTemplate).convertAndSendToUser(eq(userId.toString()), eq("/queue/profile-update"),
                any(Map.class));
        verify(messagingTemplate).convertAndSend(eq("/topic/profile-updates"), any(Map.class));
    }

    @Test
    @DisplayName("getEmployeeByUserId maps eager-loaded employee with skills")
    void getEmployeeByUserId_mapsSkills() {
        Skill skill = new Skill();
        skill.setId(UUID.randomUUID());
        skill.setName("React");
        skill.setCategory("Frontend");

        EmployeeSkill employeeSkill = new EmployeeSkill();
        employeeSkill.setId(UUID.randomUUID());
        employeeSkill.setSkill(skill);
        employeeSkill.setProficiencyLevel(4);

        User user = new User();
        user.setId(userId);
        user.setCompany(company);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(user);
        employee.setFirstName("Test");
        employee.setLastName("User");
        employee.setEmployeeSkills(List.of(employeeSkill));

        when(employeeRepository.findByUserIdWithSkills(userId)).thenReturn(Optional.of(employee));

        EmployeeDTO dto = employeeService.getEmployeeByUserId(userId);
        assertEquals(employeeId, dto.getId());
        assertEquals(1, dto.getSkills().size());
        assertEquals("React", dto.getSkills().get(0).getSkillName());
    }

    @Test
    @DisplayName("getEmployeesPaginated keeps salary visible for manager")
    void getEmployeesPaginated_managerKeepsSalary() {
        User requester = new User();
        requester.setId(userId);
        requester.setRole(UserRole.MANAGER);
        requester.setCompany(company);

        User employeeUser = new User();
        employeeUser.setId(UUID.randomUUID());
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(employeeUser);

        EmployeeDTO mapped = new EmployeeDTO();
        mapped.setId(employeeId);
        mapped.setHourlyRate(BigDecimal.valueOf(55));

        var pageable = PageRequest.of(0, 10);
        when(userRepository.findById(userId)).thenReturn(Optional.of(requester));
        when(employeeRepository.findByCompanyIdWithFiltersNative(company.getId(), "ENG", "DEV", "jo", pageable))
                .thenReturn(new PageImpl<>(List.of(employee), pageable, 1));
        when(employeeSkillRepository.findByEmployeeIdIn(List.of(employeeId))).thenReturn(List.of());
        when(modelMapper.map(employee, EmployeeDTO.class)).thenReturn(mapped);

        var page = employeeService.getEmployeesPaginated(userId, pageable, "ENG", "DEV", "jo");
        assertEquals(1, page.getContent().size());
        assertEquals(BigDecimal.valueOf(55), page.getContent().get(0).getHourlyRate());
    }

    @Test
    @DisplayName("getEmployeesByDepartment maps repository results")
    void getEmployeesByDepartment_mapsResults() {
        User requester = new User();
        requester.setId(userId);
        requester.setCompany(company);

        Employee employee = new Employee();
        employee.setId(employeeId);
        EmployeeDTO dto = new EmployeeDTO();
        dto.setId(employeeId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(requester));
        when(employeeRepository.findByDepartmentAndCompanyId("Engineering", company.getId()))
                .thenReturn(List.of(employee));
        when(modelMapper.map(employee, EmployeeDTO.class)).thenReturn(dto);

        List<EmployeeDTO> result = employeeService.getEmployeesByDepartment("Engineering", userId);
        assertEquals(1, result.size());
        assertEquals(employeeId, result.get(0).getId());
    }

    @Test
    @DisplayName("addSkillToEmployee creates mapping with defaults when optional fields null")
    void addSkillToEmployee_createsWithDefaults() {
        UUID skillId = UUID.randomUUID();
        Skill skill = new Skill();
        skill.setId(skillId);
        skill.setName("SQL");
        skill.setCategory("Data");

        Employee employee = new Employee();
        employee.setId(employeeId);

        EmployeeSkillDTO input = new EmployeeSkillDTO();
        input.setSkillId(skillId);
        input.setProficiencyLevel(null);
        input.setYearsOfExperience(null);
        input.setLastUsed(null);

        EmployeeSkill saved = new EmployeeSkill();
        saved.setId(UUID.randomUUID());
        saved.setSkill(skill);
        saved.setEmployee(employee);
        saved.setProficiencyLevel(3);
        saved.setYearsOfExperience(BigDecimal.ZERO);

        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(skillRepository.findById(skillId)).thenReturn(Optional.of(skill));
        when(employeeSkillRepository.findByEmployeeIdAndSkillId(employeeId, skillId)).thenReturn(Optional.empty());
        when(employeeSkillRepository.saveAndFlush(any(EmployeeSkill.class))).thenReturn(saved);
        when(employeeSkillRepository.existsById(saved.getId())).thenReturn(true);

        EmployeeSkillDTO result = employeeService.addSkillToEmployee(employeeId, input);
        assertNotNull(result.getId());
        assertEquals(skillId, result.getSkillId());
        assertEquals("SQL", result.getSkillName());
        assertEquals(3, result.getProficiencyLevel());
        assertEquals(BigDecimal.ZERO, result.getYearsOfExperience());
    }
}
