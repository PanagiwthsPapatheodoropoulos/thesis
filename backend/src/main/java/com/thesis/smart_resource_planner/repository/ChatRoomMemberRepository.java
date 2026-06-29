package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.ChatRoomMember;
import com.thesis.smart_resource_planner.model.entity.ChatRoomMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ChatRoomMemberRepository extends JpaRepository<ChatRoomMember, ChatRoomMemberId> {
    List<ChatRoomMember> findByUserId(UUID userId);
    List<ChatRoomMember> findByChatRoomId(UUID chatRoomId);
}
