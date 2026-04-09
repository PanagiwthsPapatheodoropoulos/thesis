package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Repository for managing {@link Notification} entities in the database.
 * Provides operations to list, filter, and count unread notifications per user
 * and company.
 */
@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {
        List<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId);

        @Query("SELECT n FROM Notification n WHERE n.user.id = :userId AND n.user.company.id = :companyId ORDER BY n.createdAt DESC")
        List<Notification> findByUserIdAndCompanyId(UUID userId, UUID companyId);

        @Query("SELECT n FROM Notification n WHERE n.user.id = :userId " +
                        "AND n.isRead = false ORDER BY n.createdAt DESC")
        List<Notification> findUnreadByUserId(@Param("userId") UUID userId);

        @Query("SELECT COUNT(n) FROM Notification n WHERE n.user.id = :userId AND n.isRead = false")
        Long countUnreadByUserId(@Param("userId") UUID userId);

        @Query("SELECT n FROM Notification n WHERE n.user.id = :userId AND n.user.company.id = :companyId ORDER BY n.createdAt DESC")
        List<Notification> findByUserIdAndCompanyIdOrderByCreatedAtDesc(@Param("userId") UUID userId,
                        @Param("companyId") UUID companyId);

        @Query("SELECT n FROM Notification n WHERE n.user.id = :userId AND n.user.company.id = :companyId AND n.isRead = false ORDER BY n.createdAt DESC")
        List<Notification> findUnreadByUserIdAndCompanyId(@Param("userId") UUID userId,
                        @Param("companyId") UUID companyId);

        @Query("SELECT COUNT(n) FROM Notification n WHERE n.user.id = :userId AND n.user.company.id = :companyId AND n.isRead = false")
        Long countUnreadByUserIdAndCompanyId(@Param("userId") UUID userId, @Param("companyId") UUID companyId);

}