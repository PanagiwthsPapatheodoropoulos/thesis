package com.thesis.smart_resource_planner.model.dto;

import com.thesis.smart_resource_planner.enums.MessageType;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageCreateDTO {

    @NotBlank(message = "Message is required")
    private String message;

    private UUID receiverId;
    private UUID teamId;

    private MessageType messageType;
}