package com.thesis.smart_resource_planner.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
@ActiveProfiles("test")
class AllServicesBeanDedicatedTest {

    @Autowired
    private ApplicationContext applicationContext;

    @Test
    void allServiceBeansAreLoaded() throws ClassNotFoundException {
        String[] services = {
                "com.thesis.smart_resource_planner.service.AIService",
                "com.thesis.smart_resource_planner.service.AuthService",
                "com.thesis.smart_resource_planner.service.ChatService",
                "com.thesis.smart_resource_planner.service.CompanyService",
                "com.thesis.smart_resource_planner.service.DepartmentService",
                "com.thesis.smart_resource_planner.service.EmployeeService",
                "com.thesis.smart_resource_planner.service.NotificationService",
                "com.thesis.smart_resource_planner.service.SkillService",
                "com.thesis.smart_resource_planner.service.SuperAdminService",
                "com.thesis.smart_resource_planner.service.TaskAssignmentService",
                "com.thesis.smart_resource_planner.service.TaskAuditLogService",
                "com.thesis.smart_resource_planner.service.TaskCommentService",
                "com.thesis.smart_resource_planner.service.TaskService",
                "com.thesis.smart_resource_planner.service.TaskTimeEntryService",
                "com.thesis.smart_resource_planner.service.TeamService",
                "com.thesis.smart_resource_planner.service.UserService",
                "com.thesis.smart_resource_planner.service.WebSocketBroadcastService"
        };

        for (String className : services) {
            Class<?> clazz = Class.forName(className);
            Object bean = applicationContext.getBean(clazz);
            assertNotNull(bean, "Missing bean: " + className);
        }
    }
}

