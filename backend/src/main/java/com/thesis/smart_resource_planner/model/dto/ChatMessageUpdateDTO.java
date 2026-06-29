package com.thesis.smart_resource_planner.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ChatMessageUpdateDTO {
    @NotBlank(message = "Message content cannot be blank")
    private String message;
}
