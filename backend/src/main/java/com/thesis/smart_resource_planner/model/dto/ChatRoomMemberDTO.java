package com.thesis.smart_resource_planner.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoomMemberDTO {
    private UUID userId;
    private String userName;
    private String userProfileImageUrl;
    private String role;
    private LocalDateTime joinedAt;
}
