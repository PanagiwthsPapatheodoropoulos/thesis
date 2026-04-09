package com.thesis.smart_resource_planner.model.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CompanyRegistrationDTO {

    @NotBlank(message = "Company name is required")
    @Size(min = 2, max = 255)
    private String companyName;

    @NotBlank(message = "Admin username is required")
    @Size(min = 3, max = 100)
    private String adminUsername;

    @NotBlank(message = "Admin email is required")
    @Email(message = "Invalid email format")
    private String adminEmail;

    @NotBlank(message = "Admin password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String adminPassword;
}