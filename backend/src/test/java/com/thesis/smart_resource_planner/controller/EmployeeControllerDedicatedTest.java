package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.EmployeeCreateDTO;
import com.thesis.smart_resource_planner.model.dto.EmployeeAvailabilityDTO;
import com.thesis.smart_resource_planner.model.dto.EmployeeSkillDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.EmployeeSkill;
import com.thesis.smart_resource_planner.model.entity.Skill;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.repository.EmployeeSkillRepository;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.EmployeeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmployeeControllerDedicatedTest {

    @Mock
    private EmployeeService employeeService;
    @Mock
    private EmployeeRepository employeeRepository;
    @Mock
    private EmployeeSkillRepository employeeSkillRepository;

    @InjectMocks
    private EmployeeController employeeController;

    private UUID companyId;
    private UUID employeeId;
    private UUID ownerUserId;
    private UserPrincipal employeePrincipal;

    @BeforeEach
    void setUp() {
        companyId = UUID.randomUUID();
        employeeId = UUID.randomUUID();
        ownerUserId = UUID.randomUUID();

        Company company = new Company();
        company.setId(companyId);

        User user = new User();
        user.setId(ownerUserId);
        user.setUsername("emp");
        user.setEmail("emp@example.com");
        user.setPasswordHash("hash");
        user.setRole(UserRole.EMPLOYEE);
        user.setCompany(company);
        user.setIsActive(true);
        employeePrincipal = UserPrincipal.create(user);
    }

    @Test
    @DisplayName("getEmployeeSkills throws when employee does not exist")
    void getEmployeeSkills_notFound_throws() {
        when(employeeRepository.existsById(employeeId)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> employeeController.getEmployeeSkills(employeeId, "simple"));
    }

    @Test
    @DisplayName("getEmployeeSkills detailed returns empty map payload")
    void getEmployeeSkills_detailedEmpty_returnsPayload() {
        when(employeeRepository.existsById(employeeId)).thenReturn(true);
        when(employeeSkillRepository.findByEmployeeId(employeeId)).thenReturn(List.of());

        ResponseEntity<?> response = employeeController.getEmployeeSkills(employeeId, "detailed");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof Map);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertTrue(body.containsKey("skillsById"));
        assertTrue(body.containsKey("skillsByName"));
    }

    @Test
    @DisplayName("getEmployeeSkills simple maps skill dto list")
    void getEmployeeSkills_simple_mapsSkills() {
        when(employeeRepository.existsById(employeeId)).thenReturn(true);
        Skill skill = new Skill();
        skill.setId(UUID.randomUUID());
        skill.setName("Java");
        skill.setCategory("Backend");
        EmployeeSkill es = new EmployeeSkill();
        es.setId(UUID.randomUUID());
        es.setSkill(skill);
        es.setProficiencyLevel(4);
        es.setYearsOfExperience(java.math.BigDecimal.valueOf(3));

        when(employeeSkillRepository.findByEmployeeId(employeeId)).thenReturn(List.of(es));

        ResponseEntity<?> response = employeeController.getEmployeeSkills(employeeId, "simple");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof List);
        assertEquals(1, ((List<?>) response.getBody()).size());
    }

    @Test
    @DisplayName("getEmployeeSkillsBatch returns maps for valid and missing employees")
    void getEmployeeSkillsBatch_mixedInputs_success() {
        UUID validEmpId = UUID.randomUUID();
        UUID missingEmpId = UUID.randomUUID();

        Company company = new Company();
        company.setId(companyId);
        User owner = new User();
        owner.setCompany(company);
        Employee validEmployee = new Employee();
        validEmployee.setId(validEmpId);
        validEmployee.setUser(owner);

        Skill skill = new Skill();
        skill.setName("React");
        EmployeeSkill es = new EmployeeSkill();
        es.setEmployee(validEmployee);
        es.setSkill(skill);
        es.setProficiencyLevel(5);

        when(employeeSkillRepository.findByEmployeeIdIn(any())).thenReturn(List.of(es));
        when(employeeRepository.findById(any(UUID.class))).thenReturn(Optional.empty());
        when(employeeRepository.findById(validEmpId)).thenReturn(Optional.of(validEmployee));

        ResponseEntity<Map<String, Map<String, Integer>>> response = employeeController.getEmployeeSkillsBatch(
                List.of(validEmpId.toString(), missingEmpId.toString()),
                "simple",
                employeePrincipal);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().containsKey(validEmpId.toString()));
        assertEquals(5, response.getBody().get(validEmpId.toString()).get("React"));
        assertTrue(response.getBody().containsKey(missingEmpId.toString()));
    }

    @Test
    @DisplayName("getEmployeeSkillsBatch returns 500 on invalid UUID input")
    void getEmployeeSkillsBatch_invalidUuid_returnsInternalServerError() {
        ResponseEntity<Map<String, Map<String, Integer>>> response = employeeController.getEmployeeSkillsBatch(
                List.of("not-a-uuid"),
                "simple",
                employeePrincipal);
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
    }

    @Test
    @DisplayName("getEmployeeSkillsBatch returns 500 on repository failure")
    void getEmployeeSkillsBatch_exception_returnsInternalServerError() {
        when(employeeSkillRepository.findByEmployeeIdIn(any())).thenThrow(new RuntimeException("db"));
        ResponseEntity<Map<String, Map<String, Integer>>> response = employeeController.getEmployeeSkillsBatch(
                List.of(UUID.randomUUID().toString()),
                "simple",
                employeePrincipal);
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
    }

    @Test
    @DisplayName("updateEmployee returns forbidden for non-owner employee")
    void updateEmployee_nonOwnerEmployee_forbidden() {
        UUID targetEmpId = UUID.randomUUID();
        User targetUser = new User();
        targetUser.setId(UUID.randomUUID());
        Employee targetEmployee = new Employee();
        targetEmployee.setId(targetEmpId);
        targetEmployee.setUser(targetUser);
        when(employeeRepository.findById(targetEmpId)).thenReturn(Optional.of(targetEmployee));

        ResponseEntity<?> response = employeeController.updateEmployee(targetEmpId, new EmployeeCreateDTO(), employeePrincipal);
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(employeeService, never()).updateEmployee(any(), any());
    }

    @Test
    @DisplayName("addSkillToEmployee returns forbidden for non-owner employee")
    void addSkillToEmployee_nonOwnerEmployee_forbidden() {
        UUID targetEmpId = UUID.randomUUID();
        User targetUser = new User();
        targetUser.setId(UUID.randomUUID());
        Employee targetEmployee = new Employee();
        targetEmployee.setId(targetEmpId);
        targetEmployee.setUser(targetUser);
        when(employeeRepository.findById(targetEmpId)).thenReturn(Optional.of(targetEmployee));

        ResponseEntity<EmployeeSkillDTO> response = employeeController.addSkillToEmployee(
                targetEmpId, new EmployeeSkillDTO(), employeePrincipal);
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(employeeService, never()).addSkillToEmployee(any(), any());
    }

    @Test
    @DisplayName("removeSkillFromEmployee returns forbidden for non-owner employee")
    void removeSkillFromEmployee_nonOwnerEmployee_forbidden() {
        UUID targetEmpId = UUID.randomUUID();
        UUID skillId = UUID.randomUUID();
        User targetUser = new User();
        targetUser.setId(UUID.randomUUID());
        Employee targetEmployee = new Employee();
        targetEmployee.setId(targetEmpId);
        targetEmployee.setUser(targetUser);
        when(employeeRepository.findById(targetEmpId)).thenReturn(Optional.of(targetEmployee));

        ResponseEntity<Void> response = employeeController.removeSkillFromEmployee(
                targetEmpId, skillId, employeePrincipal);
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(employeeService, never()).removeSkillFromEmployee(any(), any());
    }

    @Test
    @DisplayName("updateEmployee allows owner to update profile")
    void updateEmployee_owner_success() {
        Employee ownEmployee = new Employee();
        ownEmployee.setId(employeeId);
        User owner = new User();
        owner.setId(ownerUserId);
        ownEmployee.setUser(owner);
        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(ownEmployee));
        when(employeeService.updateEmployee(eq(employeeId), any(EmployeeCreateDTO.class)))
                .thenReturn(new com.thesis.smart_resource_planner.model.dto.EmployeeDTO());

        ResponseEntity<?> response = employeeController.updateEmployee(employeeId, new EmployeeCreateDTO(), employeePrincipal);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(employeeService).updateEmployee(eq(employeeId), any(EmployeeCreateDTO.class));
    }

    @Test
    @DisplayName("addSkillToEmployee allows owner and returns created")
    void addSkillToEmployee_owner_success() {
        Employee ownEmployee = new Employee();
        ownEmployee.setId(employeeId);
        User owner = new User();
        owner.setId(ownerUserId);
        ownEmployee.setUser(owner);
        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(ownEmployee));
        when(employeeService.addSkillToEmployee(eq(employeeId), any(EmployeeSkillDTO.class)))
                .thenReturn(new EmployeeSkillDTO());

        ResponseEntity<EmployeeSkillDTO> response = employeeController.addSkillToEmployee(
                employeeId, new EmployeeSkillDTO(), employeePrincipal);
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        verify(employeeService).addSkillToEmployee(eq(employeeId), any(EmployeeSkillDTO.class));
    }

    @Test
    @DisplayName("removeSkillFromEmployee allows owner and returns no content")
    void removeSkillFromEmployee_owner_success() {
        UUID skillId = UUID.randomUUID();
        Employee ownEmployee = new Employee();
        ownEmployee.setId(employeeId);
        User owner = new User();
        owner.setId(ownerUserId);
        ownEmployee.setUser(owner);
        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(ownEmployee));

        ResponseEntity<Void> response = employeeController.removeSkillFromEmployee(employeeId, skillId, employeePrincipal);
        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(employeeService).removeSkillFromEmployee(employeeId, skillId);
    }

    @Test
    @DisplayName("getEmployeeSkills detailed returns maps when skills exist")
    void getEmployeeSkills_detailedWithData_returnsMaps() {
        when(employeeRepository.existsById(employeeId)).thenReturn(true);
        Skill skill = new Skill();
        UUID skillId = UUID.randomUUID();
        skill.setId(skillId);
        skill.setName("Java");

        EmployeeSkill one = new EmployeeSkill();
        one.setId(UUID.randomUUID());
        one.setSkill(skill);
        one.setProficiencyLevel(4);

        EmployeeSkill two = new EmployeeSkill();
        two.setId(UUID.randomUUID());
        two.setSkill(skill);
        two.setProficiencyLevel(5);

        when(employeeSkillRepository.findByEmployeeId(employeeId)).thenReturn(List.of(one, two));

        ResponseEntity<?> response = employeeController.getEmployeeSkills(employeeId, "detailed");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertTrue(body.containsKey("skills"));
        assertTrue(body.containsKey("skillsById"));
        assertTrue(body.containsKey("skillsByName"));
    }

    @Test
    @DisplayName("availability endpoints delegate to service")
    void availabilityEndpoints_delegate() {
        EmployeeAvailabilityDTO dto = new EmployeeAvailabilityDTO();
        dto.setEmployeeId(employeeId);
        dto.setDate(LocalDate.now());
        when(employeeService.setEmployeeAvailability(any(EmployeeAvailabilityDTO.class))).thenReturn(dto);
        when(employeeService.getEmployeeAvailability(eq(employeeId), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(dto));

        ResponseEntity<EmployeeAvailabilityDTO> saveResponse = employeeController.setEmployeeAvailability(employeeId, dto);
        assertEquals(HttpStatus.OK, saveResponse.getStatusCode());

        ResponseEntity<List<EmployeeAvailabilityDTO>> listResponse = employeeController.getEmployeeAvailability(
                employeeId, LocalDate.now().minusDays(1), LocalDate.now().plusDays(1));
        assertEquals(HttpStatus.OK, listResponse.getStatusCode());
        assertEquals(1, listResponse.getBody().size());
    }
}
