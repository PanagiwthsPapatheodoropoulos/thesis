package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.dto.ai.TaskAssignmentRequestDTO;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskAssignmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for managing task-to-employee assignment records.
 * Supports assigning tasks, querying assignments by task or employee,
 * and accepting or rejecting assignment offers.
 */
@RestController
@RequestMapping("/api/assignments")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class TaskAssignmentController {

    private final TaskAssignmentService assignmentService;

    /**
     * Assigns an employee to a specific task.
     * The assignedByUserId is automatically derived from the current session
     * if not explicitly provided in the request.
     *
     * @param requestDTO  The assignment details including task ID and employee ID.
     * @param currentUser The admin or manager creating the assignment.
     * @return The created assignment record.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TaskAssignmentDTO> assignTask(
            @Valid @RequestBody TaskAssignmentRequestDTO requestDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        // Set assignedByUserId if not provided
        if (requestDTO.getAssignedByUserId() == null) {
            requestDTO.setAssignedByUserId(currentUser.getId());
        }

        TaskAssignmentDTO assignment = assignmentService.assignTask(requestDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(assignment);
    }

    /**
     * Retrieves the details of a single assignment by its unique ID.
     *
     * @param id The UUID of the assignment.
     * @return The assignment data transfer object.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<TaskAssignmentDTO> getAssignmentById(@PathVariable UUID id) {
        TaskAssignmentDTO assignment = assignmentService.getAssignmentById(id);
        return ResponseEntity.ok(assignment);
    }

    /**
     * Returns all assignments linked to a specific task.
     *
     * @param taskId The UUID of the task.
     * @return A list of all assignments for that task.
     */
    @GetMapping("/task/{taskId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<TaskAssignmentDTO>> getAssignmentsByTask(@PathVariable UUID taskId) {
        List<TaskAssignmentDTO> assignments = assignmentService.getAssignmentsByTask(taskId);
        return ResponseEntity.ok(assignments);
    }

    /**
     * Returns all assignments for a given employee, including completed ones.
     *
     * @param employeeId The UUID of the employee.
     * @return A list of all assignments for that employee.
     */
    @GetMapping("/employee/{employeeId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<TaskAssignmentDTO>> getAssignmentsByEmployee(@PathVariable UUID employeeId) {
        List<TaskAssignmentDTO> assignments = assignmentService.getAssignmentsByEmployee(employeeId);
        return ResponseEntity.ok(assignments);
    }

    /**
     * Returns only the active (non-completed) assignments for a given employee.
     * Used to determine current workload capacity.
     *
     * @param employeeId The UUID of the employee.
     * @return A list of active assignments.
     */
    @GetMapping("/employee/{employeeId}/active")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<TaskAssignmentDTO>> getActiveAssignmentsByEmployee(
            @PathVariable UUID employeeId) {
        List<TaskAssignmentDTO> assignments = assignmentService.getActiveAssignmentsByEmployee(employeeId);
        return ResponseEntity.ok(assignments);
    }

    /**
     * Marks an assignment as accepted by the assigned employee.
     * Transitions the assignment status from PENDING to ACTIVE.
     *
     * @param id The UUID of the assignment to accept.
     * @return The updated assignment with the new status.
     */
    @PatchMapping("/{id}/accept")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<TaskAssignmentDTO> acceptAssignment(@PathVariable UUID id) {
        // Log assignment transition
        TaskAssignmentDTO assignment = assignmentService.acceptAssignment(id);
        return ResponseEntity.ok(assignment);
    }

    /**
     * Marks an assignment as rejected by the employee.
     * The task remains unassigned and available for re-assignment.
     *
     * @param id The UUID of the assignment to reject.
     * @return The updated assignment with the rejected status.
     */
    @PatchMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<TaskAssignmentDTO> rejectAssignment(@PathVariable UUID id) {
        // Log assignment transition
        TaskAssignmentDTO assignment = assignmentService.rejectAssignment(id);
        return ResponseEntity.ok(assignment);
    }

    /**
     * Permanently deletes an assignment record.
     * Used to rescind an incorrect or obsolete assignment.
     *
     * @param id The UUID of the assignment to delete.
     * @return 204 No Content on success.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> deleteAssignment(@PathVariable UUID id) {
        // Destroy target association mapping logically
        assignmentService.deleteAssignment(id);
        return ResponseEntity.noContent().build();
    }
}