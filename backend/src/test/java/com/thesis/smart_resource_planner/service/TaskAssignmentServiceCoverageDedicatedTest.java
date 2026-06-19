package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.*;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.TaskAssignmentDTO;
import com.thesis.smart_resource_planner.model.dto.ai.TaskAssignmentRequestDTO;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TaskAssignmentService Coverage - Gap Tests")
class TaskAssignmentServiceCoverageDedicatedTest {

    @Mock private TaskAssignmentRepository assignmentRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private ModelMapper modelMapper;
    @Mock private WebSocketBroadcastService broadcastService;
    @Mock private UserRepository userRepository;

    @InjectMocks private TaskAssignmentService taskAssignmentService;

    @Test
    @DisplayName("assignTask creates assignment with default MANUAL assignedBy")
    void assignTask_defaultManual() {
        UUID taskId = UUID.randomUUID();
        UUID employeeId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        User empUser = new User();
        empUser.setId(userId);

        Task task = new Task();
        task.setId(taskId);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(empUser);

        TaskAssignmentRequestDTO request = new TaskAssignmentRequestDTO();
        request.setTaskId(taskId);
        request.setEmployeeId(employeeId);
        request.setAssignedBy(null);
        request.setAssignedByUserId(null);
        request.setFitScore(BigDecimal.valueOf(0.8));
        request.setConfidenceScore(BigDecimal.valueOf(0.9));
        request.setNotes("test");

        TaskAssignment saved = new TaskAssignment();
        saved.setId(UUID.randomUUID());
        TaskAssignmentDTO dto = new TaskAssignmentDTO();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(assignmentRepository.save(any(TaskAssignment.class))).thenReturn(saved);
        when(modelMapper.map(saved, TaskAssignmentDTO.class)).thenReturn(dto);

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskAssignmentDTO result = taskAssignmentService.assignTask(request);
            assertNotNull(result);
            verify(assignmentRepository).save(any(TaskAssignment.class));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("assignTask with AI assignedBy and user looks up user")
    void assignTask_withAiAssignedBy() {
        UUID taskId = UUID.randomUUID();
        UUID employeeId = UUID.randomUUID();
        UUID assignedByUserId = UUID.randomUUID();

        User empUser = new User();
        empUser.setId(UUID.randomUUID());
        User assignedByUser = new User();
        assignedByUser.setId(assignedByUserId);

        Task task = new Task();
        task.setId(taskId);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(empUser);

        TaskAssignmentRequestDTO request = new TaskAssignmentRequestDTO();
        request.setTaskId(taskId);
        request.setEmployeeId(employeeId);
        request.setAssignedBy(AssignedByType.AI);
        request.setAssignedByUserId(assignedByUserId);

        TaskAssignment saved = new TaskAssignment();
        saved.setId(UUID.randomUUID());
        TaskAssignmentDTO dto = new TaskAssignmentDTO();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(userRepository.findById(assignedByUserId)).thenReturn(Optional.of(assignedByUser));
        when(assignmentRepository.save(any(TaskAssignment.class))).thenReturn(saved);
        when(modelMapper.map(saved, TaskAssignmentDTO.class)).thenReturn(dto);

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskAssignmentDTO result = taskAssignmentService.assignTask(request);
            assertNotNull(result);
            verify(userRepository).findById(assignedByUserId);
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("getAssignmentById throws when not found")
    void getAssignmentById_notFound_throws() {
        UUID id = UUID.randomUUID();
        when(assignmentRepository.findById(id)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> taskAssignmentService.getAssignmentById(id));
    }

    @Test
    @DisplayName("getAssignmentsByTask returns mapped DTOs scoped to company")
    void getAssignmentsByTask_success() {
        UUID taskId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        Company company = new Company();
        company.setId(companyId);

        Task task = new Task();
        task.setId(taskId);
        task.setCompany(company);

        TaskAssignment assignment = new TaskAssignment();
        TaskAssignmentDTO dto = new TaskAssignmentDTO();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(assignmentRepository.findByTaskIdAndCompanyId(taskId, companyId)).thenReturn(List.of(assignment));
        when(modelMapper.map(assignment, TaskAssignmentDTO.class)).thenReturn(dto);

        assertEquals(1, taskAssignmentService.getAssignmentsByTask(taskId).size());
    }

    @Test
    @DisplayName("getAssignmentsByEmployee returns mapped DTOs scoped to company")
    void getAssignmentsByEmployee_success() {
        UUID employeeId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();

        Company company = new Company();
        company.setId(companyId);
        User empUser = new User();
        empUser.setCompany(company);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(empUser);

        TaskAssignment assignment = new TaskAssignment();
        TaskAssignmentDTO dto = new TaskAssignmentDTO();

        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(assignmentRepository.findByEmployeeIdAndCompanyId(employeeId, companyId)).thenReturn(List.of(assignment));
        when(modelMapper.map(assignment, TaskAssignmentDTO.class)).thenReturn(dto);

        assertEquals(1, taskAssignmentService.getAssignmentsByEmployee(employeeId).size());
    }

    @Test
    @DisplayName("getActiveAssignmentsByEmployee filters by active statuses")
    void getActiveAssignmentsByEmployee_filtersActive() {
        UUID employeeId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();

        Company company = new Company();
        company.setId(companyId);
        User empUser = new User();
        empUser.setCompany(company);

        Employee employee = new Employee();
        employee.setId(employeeId);
        employee.setUser(empUser);

        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(assignmentRepository.findActiveAssignmentsByEmployeeAndCompany(eq(employeeId), anyList(), eq(companyId)))
                .thenReturn(List.of());

        assertTrue(taskAssignmentService.getActiveAssignmentsByEmployee(employeeId).isEmpty());
    }

    @Test
    @DisplayName("acceptAssignment sets status to ACCEPTED")
    void acceptAssignment_success() {
        UUID assignmentId = UUID.randomUUID();
        UUID managerId = UUID.randomUUID();

        User manager = new User();
        manager.setId(managerId);

        Task task = new Task();
        task.setCreatedBy(manager);

        TaskAssignment assignment = new TaskAssignment();
        assignment.setId(assignmentId);
        assignment.setTask(task);

        TaskAssignment updated = new TaskAssignment();
        updated.setId(assignmentId);
        updated.setStatus(TaskAssignmentStatus.ACCEPTED);
        updated.setTask(task);

        TaskAssignmentDTO dto = new TaskAssignmentDTO();

        when(assignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
        when(assignmentRepository.save(assignment)).thenReturn(updated);
        when(modelMapper.map(updated, TaskAssignmentDTO.class)).thenReturn(dto);

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskAssignmentDTO result = taskAssignmentService.acceptAssignment(assignmentId);
            assertNotNull(result);
            assertEquals(TaskAssignmentStatus.ACCEPTED, assignment.getStatus());
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("rejectAssignment sets status to REJECTED")
    void rejectAssignment_success() {
        UUID assignmentId = UUID.randomUUID();
        UUID managerId = UUID.randomUUID();

        User manager = new User();
        manager.setId(managerId);

        Task task = new Task();
        task.setCreatedBy(manager);

        TaskAssignment assignment = new TaskAssignment();
        assignment.setId(assignmentId);
        assignment.setTask(task);

        TaskAssignment updated = new TaskAssignment();
        updated.setId(assignmentId);
        updated.setStatus(TaskAssignmentStatus.REJECTED);
        updated.setTask(task);

        TaskAssignmentDTO dto = new TaskAssignmentDTO();

        when(assignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
        when(assignmentRepository.save(assignment)).thenReturn(updated);
        when(modelMapper.map(updated, TaskAssignmentDTO.class)).thenReturn(dto);

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskAssignmentDTO result = taskAssignmentService.rejectAssignment(assignmentId);
            assertNotNull(result);
            assertEquals(TaskAssignmentStatus.REJECTED, assignment.getStatus());
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("deleteAssignment throws when not found")
    void deleteAssignment_notFound_throws() {
        UUID id = UUID.randomUUID();
        when(assignmentRepository.existsById(id)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> taskAssignmentService.deleteAssignment(id));
    }

    @Test
    @DisplayName("deleteAssignment deletes when found")
    void deleteAssignment_success() {
        UUID id = UUID.randomUUID();
        when(assignmentRepository.existsById(id)).thenReturn(true);
        taskAssignmentService.deleteAssignment(id);
        verify(assignmentRepository).deleteById(id);
    }
}
