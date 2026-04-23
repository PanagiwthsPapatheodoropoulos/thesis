package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.exception.BadRequestException;
import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.DepartmentCreateDTO;
import com.thesis.smart_resource_planner.model.dto.DepartmentDTO;
import com.thesis.smart_resource_planner.model.dto.EmployeeDTO;
import com.thesis.smart_resource_planner.model.entity.Department;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.DepartmentRepository;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Service for department management operations.
 *
 * <p>
 * Provides CRUD operations on departments scoped to a company,
 * including employee headcount enrichment and name-based lookups.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class DepartmentService {

        private final DepartmentRepository departmentRepository;
        private final EmployeeRepository employeeRepository;
        private final EmployeeService employeeService;
        private final ModelMapper modelMapper;
        private final UserRepository userRepository;

        /**
         * Creates a new department within the requesting user's company.
         *
         * @param createDTO DTO containing name and description of the new department
         * @param userId    UUID of the requesting user (determines company scope)
         * @return the persisted {@link DepartmentDTO} with employee count initialised
         *         to 0
         * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException  if
         *                                                                                the
         *                                                                                user
         *                                                                                does
         *                                                                                not
         *                                                                                exist
         * @throws com.thesis.smart_resource_planner.exception.DuplicateResourceException if
         *                                                                                a
         *                                                                                department
         *                                                                                with
         *                                                                                the
         *                                                                                same
         *                                                                                name
         *                                                                                already
         *                                                                                exists
         *                                                                                in
         *                                                                                the
         *                                                                                company
         */
        public DepartmentDTO createDepartment(DepartmentCreateDTO createDTO, UUID userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                // Check within company only
                if (departmentRepository.existsByNameAndCompanyId(createDTO.getName(), user.getCompany().getId())) {
                        throw new DuplicateResourceException(
                                        "Department with this name already exists in your company");
                }

                Department department = new Department();
                department.setName(createDTO.getName());
                department.setDescription(createDTO.getDescription());
                department.setCompany(user.getCompany());

                Department saved = departmentRepository.save(department);
                DepartmentDTO dto = modelMapper.map(saved, DepartmentDTO.class);
                dto.setEmployeeCount(0);
                dto.setEmployees(List.of());

                return dto;
        }

        /**
         * Returns all departments belonging to the requesting user's company,
         * each enriched with its employee list and count.
         *
         * @param userId UUID of the requesting user
         * @return list of {@link DepartmentDTO} objects with employees populated
         */
        public List<DepartmentDTO> getAllDepartments(UUID userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                List<Department> departments = departmentRepository.findByCompanyId(user.getCompany().getId());
                return departments.stream()
                                // Pass userId to the helper
                                .map(department -> mapToDTOWithEmployees(department, userId))
                                .toList();
        }

        /**
         * Retrieves a single department by name within the requesting user's company.
         *
         * @param name   the department name to look up
         * @param userId UUID of the requesting user
         * @return the matching {@link DepartmentDTO} with employee details
         * @throws com.thesis.smart_resource_planner.exception.BadRequestException       if
         *                                                                               the
         *                                                                               name
         *                                                                               is
         *                                                                               null,
         *                                                                               blank,
         *                                                                               or
         *                                                                               exceeds
         *                                                                               100
         *                                                                               characters
         * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
         *                                                                               the
         *                                                                               department
         *                                                                               does
         *                                                                               not
         *                                                                               exist
         *                                                                               in
         *                                                                               the
         *                                                                               user's
         *                                                                               company
         */
        @Transactional(readOnly = true)
        public DepartmentDTO getDepartmentByName(String name, UUID userId) {

                if (name == null || name.trim().isEmpty() || name.length() > 100) {
                        throw new BadRequestException("Invalid department name");
                }

                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                Department department = departmentRepository.findByNameAndCompanyId(name, user.getCompany().getId())
                                .orElseThrow(() -> new ResourceNotFoundException("Department not found: " + name));

                return mapToDTOWithEmployees(department, userId);
        }

        /**
         * Returns an alphabetically sorted list of department names for the requesting
         * user's company.
         *
         * @param userId UUID of the requesting user
         * @return sorted list of department name strings
         */
        @Transactional(readOnly = true)
        public List<String> getDepartmentNames(UUID userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                // Find departments by company ID only
                List<Department> departments = departmentRepository.findByCompanyId(user.getCompany().getId());

                return departments.stream()
                                .map(Department::getName)
                                .sorted()
                                .toList();
        }

        /**
         * Deletes a department from the requesting user's company.
         * Deletion is blocked if the department still has employees.
         *
         * @param name   the name of the department to delete
         * @param userId UUID of the requesting user
         * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
         *                                                                               the
         *                                                                               department
         *                                                                               does
         *                                                                               not
         *                                                                               exist
         * @throws IllegalStateException                                                 if
         *                                                                               the
         *                                                                               department
         *                                                                               still
         *                                                                               contains
         *                                                                               employees
         */
        public void deleteDepartment(String name, UUID userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                // Find department by name AND company ID
                Department department = departmentRepository
                                .findByNameAndCompanyId(name, user.getCompany().getId())
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Department not found in your company: " + name));

                // Check if department has employees
                List<EmployeeDTO> employees = employeeService.getEmployeesByDepartment(name, userId);
                if (!employees.isEmpty()) {
                        throw new IllegalStateException(
                                        "Cannot delete department with existing employees. " +
                                                        "Please reassign or remove " + employees.size()
                                                        + " employee(s) first.");
                }

                departmentRepository.delete(department);
        }

        /**
         * Helper that maps a {@link Department} to a {@link DepartmentDTO}
         * and populates the employee list and count.
         *
         * @param department the department entity
         * @param userId     UUID used to scope the employee lookup
         * @return enriched {@link DepartmentDTO}
         */
        private DepartmentDTO mapToDTOWithEmployees(Department department, UUID userId) {
                DepartmentDTO dto = modelMapper.map(department, DepartmentDTO.class);

                List<EmployeeDTO> employees = employeeService.getEmployeesByDepartment(
                                department.getName(),
                                userId);

                dto.setEmployeeCount(employees.size());
                dto.setEmployees(employees);

                return dto;
        }
}