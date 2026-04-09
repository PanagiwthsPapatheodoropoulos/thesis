package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Repository for managing {@link ChatMessage} entities in the database.
 * Provides operations for querying direct messages and team messages.
 */
@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

        @Query("SELECT cm FROM ChatMessage cm WHERE cm.team.id = :teamId ORDER BY cm.createdAt DESC")
        List<ChatMessage> findByTeamIdOrderByCreatedAtDesc(@Param("teamId") UUID teamId);

        @Query("SELECT cm FROM ChatMessage cm WHERE " +
                        "(cm.sender.id = :userId OR cm.receiver.id = :userId) AND " +
                        "cm.sender.company.id = :companyId AND " +
                        "(cm.receiver IS NULL OR cm.receiver.company.id = :companyId)")
        List<ChatMessage> findAllUserMessagesByCompany(UUID userId, UUID companyId);

        @Query("SELECT cm FROM ChatMessage cm WHERE cm.receiver.id = :userId AND cm.isRead = false")
        List<ChatMessage> findUnreadByReceiverId(@Param("userId") UUID userId);

        // Get all messages for a user (for deletion)
        @Query("SELECT cm FROM ChatMessage cm WHERE " +
                        "(cm.sender.id = :userId OR cm.receiver.id = :userId) " +
                        "ORDER BY cm.createdAt DESC")
        List<ChatMessage> findAllUserMessages(@Param("userId") UUID userId);

        @Query("SELECT cm FROM ChatMessage cm WHERE cm.team.id = :teamId AND cm.team.company.id = :companyId ORDER BY cm.createdAt DESC")
        List<ChatMessage> findByTeamIdAndCompanyIdOrderByCreatedAtDesc(@Param("teamId") UUID teamId,
                        @Param("companyId") UUID companyId);

        @Query("SELECT cm FROM ChatMessage cm WHERE " +
                        "((cm.sender.id = :userId AND cm.receiver.id = :otherUserId) OR " +
                        " (cm.sender.id = :otherUserId AND cm.receiver.id = :userId)) AND " +
                        "cm.sender.company.id = :companyId AND cm.receiver.company.id = :companyId " +
                        "ORDER BY cm.createdAt ASC")
        List<ChatMessage> findDirectMessagesBetweenUsersAndCompany(
                        @Param("userId") UUID userId,
                        @Param("otherUserId") UUID otherUserId,
                        @Param("companyId") UUID companyId);

        @Query("SELECT COUNT(cm) FROM ChatMessage cm WHERE " +
                        "cm.receiver.id = :userId AND cm.receiver.company.id = :companyId AND cm.isRead = false")
        Long countUnreadByReceiverIdAndCompanyId(@Param("userId") UUID userId, @Param("companyId") UUID companyId);

        @Query("SELECT cm FROM ChatMessage cm WHERE " +
                        "cm.receiver.id = :userId AND cm.receiver.company.id = :companyId AND cm.isRead = false " +
                        "ORDER BY cm.createdAt DESC")
        List<ChatMessage> findUnreadByReceiverIdAndCompanyId(@Param("userId") UUID userId,
                        @Param("companyId") UUID companyId);

        default void saveAllAndFlush(List<ChatMessage> messages) {
                saveAll(messages);
                flush();
        }
}