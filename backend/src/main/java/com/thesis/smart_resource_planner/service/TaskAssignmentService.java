package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.AssignedByType;
import com.thesis.smart_resource_planner.enums.TaskAssignmentStatus;
import com.thesis.smart_resource_planner.enums.TaskStatus;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.dto.ai.TaskAssignmentRequestDTO;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for task assignment lifecycle management.
 *
 * <p>
 * Handles the creation, retrieval, acceptance, rejection, and deletion
 * of task assignments. Real-time events are broadcast to relevant users
 * via WebSocket after each state-change commits.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class TaskAssignmentService {

    private final TaskAssignmentRepository assignmentRepository;
    private final TaskRepository taskRepository;
    private final EmployeeRepository employeeRepository;
    private final ModelMapper modelMapper;
    private final WebSocketBroadcastService broadcastService;
    private final UserRepository userRepository;

    /**
     * Creates a new task assignment and broadcasts it to the assigned employee via
     * WebSocket.
     *
     * @param requestDTO DTO containing task ID, employee ID, assignedBy type,
     *                   scores, and notes
     * @return the saved {@link TaskAssignmentDTO}
     */
    public TaskAssignmentDTO assignTask(TaskAssignmentRequestDTO requestDTO) {
        // Use UUID directly (not String)
        Task task = taskRepository.findById(requestDTO.getTaskId())
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        Employee employee = employeeRepository.findById(requestDTO.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        // Get assignedBy user if provided
        User assignedByUser = null;
        if (requestDTO.getAssignedByUserId() != null) {
            assignedByUser = userRepository.findById(requestDTO.getAssignedByUserId())
                    .orElse(null);
        }

        // Determine assignedBy type
        AssignedByType assignedByType = requestDTO.getAssignedBy() != null
                ? requestDTO.getAssignedBy()
                : AssignedByType.MANUAL;

        TaskAssignment assignment = TaskAssignment.builder()
                .task(task)
                .employee(employee)
                .assignedBy(assignedByType)
                .assignedByUser(assignedByUser)
                .fitScore(requestDTO.getFitScore())
                .confidenceScore(requestDTO.getConfidenceScore())
                .notes(requestDTO.getNotes())
                .assignedDate(LocalDateTime.now())
                .status(TaskAssignmentStatus.PENDING) // initial status
                .build();

        TaskAssignment saved = assignmentRepository.save(assignment);
        TaskAssignmentDTO dto = modelMapper.map(saved, TaskAssignmentDTO.class);

        // Broadcast after commit
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                broadcastService.broadcastAssignmentCreated(employee.getUser().getId(), dto);
            }
        });

        return dto;
    }

    /**
     * Retrieves a task assignment by its UUID.
     *
     * @param id UUID of the assignment
     * @return the matching {@link TaskAssignmentDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    @Transactional(readOnly = true)
    public TaskAssignmentDTO getAssignmentById(UUID id) {
        TaskAssignment assignment = assignmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));
        return modelMapper.map(assignment, TaskAssignmentDTO.class);
    }

    /**
     * Returns all assignments for a given task, scoped to the task's company.
     *
     * @param taskId UUID of the task
     * @return list of {@link TaskAssignmentDTO} objects
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               task
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<TaskAssignmentDTO> getAssignmentsByTask(UUID taskId) {
        // Get task's company
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        UUID companyId = task.getCompany().getId();

        // Use company-filtered query
        return assignmentRepository.findByTaskIdAndCompanyId(taskId, companyId).stream()
                .map(assignment -> modelMapper.map(assignment, TaskAssignmentDTO.class))
                .toList();
    }

    /**
     * Returns all assignments for a given employee, scoped to the employee's
     * company.
     *
     * @param employeeId UUID of the employee
     * @return list of {@link TaskAssignmentDTO} objects
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               employee
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<TaskAssignmentDTO> getAssignmentsByEmployee(UUID employeeId) {
        // Get employee's company
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        UUID companyId = employee.getUser().getCompany().getId();

        return assignmentRepository.findByEmployeeIdAndCompanyId(employeeId, companyId).stream()
                .map(assignment -> modelMapper.map(assignment, TaskAssignmentDTO.class))
                .toList();
    }

    /**
     * Returns only active (PENDING or IN_PROGRESS) assignments for a given
     * employee.
     *
     * @param employeeId UUID of the employee
     * @return list of active {@link TaskAssignmentDTO} objects
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               employee
     *                                                                               does
     *                                                                               not
     *                                                                               exist
     */
    @Transactional(readOnly = true)
    public List<TaskAssignmentDTO> getActiveAssignmentsByEmployee(UUID employeeId) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        UUID companyId = employee.getUser().getCompany().getId();

        List<TaskStatus> activeStatuses = List.of(
                TaskStatus.PENDING,
                TaskStatus.IN_PROGRESS);

        return assignmentRepository.findActiveAssignmentsByEmployeeAndCompany(
                employeeId, activeStatuses, companyId).stream()
                .map(assignment -> modelMapper.map(assignment, TaskAssignmentDTO.class))
                .toList();
    }

    /**
     * Marks an assignment as ACCEPTED and notifies the task creator (manager) via
     * WebSocket.
     *
     * @param assignmentId UUID of the assignment to accept
     * @return the updated {@link TaskAssignmentDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    public TaskAssignmentDTO acceptAssignment(UUID assignmentId) {
        TaskAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));

        assignment.setStatus(TaskAssignmentStatus.ACCEPTED);
        TaskAssignment updated = assignmentRepository.save(assignment);
        TaskAssignmentDTO dto = modelMapper.map(updated, TaskAssignmentDTO.class);

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                UUID managerId = updated.getTask().getCreatedBy().getId();
                broadcastService.broadcastAssignmentAccepted(managerId, dto);
            }
        });

        return dto;
    }

    /**
     * Marks an assignment as REJECTED and notifies the task creator (manager) via
     * WebSocket.
     *
     * @param assignmentId UUID of the assignment to reject
     * @return the updated {@link TaskAssignmentDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    public TaskAssignmentDTO rejectAssignment(UUID assignmentId) {
        TaskAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));

        assignment.setStatus(TaskAssignmentStatus.REJECTED);
        TaskAssignment updated = assignmentRepository.save(assignment);
        TaskAssignmentDTO dto = modelMapper.map(updated, TaskAssignmentDTO.class);

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                UUID managerId = updated.getTask().getCreatedBy().getId();
                broadcastService.broadcastAssignmentRejected(managerId, dto);
            }
        });

        return dto;
    }

    /**
     * Permanently deletes a task assignment.
     *
     * @param id UUID of the assignment to delete
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    public void deleteAssignment(UUID id) {
        if (!assignmentRepository.existsById(id)) {
            throw new ResourceNotFoundException("Assignment not found");
        }

        assignmentRepository.deleteById(id);
    }
}