package com.thesis.smart_resource_planner.config;

import com.thesis.smart_resource_planner.enums.EntityType;
import com.thesis.smart_resource_planner.enums.Severity;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.dto.AnomalyDetectionDTO;
import com.thesis.smart_resource_planner.model.entity.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.modelmapper.ModelMapper;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ModelMapperConfig - Null Branch Coverage Tests")
class ModelMapperConfigNullBranchTest {

    private final ModelMapper mapper = new ModelMapperConfig().modelMapper();

    @Test
    @DisplayName("User with null team and null company maps without NPE")
    void userMapping_nullTeamAndCompany() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("alice");
        user.setTeam(null);
        user.setCompany(null);

        UserDTO dto = mapper.map(user, UserDTO.class);
        assertNull(dto.getTeamId());
        assertNull(dto.getTeamName());
        assertNull(dto.getCompanyId());
        assertNull(dto.getCompanyName());
        assertEquals("alice", dto.getUsername());
    }

    @Test
    @DisplayName("Employee with null user maps without NPE")
    void employeeMapping_nullUser() {
        Employee emp = new Employee();
        emp.setId(UUID.randomUUID());
        emp.setUser(null);

        EmployeeDTO dto = mapper.map(emp, EmployeeDTO.class);
        assertNull(dto.getUserId());
    }

    @Test
    @DisplayName("Employee with user but null status maps without NPE")
    void employeeMapping_userWithNullStatus() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setStatus(null);

        Employee emp = new Employee();
        emp.setId(UUID.randomUUID());
        emp.setUser(user);

        EmployeeDTO dto = mapper.map(emp, EmployeeDTO.class);
        assertEquals(user.getId(), dto.getUserId());
        assertNull(dto.getStatus());
    }

    @Test
    @DisplayName("Task with null team, createdBy, completedBy, pendingBy, tags maps without NPE")
    void taskMapping_allNullFields() {
        Task task = new Task();
        task.setId(UUID.randomUUID());
        task.setTitle("Null test");
        task.setTeam(null);
        task.setCreatedBy(null);
        task.setCompletedBy(null);
        task.setPendingBy(null);
        task.setTags(null);

        TaskDTO dto = mapper.map(task, TaskDTO.class);
        assertNull(dto.getTeamId());
        assertNull(dto.getCreatedBy());
        assertNull(dto.getCompletedById());
        assertNull(dto.getPendingById());
    }

    @Test
    @DisplayName("Task with completedBy and pendingBy maps their IDs correctly")
    void taskMapping_completedByAndPendingBy() {
        User completedBy = new User();
        completedBy.setId(UUID.randomUUID());
        completedBy.setUsername("completer");

        User pendingBy = new User();
        pendingBy.setId(UUID.randomUUID());
        pendingBy.setUsername("approver");

        Task task = new Task();
        task.setId(UUID.randomUUID());
        task.setTitle("Done task");
        task.setCompletedBy(completedBy);
        task.setPendingBy(pendingBy);

        TaskDTO dto = mapper.map(task, TaskDTO.class);
        assertEquals(completedBy.getId(), dto.getCompletedById());
        assertEquals("completer", dto.getCompletedByName());
        assertEquals(pendingBy.getId(), dto.getPendingById());
        assertEquals("approver", dto.getPendingByName());
    }

    @Test
    @DisplayName("Task with non-null tags maps them to a LinkedHashSet")
    void taskMapping_withTags() {
        Task task = new Task();
        task.setId(UUID.randomUUID());
        task.setTitle("Tagged task");
        LinkedHashSet<String> tags = new LinkedHashSet<>();
        tags.add("urgent");
        tags.add("backend");
        task.setTags(tags);

        TaskDTO dto = mapper.map(task, TaskDTO.class);
        assertNotNull(dto.getTags());
        assertTrue(dto.getTags().contains("urgent"));
        assertTrue(dto.getTags().contains("backend"));
    }

    @Test
    @DisplayName("TaskAssignment with null task and null employee maps without NPE")
    void taskAssignmentMapping_nullTaskAndEmployee() {
        TaskAssignment assignment = new TaskAssignment();
        assignment.setTask(null);
        assignment.setEmployee(null);

        TaskAssignmentDTO dto = mapper.map(assignment, TaskAssignmentDTO.class);
        assertNull(dto.getTaskId());
        assertNull(dto.getEmployeeId());
    }

    @Test
    @DisplayName("EmployeeSkill with null skill maps without NPE")
    void employeeSkillMapping_nullSkill() {
        EmployeeSkill empSkill = new EmployeeSkill();
        empSkill.setSkill(null);

        EmployeeSkillDTO dto = mapper.map(empSkill, EmployeeSkillDTO.class);
        assertNull(dto.getSkillId());
        assertNull(dto.getSkillName());
    }

    @Test
    @DisplayName("Notification with null user maps without NPE")
    void notificationMapping_nullUser() {
        Notification notification = new Notification();
        notification.setId(UUID.randomUUID());
        notification.setUser(null);

        NotificationDTO dto = mapper.map(notification, NotificationDTO.class);
        assertNull(dto.getUserId());
    }

    @Test
    @DisplayName("AnomalyDetection with all fields maps correctly")
    void anomalyDetectionMapping_allFields() {
        User resolver = new User();
        resolver.setId(UUID.randomUUID());
        resolver.setUsername("admin");

        AnomalyDetection anomaly = new AnomalyDetection();
        anomaly.setId(UUID.randomUUID());
        anomaly.setEntityType(EntityType.TASK);
        anomaly.setSeverity(Severity.HIGH);
        anomaly.setResolvedBy(resolver);
        anomaly.setAnomalyScore(BigDecimal.valueOf(0.92));

        AnomalyDetectionDTO dto = mapper.map(anomaly, AnomalyDetectionDTO.class);
        assertEquals(EntityType.TASK, dto.getEntityType());
        assertEquals(Severity.HIGH, dto.getSeverity());
        assertEquals(resolver.getId(), dto.getResolvedBy());
    }

    @Test
    @DisplayName("AnomalyDetection with null entityType, severity, resolvedBy maps without NPE")
    void anomalyDetectionMapping_nullFields() {
        AnomalyDetection anomaly = new AnomalyDetection();
        anomaly.setId(UUID.randomUUID());
        anomaly.setEntityType(null);
        anomaly.setSeverity(null);
        anomaly.setResolvedBy(null);

        AnomalyDetectionDTO dto = mapper.map(anomaly, AnomalyDetectionDTO.class);
        assertNull(dto.getEntityType());
        assertNull(dto.getSeverity());
        assertNull(dto.getResolvedBy());
    }

    @Test
    @DisplayName("ChatMessage with null sender, receiver, team, messageType maps without NPE")
    void chatMessageMapping_allNullFields() {
        ChatMessage msg = new ChatMessage();
        msg.setSender(null);
        msg.setReceiver(null);
        msg.setTeam(null);
        msg.setMessageType(null);

        ChatMessageDTO dto = mapper.map(msg, ChatMessageDTO.class);
        assertNull(dto.getSenderId());
        assertNull(dto.getReceiverId());
        assertNull(dto.getTeamId());
        assertNull(dto.getMessageType());
    }
}
