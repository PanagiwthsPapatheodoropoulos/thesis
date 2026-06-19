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
public class ChatMessageDTO {
    private UUID id;
    private UUID senderId;
    private String senderName;
    private UUID receiverId;
    private String receiverName;
    private UUID teamId;
    private String teamName;
    private String message;
    private Boolean isRead;
    private String messageType;
    private LocalDateTime createdAt;
    private String senderProfileImageUrl;
    private String receiverProfileImageUrl;
}
