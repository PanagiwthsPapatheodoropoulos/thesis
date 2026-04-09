// src/main/java/com/thesis/smart_resource_planner/config/ModelMapperConfig.java
package com.thesis.smart_resource_planner.config;

import com.thesis.smart_resource_planner.enums.EntityType;
import com.thesis.smart_resource_planner.enums.Severity;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.*;
import org.modelmapper.ModelMapper;
import org.modelmapper.convention.MatchingStrategies;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ModelMapperConfig {

    @Bean
    public ModelMapper modelMapper() {
        ModelMapper modelMapper = new ModelMapper();

        modelMapper.getConfiguration()
                .setMatchingStrategy(MatchingStrategies.LOOSE)
                .setSkipNullEnabled(true)
                .setAmbiguityIgnored(true);

        // User to UserDTO
        modelMapper.typeMap(User.class, UserDTO.class).addMappings(mapper -> {
            mapper.skip(UserDTO::setTeamId);
            mapper.skip(UserDTO::setTeamName);
            mapper.skip(UserDTO::setCompanyId);
            mapper.skip(UserDTO::setCompanyName);
        }).setPostConverter(context -> {
            User source = context.getSource();
            UserDTO dest = context.getDestination();

            if (source.getTeam() != null) {
                dest.setTeamId(source.getTeam().getId());
                dest.setTeamName(source.getTeam().getName());
            }

            if (source.getCompany() != null) {
                dest.setCompanyId(source.getCompany().getId());
                dest.setCompanyName(source.getCompany().getName());
            }

            return dest;
        });

        // Employee to EmployeeDTO
        modelMapper.typeMap(Employee.class, EmployeeDTO.class).addMappings(mapper -> {
            mapper.skip(EmployeeDTO::setUserId);
            mapper.skip(EmployeeDTO::setSkills);
        }).setPostConverter(context -> {
            Employee source = context.getSource();
            EmployeeDTO dest = context.getDestination();

            if (source.getUser() != null) {
                dest.setUserId(source.getUser().getId());
            }

            return dest;
        });

        // Task to TaskDTO - Skip requiredSkillIds
        modelMapper.typeMap(Task.class, TaskDTO.class).addMappings(mapper -> {
            mapper.skip(TaskDTO::setTeamId);
            mapper.skip(TaskDTO::setTeamName);
            mapper.skip(TaskDTO::setCreatedBy);
            mapper.skip(TaskDTO::setCreatedByName);
            mapper.skip(TaskDTO::setRequiredSkillIds); // Skip automatic mapping
            mapper.skip(TaskDTO::setAssignments); // Also skip assignments
        }).setPostConverter(context -> {
            Task source = context.getSource();
            TaskDTO dest = context.getDestination();

            if (source.getTeam() != null) {
                dest.setTeamId(source.getTeam().getId());
                dest.setTeamName(source.getTeam().getName());
            }

            if (source.getCreatedBy() != null) {
                dest.setCreatedBy(source.getCreatedBy().getId());
                dest.setCreatedByName(source.getCreatedBy().getUsername());
            }

            // DO NOT map requiredSkillIds here - let the service handle it

            return dest;
        });

        // TaskAssignment to TaskAssignmentDTO
        modelMapper.typeMap(TaskAssignment.class, TaskAssignmentDTO.class).addMappings(mapper -> {
            mapper.skip(TaskAssignmentDTO::setTaskId);
            mapper.skip(TaskAssignmentDTO::setTaskTitle);
            mapper.skip(TaskAssignmentDTO::setEmployeeId);
            mapper.skip(TaskAssignmentDTO::setEmployeeName);
        }).setPostConverter(context -> {
            TaskAssignment source = context.getSource();
            TaskAssignmentDTO dest = context.getDestination();
            if (source.getTask() != null) {
                dest.setTaskId(source.getTask().getId());
                dest.setTaskTitle(source.getTask().getTitle());
            }
            if (source.getEmployee() != null) {
                dest.setEmployeeId(source.getEmployee().getId());
                dest.setEmployeeName(source.getEmployee().getFirstName() + " " +
                        source.getEmployee().getLastName());
            }
            return dest;
        });

        // EmployeeSkill to EmployeeSkillDTO
        modelMapper.typeMap(EmployeeSkill.class, EmployeeSkillDTO.class).addMappings(mapper -> {
            mapper.skip(EmployeeSkillDTO::setSkillId);
            mapper.skip(EmployeeSkillDTO::setSkillName);
            mapper.skip(EmployeeSkillDTO::setSkillCategory);
        }).setPostConverter(context -> {
            EmployeeSkill source = context.getSource();
            EmployeeSkillDTO dest = context.getDestination();
            if (source.getSkill() != null) {
                dest.setSkillId(source.getSkill().getId());
                dest.setSkillName(source.getSkill().getName());
                dest.setSkillCategory(source.getSkill().getCategory());
            }
            return dest;
        });

        // Notification to NotificationDTO
        modelMapper.typeMap(Notification.class, NotificationDTO.class).addMappings(mapper -> {
            mapper.skip(NotificationDTO::setUserId);
        }).setPostConverter(context -> {
            Notification source = context.getSource();
            NotificationDTO dest = context.getDestination();
            if (source.getUser() != null) {
                dest.setUserId(source.getUser().getId());
            }
            return dest;
        });

        // AnomalyDetection to AnomalyDetectionDTO
        modelMapper.typeMap(AnomalyDetection.class, AnomalyDetectionDTO.class).addMappings(mapper -> {
            mapper.skip(AnomalyDetectionDTO::setEntityType);
            mapper.skip(AnomalyDetectionDTO::setSeverity);
            mapper.skip(AnomalyDetectionDTO::setResolvedBy);
        }).setPostConverter(context -> {
            AnomalyDetection source = context.getSource();
            AnomalyDetectionDTO dest = context.getDestination();
            if (source.getEntityType() != null) {
                dest.setEntityType(EntityType.valueOf(source.getEntityType().name()));
            }
            if (source.getSeverity() != null) {
                dest.setSeverity(Severity.valueOf(source.getSeverity().name()));
            }
            if (source.getResolvedBy() != null) {
                dest.setResolvedBy(source.getResolvedBy().getId());
            }
            return dest;
        });

        modelMapper.typeMap(ChatMessage.class, ChatMessageDTO.class).addMappings(mapper -> {
            mapper.skip(ChatMessageDTO::setSenderId);
            mapper.skip(ChatMessageDTO::setSenderName);
            mapper.skip(ChatMessageDTO::setReceiverId);
            mapper.skip(ChatMessageDTO::setReceiverName);
            mapper.skip(ChatMessageDTO::setTeamId);
            mapper.skip(ChatMessageDTO::setTeamName);
            mapper.skip(ChatMessageDTO::setSenderProfileImageUrl);
            mapper.skip(ChatMessageDTO::setReceiverProfileImageUrl);
        }).setPostConverter(context -> {
            ChatMessage source = context.getSource();
            ChatMessageDTO dest = context.getDestination();

            if (source.getSender() != null) {
                dest.setSenderId(source.getSender().getId());
                dest.setSenderName(source.getSender().getUsername());
            }

            if (source.getReceiver() != null) {
                dest.setReceiverId(source.getReceiver().getId());
                dest.setReceiverName(source.getReceiver().getUsername());
            }

            if (source.getTeam() != null) {
                dest.setTeamId(source.getTeam().getId());
                dest.setTeamName(source.getTeam().getName());
            }

            if (source.getMessageType() != null) {
                dest.setMessageType(source.getMessageType().name());
            }

            return dest;
        });

        return modelMapper;
    }
}