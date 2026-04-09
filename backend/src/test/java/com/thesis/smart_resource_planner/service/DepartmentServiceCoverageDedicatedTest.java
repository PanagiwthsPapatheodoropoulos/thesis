package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.exception.BadRequestException;
import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.DepartmentCreateDTO;
import com.thesis.smart_resource_planner.model.dto.DepartmentDTO;
import com.thesis.smart_resource_planner.model.dto.EmployeeDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Department;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.DepartmentRepository;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("DepartmentService Coverage - Gap Tests")
class DepartmentServiceCoverageDedicatedTest {

    @Mock private DepartmentRepository departmentRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private EmployeeService employeeService;
    @Mock private ModelMapper modelMapper;
    @Mock private UserRepository userRepository;

    @InjectMocks private DepartmentService departmentService;

    private UUID userId;
    private User user;
    private Company company;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        company = new Company();
        company.setId(UUID.randomUUID());
        user = new User();
        user.setId(userId);
        user.setCompany(company);
    }

    @Test
    @DisplayName("createDepartment success creates and returns DTO with zero count")
    void createDepartment_success() {
        DepartmentCreateDTO createDTO = new DepartmentCreateDTO();
        createDTO.setName("Engineering");
        createDTO.setDescription("Dev dept");

        Department saved = new Department();
        saved.setName("Engineering");
        DepartmentDTO mapped = new DepartmentDTO();
        mapped.setName("Engineering");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.existsByNameAndCompanyId("Engineering", company.getId())).thenReturn(false);
        when(departmentRepository.save(any(Department.class))).thenReturn(saved);
        when(modelMapper.map(saved, DepartmentDTO.class)).thenReturn(mapped);

        DepartmentDTO result = departmentService.createDepartment(createDTO, userId);
        assertEquals(0, result.getEmployeeCount());
        assertTrue(result.getEmployees().isEmpty());
    }

    @Test
    @DisplayName("createDepartment throws duplicate for existing department name")
    void createDepartment_duplicate_throws() {
        DepartmentCreateDTO createDTO = new DepartmentCreateDTO();
        createDTO.setName("Dupe");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.existsByNameAndCompanyId("Dupe", company.getId())).thenReturn(true);

        assertThrows(DuplicateResourceException.class, () -> departmentService.createDepartment(createDTO, userId));
    }

    @Test
    @DisplayName("createDepartment throws when user not found")
    void createDepartment_userNotFound_throws() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class,
                () -> departmentService.createDepartment(new DepartmentCreateDTO(), userId));
    }

    @Test
    @DisplayName("getAllDepartments returns departments with employee counts")
    void getAllDepartments_mapsWithEmployees() {
        Department dept = new Department();
        dept.setName("Sales");
        DepartmentDTO mapped = new DepartmentDTO();
        mapped.setName("Sales");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.findByCompanyId(company.getId())).thenReturn(List.of(dept));
        when(modelMapper.map(dept, DepartmentDTO.class)).thenReturn(mapped);
        when(employeeService.getEmployeesByDepartment("Sales", userId)).thenReturn(List.of(new EmployeeDTO()));

        List<DepartmentDTO> result = departmentService.getAllDepartments(userId);
        assertEquals(1, result.size());
        assertEquals(1, result.get(0).getEmployeeCount());
    }

    @Test
    @DisplayName("getDepartmentByName validates null name")
    void getDepartmentByName_null_throws() {
        assertThrows(BadRequestException.class, () -> departmentService.getDepartmentByName(null, userId));
    }

    @Test
    @DisplayName("getDepartmentByName validates empty name")
    void getDepartmentByName_empty_throws() {
        assertThrows(BadRequestException.class, () -> departmentService.getDepartmentByName("   ", userId));
    }

    @Test
    @DisplayName("getDepartmentByName validates name length > 100")
    void getDepartmentByName_tooLong_throws() {
        String longName = "A".repeat(101);
        assertThrows(BadRequestException.class, () -> departmentService.getDepartmentByName(longName, userId));
    }

    @Test
    @DisplayName("getDepartmentByName returns DTO with employees for valid name")
    void getDepartmentByName_success() {
        Department dept = new Department();
        dept.setName("HR");
        DepartmentDTO mapped = new DepartmentDTO();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.findByNameAndCompanyId("HR", company.getId())).thenReturn(Optional.of(dept));
        when(modelMapper.map(dept, DepartmentDTO.class)).thenReturn(mapped);
        when(employeeService.getEmployeesByDepartment("HR", userId)).thenReturn(List.of());

        DepartmentDTO result = departmentService.getDepartmentByName("HR", userId);
        assertNotNull(result);
        assertEquals(0, result.getEmployeeCount());
    }

    @Test
    @DisplayName("getDepartmentByName throws when department not found")
    void getDepartmentByName_notFound_throws() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.findByNameAndCompanyId("Missing", company.getId())).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> departmentService.getDepartmentByName("Missing", userId));
    }

    @Test
    @DisplayName("getDepartmentNames returns sorted names")
    void getDepartmentNames_sorted() {
        Department d1 = new Department();
        d1.setName("Zebra");
        Department d2 = new Department();
        d2.setName("Alpha");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.findByCompanyId(company.getId())).thenReturn(List.of(d1, d2));

        List<String> names = departmentService.getDepartmentNames(userId);
        assertEquals(2, names.size());
        assertEquals("Alpha", names.get(0));
        assertEquals("Zebra", names.get(1));
    }

    @Test
    @DisplayName("deleteDepartment throws when department has employees")
    void deleteDepartment_hasEmployees_throws() {
        Department dept = new Department();
        dept.setName("Active");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.findByNameAndCompanyId("Active", company.getId())).thenReturn(Optional.of(dept));
        when(employeeService.getEmployeesByDepartment("Active", userId)).thenReturn(List.of(new EmployeeDTO()));

        assertThrows(IllegalStateException.class, () -> departmentService.deleteDepartment("Active", userId));
        verify(departmentRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteDepartment succeeds when department is empty")
    void deleteDepartment_empty_deletes() {
        Department dept = new Department();
        dept.setName("Empty");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.findByNameAndCompanyId("Empty", company.getId())).thenReturn(Optional.of(dept));
        when(employeeService.getEmployeesByDepartment("Empty", userId)).thenReturn(List.of());

        departmentService.deleteDepartment("Empty", userId);
        verify(departmentRepository).delete(dept);
    }
}
