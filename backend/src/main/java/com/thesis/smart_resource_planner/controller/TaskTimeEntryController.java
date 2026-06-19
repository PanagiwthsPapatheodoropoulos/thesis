// src/main/java/com/thesis/smart_resource_planner/controller/TaskTimeEntryController.java
package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.TaskTimeEntryDTO;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskTimeEntryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * REST controller for recording and retrieving time entries on tasks.
 * Allows employees to log hours spent on a task and managers to query
 * the time history and cumulative totals per task.
 */
@RestController
@RequestMapping("/api/tasks/time")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class TaskTimeEntryController {

    private final TaskTimeEntryService timeEntryService;
    private final TaskRepository taskRepository;
    private final EmployeeRepository employeeRepository;

    /**
     * Logs a time entry recording hours worked on a task.
     * Validates that the task exists, the employee profile is found,
     * and the hours value is positive before persisting.
     *
     * @param entryDTO    The time entry details including task ID and hours spent.
     * @param currentUser The authenticated user submitting the time log.
     * @return The saved time entry, or an appropriate error status.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<TaskTimeEntryDTO> logTime(
            @Valid @RequestBody TaskTimeEntryDTO entryDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        try {
            // Validate task exists
            if (!taskRepository.existsById(entryDTO.getTaskId())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }

            // Get employee profile
            Employee employee = employeeRepository.findByUserId(currentUser.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Employee profile not found"));

            // Validate hours
            if (entryDTO.getHoursSpent() == null || entryDTO.getHoursSpent().compareTo(BigDecimal.ZERO) <= 0) {
                return ResponseEntity.badRequest().build();
            }

            // Set workDate if null
            if (entryDTO.getWorkDate() == null) {
                entryDTO.setWorkDate(LocalDateTime.now());
            }

            TaskTimeEntryDTO entry = timeEntryService.logTime(entryDTO, currentUser.getId());
            return ResponseEntity.status(HttpStatus.CREATED).body(entry);

        } catch (ResourceNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Retrieves all time entries logged against a specific task, ordered
     * chronologically.
     *
     * @param taskId The UUID of the task to query entries for.
     * @return A list of time entries for the task, or 404 if the task does not
     *         exist.
     */
    @GetMapping("/task/{taskId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<TaskTimeEntryDTO>> getTimeEntries(@PathVariable UUID taskId) {
        try {
            if (!taskRepository.existsById(taskId)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }
            List<TaskTimeEntryDTO> entries = timeEntryService.getTimeEntriesByTask(taskId);
            return ResponseEntity.ok(entries);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Returns the sum of all hours logged across all time entries for a task.
     * Used to calculate actual effort vs estimated effort.
     *
     * @param taskId The UUID of the task.
     * @return The total hours as a BigDecimal, or 404 if the task does not exist.
     */
    @GetMapping("/task/{taskId}/total")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<BigDecimal> getTotalHours(@PathVariable UUID taskId) {
        try {
            if (!taskRepository.existsById(taskId)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }
            BigDecimal total = timeEntryService.getTotalHours(taskId);
            return ResponseEntity.ok(total);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}