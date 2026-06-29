package com.thesis.smart_resource_planner.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoomCreateDTO {

    @NotBlank(message = "Chat room name is required")
    private String name;

    @NotEmpty(message = "At least one member must be selected")
    private List<UUID> memberIds;
}
