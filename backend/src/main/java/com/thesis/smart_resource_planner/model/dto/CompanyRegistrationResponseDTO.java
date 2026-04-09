package com.thesis.smart_resource_planner.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompanyRegistrationResponseDTO {
    private UUID companyId;
    private String companyName;
    private String joinCode;
    private UserDTO adminUser;
    private String message;
}