package com.thesis.smart_resource_planner.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
@ActiveProfiles("test")
class AllControllersBeanTest {

    @Autowired
    private ApplicationContext applicationContext;

    @Test
    void allControllerBeansAreLoaded() throws ClassNotFoundException {
        String[] controllers = {
                "com.thesis.smart_resource_planner.controller.AIController",
                "com.thesis.smart_resource_planner.controller.AuthController",
                "com.thesis.smart_resource_planner.controller.BulkTaskController",
                "com.thesis.smart_resource_planner.controller.ChatController",
                "com.thesis.smart_resource_planner.controller.CompanyController",
                "com.thesis.smart_resource_planner.controller.DepartmentController",
                "com.thesis.smart_resource_planner.controller.EmployeeController",
                "com.thesis.smart_resource_planner.controller.NotificationController",
                "com.thesis.smart_resource_planner.controller.SkillController",
                "com.thesis.smart_resource_planner.controller.SuperAdminController",
                "com.thesis.smart_resource_planner.controller.TaskAssignmentController",
                "com.thesis.smart_resource_planner.controller.TaskAuditLogController",
                "com.thesis.smart_resource_planner.controller.TaskCommentController",
                "com.thesis.smart_resource_planner.controller.TaskController",
                "com.thesis.smart_resource_planner.controller.TaskTimeEntryController",
                "com.thesis.smart_resource_planner.controller.TeamController",
                "com.thesis.smart_resource_planner.controller.UserController"
        };

        for (String className : controllers) {
            Class<?> clazz = Class.forName(className);
            Object bean = applicationContext.getBean(clazz);
            assertNotNull(bean, "Missing bean: " + className);
        }
    }
}

