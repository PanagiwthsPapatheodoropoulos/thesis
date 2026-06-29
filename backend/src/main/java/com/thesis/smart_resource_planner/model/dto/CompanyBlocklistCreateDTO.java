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
public class CompanyBlocklistCreateDTO {

    @NotBlank(message = "Email is required")
    private String email;
}
