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
@DisplayName("DepartmentService Tests")
class DepartmentServiceDedicatedTest {

    @Mock
    private DepartmentRepository departmentRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @Mock
    private EmployeeService employeeService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ModelMapper modelMapper;

    @InjectMocks
    private DepartmentService departmentService;

    private UUID userId;
    private Company company;
    private User user;
    private Department department;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        company = new Company();
        company.setId(UUID.randomUUID());

        user = new User();
        user.setId(userId);
        user.setCompany(company);

        department = new Department();
        department.setId(UUID.randomUUID());
        department.setName("Engineering");
        department.setDescription("Software Engineering");
        department.setCompany(company);
    }

    @Test
    @DisplayName("createDepartment: creates within user's company")
    void createDepartment_success() {
        DepartmentCreateDTO createDTO = new DepartmentCreateDTO("Engineering", "Software Engineering");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.existsByNameAndCompanyId("Engineering", company.getId())).thenReturn(false);
        when(departmentRepository.save(any(Department.class))).thenReturn(department);

        DepartmentDTO mapped = new DepartmentDTO();
        mapped.setName("Engineering");
        mapped.setDescription("Software Engineering");
        when(modelMapper.map(department, DepartmentDTO.class)).thenReturn(mapped);

        DepartmentDTO result = departmentService.createDepartment(createDTO, userId);

        assertEquals("Engineering", result.getName());
        assertEquals(0, result.getEmployeeCount());
        assertNotNull(result.getEmployees());
        verify(departmentRepository).save(any(Department.class));
    }

    @Test
    @DisplayName("createDepartment: throws on duplicate name in company")
    void createDepartment_duplicateName() {
        DepartmentCreateDTO createDTO = new DepartmentCreateDTO("Engineering", "Software Engineering");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.existsByNameAndCompanyId("Engineering", company.getId())).thenReturn(true);

        assertThrows(DuplicateResourceException.class, () -> departmentService.createDepartment(createDTO, userId));
    }

    @Test
    @DisplayName("getAllDepartments: returns departments enriched with employees")
    void getAllDepartments_success() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.findByCompanyId(company.getId())).thenReturn(List.of(department));

        DepartmentDTO mapped = new DepartmentDTO();
        mapped.setName("Engineering");
        mapped.setDescription("Software Engineering");
        when(modelMapper.map(department, DepartmentDTO.class)).thenReturn(mapped);

        when(employeeService.getEmployeesByDepartment("Engineering", userId))
                .thenReturn(List.of(new EmployeeDTO()));

        List<DepartmentDTO> result = departmentService.getAllDepartments(userId);

        assertEquals(1, result.size());
        assertEquals(1, result.get(0).getEmployeeCount());
        verify(departmentRepository).findByCompanyId(company.getId());
    }

    @Test
    @DisplayName("getDepartmentByName: validates name")
    void getDepartmentByName_invalidName() {
        assertThrows(BadRequestException.class, () -> departmentService.getDepartmentByName(" ", userId));
        assertThrows(BadRequestException.class, () -> departmentService.getDepartmentByName(null, userId));
    }

    @Test
    @DisplayName("deleteDepartment: blocks deletion when employees exist")
    void deleteDepartment_blocksWhenEmployeesExist() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.findByNameAndCompanyId("Engineering", company.getId()))
                .thenReturn(Optional.of(department));
        when(employeeService.getEmployeesByDepartment("Engineering", userId))
                .thenReturn(List.of(new EmployeeDTO()));

        assertThrows(IllegalStateException.class, () -> departmentService.deleteDepartment("Engineering", userId));
        verify(departmentRepository, never()).delete(any());
    }

    @Test
    @DisplayName("getDepartmentByName: throws when department not found in company")
    void getDepartmentByName_notFound() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.findByNameAndCompanyId("Unknown", company.getId())).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> departmentService.getDepartmentByName("Unknown", userId));
    }

    @Test
    @DisplayName("getDepartmentNames: returns alphabetically sorted names")
    void getDepartmentNames_sorted() {
        Department a = new Department();
        a.setName("Accounting");
        Department z = new Department();
        z.setName("Zoology");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.findByCompanyId(company.getId())).thenReturn(List.of(z, department, a));

        List<String> names = departmentService.getDepartmentNames(userId);
        assertEquals(List.of("Accounting", "Engineering", "Zoology"), names);
    }

    @Test
    @DisplayName("deleteDepartment: deletes when no employees are assigned")
    void deleteDepartment_success() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(departmentRepository.findByNameAndCompanyId("Engineering", company.getId()))
                .thenReturn(Optional.of(department));
        when(employeeService.getEmployeesByDepartment("Engineering", userId))
                .thenReturn(List.of());

        departmentService.deleteDepartment("Engineering", userId);
        verify(departmentRepository).delete(department);
    }
}
