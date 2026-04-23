package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.TaskTimeEntryDTO;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskTimeEntry;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.repository.TaskTimeEntryRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Service for managing task time entries.
 *
 * <p>
 * Allows employees (and auto-provisioned admin/manager profiles) to log
 * hours spent on a task. Every new entry automatically updates the task's
 * cumulative actual-hours total.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class TaskTimeEntryService {

    private final TaskTimeEntryRepository timeEntryRepository;
    private final TaskRepository taskRepository;
    private final EmployeeRepository employeeRepository;
    private final ModelMapper modelMapper;
    private final UserRepository userRepository;

    /**
     * Logs time spent on a task by the given user.
     * Auto-creates a minimal employee profile for admins/managers who do not yet
     * have one.
     * Updates the task's cumulative actual hours after saving the entry.
     *
     * @param entryDTO DTO containing task ID, hours spent, work date, and
     *                 description
     * @param userId   UUID of the user logging the time
     * @return the saved {@link TaskTimeEntryDTO}
     * @throws RuntimeException if an unexpected error occurs during persistence
     */
    @Transactional
    public TaskTimeEntryDTO logTime(TaskTimeEntryDTO entryDTO, UUID userId) {
        try {
            Task task = taskRepository.findById(entryDTO.getTaskId())
                    .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

            // Get or auto-create employee profile
            Employee employee;
            try {
                employee = employeeRepository.findByUserId(userId)
                        .orElseThrow(() -> new ResourceNotFoundException("Employee profile not found"));
            } catch (ResourceNotFoundException e) {
                // Auto-create for admin/manager
                User user = userRepository.findById(userId)
                        .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                if (user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.MANAGER) {

                    employee = Employee.builder()
                            .user(user)
                            .firstName(user.getUsername())
                            .lastName(user.getRole().toString())
                            .position(user.getRole().toString())
                            .department(user.getRole() == UserRole.ADMIN ? "Administration" : "Management")
                            .hireDate(LocalDate.now())
                            .maxWeeklyHours(40)
                            .timezone("UTC")
                            .build();

                    employee = employeeRepository.saveAndFlush(employee);
                } else {
                    throw e; // Re-throw for regular employees
                }
            }

            // Validate and set defaults
            if (entryDTO.getWorkDate() == null) {
                entryDTO.setWorkDate(LocalDateTime.now());
            }

            TaskTimeEntry entry = TaskTimeEntry.builder()
                    .task(task)
                    .employee(employee)
                    .hoursSpent(entryDTO.getHoursSpent())
                    .workDate(entryDTO.getWorkDate())
                    .description(entryDTO.getDescription())
                    .build();

            TaskTimeEntry saved = timeEntryRepository.saveAndFlush(entry);
            // Update task's actual hours
            BigDecimal totalHours = timeEntryRepository.getTotalHoursByTask(task.getId());
            task.setActualHours(totalHours);
            taskRepository.saveAndFlush(task);

            return mapToDTO(saved);

        } catch (Exception e) {
            throw new RuntimeException("Failed to log time: " + e.getMessage());
        }
    }

    /**
     * Returns all time entries for a given task, ordered with newest entries first.
     *
     * @param taskId UUID of the task
     * @return list of {@link TaskTimeEntryDTO} objects
     */
    @Transactional(readOnly = true)
    public List<TaskTimeEntryDTO> getTimeEntriesByTask(UUID taskId) {
        return timeEntryRepository.findByTaskIdOrderByWorkDateDesc(taskId).stream()
                .map(this::mapToDTO)
                .toList();
    }

    /**
     * Returns the total hours logged across all entries for a given task.
     *
     * @param taskId UUID of the task
     * @return sum of all logged hours, or {@code null} if no entries exist
     */
    @Transactional(readOnly = true)
    public BigDecimal getTotalHours(UUID taskId) {
        return timeEntryRepository.getTotalHoursByTask(taskId);
    }

    /**
     * Maps a {@link TaskTimeEntry} entity to a {@link TaskTimeEntryDTO}.
     *
     * @param entry the time entry entity
     * @return the populated DTO
     */
    private TaskTimeEntryDTO mapToDTO(TaskTimeEntry entry) {
        TaskTimeEntryDTO dto = modelMapper.map(entry, TaskTimeEntryDTO.class);
        dto.setEmployeeId(entry.getEmployee().getId());
        dto.setEmployeeName(entry.getEmployee().getFirstName() + " " +
                entry.getEmployee().getLastName());
        dto.setTaskId(entry.getTask().getId());
        return dto;
    }
}