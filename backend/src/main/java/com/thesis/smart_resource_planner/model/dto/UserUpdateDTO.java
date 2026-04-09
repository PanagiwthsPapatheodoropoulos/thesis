package com.thesis.smart_resource_planner.model.dto;

import com.thesis.smart_resource_planner.enums.UserRole;
import jakarta.validation.constraints.Email;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserUpdateDTO {

    @Email(message = "Email should be valid")
    private String email;

    private UserRole role;

    private Boolean isActive;

    private UUID teamId;
}
