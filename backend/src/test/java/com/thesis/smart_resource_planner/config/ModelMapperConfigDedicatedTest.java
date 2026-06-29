package com.thesis.smart_resource_planner.config;

import com.thesis.smart_resource_planner.enums.MessageType;
import com.thesis.smart_resource_planner.model.dto.ChatMessageDTO;
import com.thesis.smart_resource_planner.model.dto.EmployeeDTO;
import com.thesis.smart_resource_planner.model.dto.EmployeeSkillDTO;
import com.thesis.smart_resource_planner.model.dto.NotificationDTO;
import com.thesis.smart_resource_planner.model.dto.TaskAssignmentDTO;
import com.thesis.smart_resource_planner.model.dto.TaskDTO;
import com.thesis.smart_resource_planner.model.dto.UserDTO;
import com.thesis.smart_resource_planner.model.entity.ChatMessage;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.EmployeeSkill;
import com.thesis.smart_resource_planner.model.entity.Notification;
import com.thesis.smart_resource_planner.model.entity.Skill;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskAssignment;
import com.thesis.smart_resource_planner.model.entity.Team;
import com.thesis.smart_resource_planner.model.entity.User;
import org.junit.jupiter.api.Test;
import org.modelmapper.ModelMapper;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ModelMapperConfigDedicatedTest {

    private final ModelMapper mapper = new ModelMapperConfig().modelMapper();

    @Test
    void mapsUserTaskEmployeeAndNotificationPostConverters() {
        UUID companyId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        Company company = new Company();
        company.setId(companyId);
        company.setName("Acme");

        Team team = new Team();
        team.setId(teamId);
        team.setName("Core");

        User user = new User();
        user.setId(userId);
        user.setUsername("john");
        user.setCompany(company);
        user.setTeam(team);

        UserDTO userDTO = mapper.map(user, UserDTO.class);
        assertEquals(companyId, userDTO.getCompanyId());
        assertEquals("Acme", userDTO.getCompanyName());
        assertEquals(teamId, userDTO.getTeamId());
        assertEquals("Core", userDTO.getTeamName());

        Employee employee = new Employee();
        employee.setId(UUID.randomUUID());
        employee.setUser(user);
        EmployeeDTO employeeDTO = mapper.map(employee, EmployeeDTO.class);
        assertEquals(userId, employeeDTO.getUserId());

        Task task = new Task();
        task.setId(UUID.randomUUID());
        task.setTitle("Task");
        task.setTeam(team);
        task.setCreatedBy(user);
        TaskDTO taskDTO = mapper.map(task, TaskDTO.class);
        assertEquals(teamId, taskDTO.getTeamId());
        assertEquals("Core", taskDTO.getTeamName());
        assertEquals(userId, taskDTO.getCreatedBy());
        assertEquals("john", taskDTO.getCreatedByName());

        Notification notification = new Notification();
        notification.setId(UUID.randomUUID());
        notification.setUser(user);
        NotificationDTO notificationDTO = mapper.map(notification, NotificationDTO.class);
        assertEquals(userId, notificationDTO.getUserId());
    }

    @Test
    void mapsTaskAssignmentEmployeeSkillAndChatMessagePostConverters() {
        User sender = new User();
        sender.setId(UUID.randomUUID());
        sender.setUsername("sender");

        User receiver = new User();
        receiver.setId(UUID.randomUUID());
        receiver.setUsername("receiver");

        Team team = new Team();
        team.setId(UUID.randomUUID());
        team.setName("Alpha");

        Task task = new Task();
        task.setId(UUID.randomUUID());
        task.setTitle("T1");

        Employee emp = new Employee();
        emp.setId(UUID.randomUUID());
        emp.setFirstName("Jane");
        emp.setLastName("Doe");

        TaskAssignment assignment = new TaskAssignment();
        assignment.setTask(task);
        assignment.setEmployee(emp);
        TaskAssignmentDTO assignmentDTO = mapper.map(assignment, TaskAssignmentDTO.class);
        assertEquals(task.getId(), assignmentDTO.getTaskId());
        assertEquals("T1", assignmentDTO.getTaskTitle());
        assertEquals(emp.getId(), assignmentDTO.getEmployeeId());
        assertEquals("Jane Doe", assignmentDTO.getEmployeeName());

        Skill skill = new Skill();
        skill.setId(UUID.randomUUID());
        skill.setName("Java");
        skill.setCategory("Backend");
        EmployeeSkill employeeSkill = new EmployeeSkill();
        employeeSkill.setSkill(skill);
        EmployeeSkillDTO skillDTO = mapper.map(employeeSkill, EmployeeSkillDTO.class);
        assertEquals(skill.getId(), skillDTO.getSkillId());
        assertEquals("Java", skillDTO.getSkillName());
        assertEquals("Backend", skillDTO.getSkillCategory());

        ChatMessage msg = new ChatMessage();
        msg.setSender(sender);
        msg.setReceiver(receiver);
        msg.setTeam(team);
        msg.setMessageType(MessageType.TEXT);
        ChatMessageDTO msgDTO = mapper.map(msg, ChatMessageDTO.class);
        assertEquals(sender.getId(), msgDTO.getSenderId());
        assertEquals("sender", msgDTO.getSenderName());
        assertEquals(receiver.getId(), msgDTO.getReceiverId());
        assertEquals("receiver", msgDTO.getReceiverName());
        assertEquals(team.getId(), msgDTO.getTeamId());
        assertEquals("Alpha", msgDTO.getTeamName());
        assertEquals("TEXT", msgDTO.getMessageType());
    }
}
