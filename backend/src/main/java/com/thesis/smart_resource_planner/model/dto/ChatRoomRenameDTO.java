package com.thesis.smart_resource_planner.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoomRenameDTO {

    @NotBlank(message = "Chat room name is required")
    private String name;
}
