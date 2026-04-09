package com.thesis.smart_resource_planner.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationDTO {
    private UUID partnerId;
    private String partnerName;
    private String partnerRole;
    private String lastMessage;
    private LocalDateTime lastMessageTime;
    private Integer unreadCount;
}