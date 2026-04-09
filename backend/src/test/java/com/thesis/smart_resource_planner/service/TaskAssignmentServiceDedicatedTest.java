package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.TaskAssignmentStatus;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.TaskAssignmentDTO;
import com.thesis.smart_resource_planner.model.dto.ai.TaskAssignmentRequestDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskAssignment;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.TaskAssignmentRepository;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TaskAssignmentService Tests")
class TaskAssignmentServiceDedicatedTest {

    @Mock
    private TaskAssignmentRepository assignmentRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @Mock
    private ModelMapper modelMapper;

    @Mock
    private WebSocketBroadcastService broadcastService;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private TaskAssignmentService taskAssignmentService;

    private TaskAssignment testAssignment;
    private TaskAssignmentDTO testAssignmentDTO;
    private UUID assignmentId;
    private UUID taskId;
    private UUID employeeId;
    private UUID managerId;
    private Company company;
    private Task task;
    private Employee employee;
    private User manager;

    @BeforeEach
    void setUp() {
        assignmentId = UUID.randomUUID();
        taskId = UUID.randomUUID();
        employeeId = UUID.randomUUID();
        managerId = UUID.randomUUID();

        company = new Company();
        company.setId(UUID.randomUUID());

        manager = new User();
        manager.setId(managerId);
        manager.setCompany(company);

        task = new Task();
        task.setId(taskId);
        task.setCompany(company);
        task.setCreatedBy(manager);

        employee = new Employee();
        employee.setId(employeeId);
        User empUser = new User();
        empUser.setId(UUID.randomUUID());
        empUser.setCompany(company);
        employee.setUser(empUser);

        testAssignment = new TaskAssignment();
        testAssignment.setId(assignmentId);
        testAssignment.setStatus(TaskAssignmentStatus.PENDING);
        testAssignment.setTask(task);
        testAssignment.setEmployee(employee);

        testAssignmentDTO = new TaskAssignmentDTO();
        testAssignmentDTO.setId(assignmentId);
        testAssignmentDTO.setStatus(TaskAssignmentStatus.PENDING);
    }

    @Test
    @DisplayName("Should retrieve assignment by ID successfully")
    void testGetAssignmentById_Success() {
        when(assignmentRepository.findById(assignmentId)).thenReturn(Optional.of(testAssignment));
        when(modelMapper.map(testAssignment, TaskAssignmentDTO.class)).thenReturn(testAssignmentDTO);

        TaskAssignmentDTO result = taskAssignmentService.getAssignmentById(assignmentId);

        assertNotNull(result);
        assertEquals(testAssignmentDTO.getId(), result.getId());
        verify(assignmentRepository, times(1)).findById(assignmentId);
    }

    @Test
    @DisplayName("Should throw exception when assignment not found")
    void testGetAssignmentById_NotFound() {
        when(assignmentRepository.findById(assignmentId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> taskAssignmentService.getAssignmentById(assignmentId));
    }

    @Test
    @DisplayName("assignTask: creates pending assignment")
    void testAssignTask_Success() {
        TaskAssignmentRequestDTO request = new TaskAssignmentRequestDTO();
        request.setTaskId(taskId);
        request.setEmployeeId(employeeId);
        request.setNotes("note");
        request.setAssignedByUserId(managerId);

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
        when(assignmentRepository.save(any(TaskAssignment.class))).thenReturn(testAssignment);
        when(modelMapper.map(any(TaskAssignment.class), eq(TaskAssignmentDTO.class))).thenReturn(testAssignmentDTO);

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskAssignmentDTO dto = taskAssignmentService.assignTask(request);
            assertNotNull(dto);
            verify(assignmentRepository).save(any(TaskAssignment.class));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("getAssignmentsByEmployee: scopes by employee company")
    void testGetAssignmentsByEmployee_Success() {
        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(assignmentRepository.findByEmployeeIdAndCompanyId(employeeId, company.getId()))
                .thenReturn(List.of(testAssignment));
        when(modelMapper.map(testAssignment, TaskAssignmentDTO.class)).thenReturn(testAssignmentDTO);

        List<TaskAssignmentDTO> result = taskAssignmentService.getAssignmentsByEmployee(employeeId);
        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("deleteAssignment: deletes when exists")
    void testDeleteAssignment_Success() {
        when(assignmentRepository.existsById(assignmentId)).thenReturn(true);
        taskAssignmentService.deleteAssignment(assignmentId);
        verify(assignmentRepository).deleteById(assignmentId);
    }

    @Test
    @DisplayName("assignTask: defaults assignedBy and tolerates missing assigner user")
    void testAssignTask_DefaultAssignedBy_AndAssignerMissing() {
        TaskAssignmentRequestDTO request = new TaskAssignmentRequestDTO();
        request.setTaskId(taskId);
        request.setEmployeeId(employeeId);
        request.setAssignedByUserId(managerId);

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(userRepository.findById(managerId)).thenReturn(Optional.empty());
        when(assignmentRepository.save(any(TaskAssignment.class))).thenReturn(testAssignment);
        when(modelMapper.map(any(TaskAssignment.class), eq(TaskAssignmentDTO.class))).thenReturn(testAssignmentDTO);

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskAssignmentDTO dto = taskAssignmentService.assignTask(request);
            assertNotNull(dto);
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        verify(broadcastService).broadcastAssignmentCreated(eq(employee.getUser().getId()), eq(testAssignmentDTO));
    }

    @Test
    @DisplayName("getAssignmentsByTask returns mapped list in company scope")
    void testGetAssignmentsByTask_Success() {
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(assignmentRepository.findByTaskIdAndCompanyId(taskId, company.getId())).thenReturn(List.of(testAssignment));
        when(modelMapper.map(testAssignment, TaskAssignmentDTO.class)).thenReturn(testAssignmentDTO);

        List<TaskAssignmentDTO> result = taskAssignmentService.getAssignmentsByTask(taskId);
        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("getActiveAssignmentsByEmployee returns only active mapped list")
    void testGetActiveAssignmentsByEmployee_Success() {
        when(employeeRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(assignmentRepository.findActiveAssignmentsByEmployeeAndCompany(eq(employeeId), anyList(), eq(company.getId())))
                .thenReturn(List.of(testAssignment));
        when(modelMapper.map(testAssignment, TaskAssignmentDTO.class)).thenReturn(testAssignmentDTO);

        List<TaskAssignmentDTO> result = taskAssignmentService.getActiveAssignmentsByEmployee(employeeId);
        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("acceptAssignment updates status and broadcasts after commit")
    void testAcceptAssignment_Success() {
        when(assignmentRepository.findById(assignmentId)).thenReturn(Optional.of(testAssignment));
        when(assignmentRepository.save(any(TaskAssignment.class))).thenReturn(testAssignment);
        when(modelMapper.map(testAssignment, TaskAssignmentDTO.class)).thenReturn(testAssignmentDTO);

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskAssignmentDTO result = taskAssignmentService.acceptAssignment(assignmentId);
            assertNotNull(result);
            assertEquals(TaskAssignmentStatus.ACCEPTED, testAssignment.getStatus());
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        verify(broadcastService).broadcastAssignmentAccepted(eq(managerId), eq(testAssignmentDTO));
    }

    @Test
    @DisplayName("rejectAssignment updates status and broadcasts after commit")
    void testRejectAssignment_Success() {
        when(assignmentRepository.findById(assignmentId)).thenReturn(Optional.of(testAssignment));
        when(assignmentRepository.save(any(TaskAssignment.class))).thenReturn(testAssignment);
        when(modelMapper.map(testAssignment, TaskAssignmentDTO.class)).thenReturn(testAssignmentDTO);

        TransactionSynchronizationManager.initSynchronization();
        try {
            TaskAssignmentDTO result = taskAssignmentService.rejectAssignment(assignmentId);
            assertNotNull(result);
            assertEquals(TaskAssignmentStatus.REJECTED, testAssignment.getStatus());
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        verify(broadcastService).broadcastAssignmentRejected(eq(managerId), eq(testAssignmentDTO));
    }

    @Test
    @DisplayName("deleteAssignment throws when assignment does not exist")
    void testDeleteAssignment_NotFound() {
        when(assignmentRepository.existsById(assignmentId)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> taskAssignmentService.deleteAssignment(assignmentId));
    }
}
