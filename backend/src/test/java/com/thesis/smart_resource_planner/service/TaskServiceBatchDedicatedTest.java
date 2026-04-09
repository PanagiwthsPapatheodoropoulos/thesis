package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskRequiredSkill;
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

    @Mock private com.thesis.smart_resource_planner.repository.TaskRepository taskRepository;
    @Mock private com.thesis.smart_resource_planner.repository.TeamRepository teamRepository;
    @Mock private com.thesis.smart_resource_planner.repository.UserRepository userRepository;
    @Mock private com.thesis.smart_resource_planner.repository.TaskAssignmentRepository taskAssignmentRepository;
    @Mock private com.thesis.smart_resource_planner.repository.TaskPermissionRepository taskPermissionRepository;
    @Mock private NotificationService notificationService;
    @Mock private com.thesis.smart_resource_planner.repository.EmployeeRepository employeeRepository;
    @Mock private ModelMapper modelMapper;
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private WebSocketBroadcastService broadcastService;
    @Mock private TaskAuditLogService auditLogService;
    @Mock private com.thesis.smart_resource_planner.repository.NotificationRepository notificationRepository;
    @Mock private com.thesis.smart_resource_planner.repository.TaskRequiredSkillRepository taskRequiredSkillRepository;
    @Mock private com.thesis.smart_resource_planner.repository.SkillRepository skillRepository;
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
        com.thesis.smart_resource_planner.model.entity.Skill skill1 = new com.thesis.smart_resource_planner.model.entity.Skill(); skill1.setId(s1);
        com.thesis.smart_resource_planner.model.entity.Skill skill2 = new com.thesis.smart_resource_planner.model.entity.Skill(); skill2.setId(s2);

        TaskRequiredSkill trs1 = TaskRequiredSkill.builder().task(task1).skill(skill1).build();
        TaskRequiredSkill trs2 = TaskRequiredSkill.builder().task(task1).skill(skill2).build();

        when(taskRequiredSkillRepository.findByTaskIdIn(List.of(t1, t2))).thenReturn(List.of(trs1, trs2));

        Map<String, List<String>> result = taskService.getTaskRequiredSkillsBatch(List.of(t1, t2));
        assertEquals(2, result.get(t1.toString()).size());
        assertEquals(0, result.get(t2.toString()).size());
    }
}

