package com.thesis.smart_resource_planner.model.dto;

import com.thesis.smart_resource_planner.enums.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Builder
@NoArgsConstructor
@Data
@AllArgsConstructor
public class UserDTO {
    private UUID id;
    private String username;
    private String email;
    private UserRole role;
    private Boolean isActive;
    private UUID companyId;
    private String companyName;
    private UUID teamId;
    private String teamName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String profileImageUrl;
}
