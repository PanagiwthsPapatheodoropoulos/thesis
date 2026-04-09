package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.TaskTimeEntryDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskTimeEntry;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.repository.TaskTimeEntryRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskTimeEntryServiceDedicatedTest {

    @Mock
    private TaskTimeEntryRepository timeEntryRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private EmployeeRepository employeeRepository;
    @Mock
    private ModelMapper modelMapper;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private TaskTimeEntryService taskTimeEntryService;

    private UUID taskId;
    private UUID userId;
    private Task task;
    private Employee employee;

    @BeforeEach
    void setUp() {
        taskId = UUID.randomUUID();
        userId = UUID.randomUUID();

        Company company = new Company();
        company.setId(UUID.randomUUID());

        User user = new User();
        user.setId(userId);
        user.setUsername("admin1");
        user.setRole(UserRole.ADMIN);
        user.setCompany(company);

        employee = new Employee();
        employee.setId(UUID.randomUUID());
        employee.setFirstName("Jane");
        employee.setLastName("Doe");
        employee.setUser(user);

        task = new Task();
        task.setId(taskId);
    }

    @Test
    @DisplayName("logTime saves entry and updates task actual hours")
    void logTime_successExistingEmployee() {
        TaskTimeEntryDTO dto = new TaskTimeEntryDTO();
        dto.setTaskId(taskId);
        dto.setHoursSpent(BigDecimal.valueOf(2.5));
        dto.setDescription("work");
        dto.setWorkDate(LocalDateTime.now());

        TaskTimeEntry saved = TaskTimeEntry.builder()
                .id(UUID.randomUUID())
                .task(task)
                .employee(employee)
                .hoursSpent(BigDecimal.valueOf(2.5))
                .workDate(dto.getWorkDate())
                .description("work")
                .build();

        TaskTimeEntryDTO mapped = new TaskTimeEntryDTO();
        mapped.setId(saved.getId());

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.of(employee));
        when(timeEntryRepository.saveAndFlush(any(TaskTimeEntry.class))).thenReturn(saved);
        when(timeEntryRepository.getTotalHoursByTask(taskId)).thenReturn(BigDecimal.valueOf(7.5));
        when(modelMapper.map(saved, TaskTimeEntryDTO.class)).thenReturn(mapped);

        TaskTimeEntryDTO result = taskTimeEntryService.logTime(dto, userId);

        assertNotNull(result);
        assertEquals(taskId, result.getTaskId());
        assertEquals(employee.getId(), result.getEmployeeId());
        verify(taskRepository).saveAndFlush(task);
        assertEquals(BigDecimal.valueOf(7.5), task.getActualHours());
    }

    @Test
    @DisplayName("logTime auto-creates employee profile for admin when missing")
    void logTime_autoCreateAdminEmployee() {
        User admin = employee.getUser();
        TaskTimeEntryDTO dto = new TaskTimeEntryDTO();
        dto.setTaskId(taskId);
        dto.setHoursSpent(BigDecimal.ONE);
        dto.setWorkDate(LocalDateTime.now());

        Employee created = new Employee();
        created.setId(UUID.randomUUID());
        created.setFirstName("admin1");
        created.setLastName("ADMIN");

        TaskTimeEntry saved = TaskTimeEntry.builder()
                .id(UUID.randomUUID())
                .task(task)
                .employee(created)
                .hoursSpent(BigDecimal.ONE)
                .workDate(dto.getWorkDate())
                .build();

        TaskTimeEntryDTO mapped = new TaskTimeEntryDTO();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        when(employeeRepository.saveAndFlush(any(Employee.class))).thenReturn(created);
        when(timeEntryRepository.saveAndFlush(any(TaskTimeEntry.class))).thenReturn(saved);
        when(timeEntryRepository.getTotalHoursByTask(taskId)).thenReturn(BigDecimal.ONE);
        when(modelMapper.map(saved, TaskTimeEntryDTO.class)).thenReturn(mapped);

        TaskTimeEntryDTO result = taskTimeEntryService.logTime(dto, userId);
        assertNotNull(result);
        verify(employeeRepository).saveAndFlush(any(Employee.class));
    }

    @Test
    @DisplayName("logTime wraps missing employee error for non-admin user")
    void logTime_missingEmployeeNonAdmin() {
        User plainUser = new User();
        plainUser.setId(userId);
        plainUser.setRole(UserRole.USER);

        TaskTimeEntryDTO dto = new TaskTimeEntryDTO();
        dto.setTaskId(taskId);
        dto.setHoursSpent(BigDecimal.ONE);
        dto.setWorkDate(LocalDateTime.now());

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(employeeRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(userRepository.findById(userId)).thenReturn(Optional.of(plainUser));

        RuntimeException ex = assertThrows(RuntimeException.class, () -> taskTimeEntryService.logTime(dto, userId));
        assertTrue(ex.getMessage().contains("Failed to log time"));
    }

    @Test
    @DisplayName("getTimeEntriesByTask maps repository results")
    void getTimeEntriesByTask_maps() {
        TaskTimeEntry entry = TaskTimeEntry.builder()
                .id(UUID.randomUUID())
                .task(task)
                .employee(employee)
                .hoursSpent(BigDecimal.valueOf(1.25))
                .workDate(LocalDateTime.now())
                .build();

        TaskTimeEntryDTO mapped = new TaskTimeEntryDTO();
        when(timeEntryRepository.findByTaskIdOrderByWorkDateDesc(taskId)).thenReturn(List.of(entry));
        when(modelMapper.map(entry, TaskTimeEntryDTO.class)).thenReturn(mapped);

        List<TaskTimeEntryDTO> result = taskTimeEntryService.getTimeEntriesByTask(taskId);
        assertEquals(1, result.size());
        assertEquals(employee.getId(), result.get(0).getEmployeeId());
        assertEquals(taskId, result.get(0).getTaskId());
    }

    @Test
    @DisplayName("getTotalHours delegates to repository")
    void getTotalHours_delegates() {
        when(timeEntryRepository.getTotalHoursByTask(taskId)).thenReturn(BigDecimal.valueOf(4.0));
        assertEquals(BigDecimal.valueOf(4.0), taskTimeEntryService.getTotalHours(taskId));
    }
}

