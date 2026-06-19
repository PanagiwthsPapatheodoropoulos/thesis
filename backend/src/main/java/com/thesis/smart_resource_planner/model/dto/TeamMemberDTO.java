
package com.thesis.smart_resource_planner.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TeamMemberDTO {
    private UUID userId;
    private String username;
    private String email;
    private String role;
}