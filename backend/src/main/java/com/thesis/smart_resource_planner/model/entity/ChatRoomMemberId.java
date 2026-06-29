package com.thesis.smart_resource_planner.model.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoomMemberId implements Serializable {
    private UUID chatRoom;
    private UUID user;
}
