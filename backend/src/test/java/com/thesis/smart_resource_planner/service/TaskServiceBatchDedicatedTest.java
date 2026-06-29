package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.model.entity.Skill;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskRequiredSkill;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.repository.NotificationRepository;
import com.thesis.smart_resource_planner.repository.SkillRepository;
import com.thesis.smart_resource_planner.repository.TaskAssignmentRepository;
import com.thesis.smart_resource_planner.repository.TaskPermissionRepository;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.repository.TaskRequiredSkillRepository;
import com.thesis.smart_resource_planner.repository.TeamRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceBatchDedicatedTest {

    @Mock private TaskRepository taskRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private UserRepository userRepository;
    @Mock private TaskAssignmentRepository taskAssignmentRepository;
    @Mock private TaskPermissionRepository taskPermissionRepository;
    @Mock private NotificationService notificationService;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private ModelMapper modelMapper;
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private WebSocketBroadcastService broadcastService;
    @Mock private TaskAuditLogService auditLogService;
    @Mock private NotificationRepository notificationRepository;
    @Mock private TaskRequiredSkillRepository taskRequiredSkillRepository;
    @Mock private SkillRepository skillRepository;
    @Mock private RestTemplate restTemplate;

    @InjectMocks private TaskService taskService;

    @Test
    @DisplayName("getTaskRequiredSkillsBatch returns empty map for empty input")
    void getTaskRequiredSkillsBatch_emptyInput() {
        assertTrue(taskService.getTaskRequiredSkillsBatch(List.of()).isEmpty());
    }

    @Test
    @DisplayName("getTaskRequiredSkillsBatch returns empty lists when repository errors")
    void getTaskRequiredSkillsBatch_errorFallback() {
        UUID t1 = UUID.randomUUID();
        UUID t2 = UUID.randomUUID();
        when(taskRequiredSkillRepository.findByTaskIdIn(List.of(t1, t2))).thenThrow(new RuntimeException("db fail"));
        Map<String, List<String>> result = taskService.getTaskRequiredSkillsBatch(List.of(t1, t2));
        assertEquals(0, result.get(t1.toString()).size());
        assertEquals(0, result.get(t2.toString()).size());
    }

    @Test
    @DisplayName("getTaskRequiredSkillsBatch groups required skills per task")
    void getTaskRequiredSkillsBatch_groupsSkills() {
        UUID t1 = UUID.randomUUID();
        UUID t2 = UUID.randomUUID();
        UUID s1 = UUID.randomUUID();
        UUID s2 = UUID.randomUUID();

        Task task1 = new Task(); task1.setId(t1);
        Task task2 = new Task(); task2.setId(t2);
        Skill skill1 = new Skill(); skill1.setId(s1);
        Skill skill2 = new Skill(); skill2.setId(s2);

        TaskRequiredSkill trs1 = TaskRequiredSkill.builder().task(task1).skill(skill1).build();
        TaskRequiredSkill trs2 = TaskRequiredSkill.builder().task(task1).skill(skill2).build();

        when(taskRequiredSkillRepository.findByTaskIdIn(List.of(t1, t2))).thenReturn(List.of(trs1, trs2));

        Map<String, List<String>> result = taskService.getTaskRequiredSkillsBatch(List.of(t1, t2));
        assertEquals(2, result.get(t1.toString()).size());
        assertEquals(0, result.get(t2.toString()).size());
    }
}

