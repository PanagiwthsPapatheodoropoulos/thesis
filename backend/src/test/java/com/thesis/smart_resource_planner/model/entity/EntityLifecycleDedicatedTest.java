package com.thesis.smart_resource_planner.model.entity;

import com.thesis.smart_resource_planner.enums.EntityType;
import com.thesis.smart_resource_planner.enums.MessageType;
import com.thesis.smart_resource_planner.enums.NotificationSeverity;
import com.thesis.smart_resource_planner.enums.Severity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class EntityLifecycleDedicatedTest {

    @Test
    void employeeAndRelatedEntitiesLifecycleCallbacks() {
        Employee employee = new Employee();
        employee.onCreate();
        assertNotNull(employee.getCreatedAt());
        assertNotNull(employee.getUpdatedAt());

        LocalDateTime oldUpdated = employee.getUpdatedAt();
        employee.onUpdate();
        assertNotNull(employee.getUpdatedAt());
        assertFalse(employee.getUpdatedAt().isBefore(oldUpdated));

        EmployeeSkill employeeSkill = new EmployeeSkill();
        employeeSkill.setYearsOfExperience(BigDecimal.valueOf(2.5));
        employeeSkill.onCreate();
        assertNotNull(employeeSkill.getCreatedAt());
        assertNotNull(employeeSkill.getUpdatedAt());
        employeeSkill.onUpdate();
        assertNotNull(employeeSkill.getUpdatedAt());

        EmployeeAvailability availability = new EmployeeAvailability();
        availability.setDate(LocalDate.now());
        availability.onCreate();
        assertNotNull(availability.getCreatedAt());
        assertEquals(BigDecimal.valueOf(8.0), availability.getAvailableHours());
        assertTrue(availability.getIsAvailable());
    }

    @Test
    void notificationChatCompanyAnomalyAndSkillCallbacks() {
        Notification notification = new Notification();
        notification.setSeverity(NotificationSeverity.WARNING);
        notification.setRelatedEntityType(EntityType.TASK);
        notification.onCreate();
        assertNotNull(notification.getCreatedAt());
        assertFalse(Boolean.TRUE.equals(notification.getIsRead()));

        ChatMessage chatMessage = new ChatMessage();
        chatMessage.setMessageType(MessageType.FILE);
        chatMessage.onCreate();
        assertNotNull(chatMessage.getCreatedAt());
        assertFalse(Boolean.TRUE.equals(chatMessage.getIsRead()));

        Company company = new Company();
        company.onCreate();
        assertNotNull(company.getCreatedAt());
        assertNotNull(company.getUpdatedAt());
        assertTrue(company.getIsActive());
        company.onUpdate();
        assertNotNull(company.getUpdatedAt());

        Skill skill = new Skill();
        skill.setName("Java");
        skill.onCreate();
        assertNotNull(skill.getCreatedAt());

        AnomalyDetection anomaly = new AnomalyDetection();
        anomaly.setEntityType(EntityType.TASK);
        anomaly.setEntityId(UUID.randomUUID());
        anomaly.setAnomalyType("Overrun");
        anomaly.setSeverity(Severity.HIGH);
        anomaly.onCreate();
        assertNotNull(anomaly.getCreatedAt());
        assertNotNull(anomaly.getDetectedAt());
        assertFalse(Boolean.TRUE.equals(anomaly.getResolved()));
    }
}
