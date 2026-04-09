package com.thesis.smart_resource_planner.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentCreateDTO {

    @NotBlank(message = "Department name is required")
    @Size(max = 255)
    private String name;

    private String description;
}