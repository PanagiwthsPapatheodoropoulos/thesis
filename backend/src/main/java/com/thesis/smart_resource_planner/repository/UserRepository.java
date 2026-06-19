package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link User} entities.
 */
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    Optional<User> findByUsernameOrEmail(String username, String email);

    List<User> findByTeamId(UUID teamId);

    List<User> findByRole(UserRole role);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    List<User> findByIsActiveTrue();

    long countByRole(UserRole role);

    long countByTeamId(UUID teamId);

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.team WHERE u.id = :id")
    Optional<User> findByIdWithTeam(@Param("id") UUID id);

    List<User> findByCompanyId(UUID companyId);

    List<User> findByCompanyIdAndRole(UUID companyId, UserRole role);

    long countByCompanyId(UUID companyId);

    /**
     * Counts users in a company whose role is NOT the given role.
     * Used to count non-admin members (EMPLOYEE + MANAGER) for display.
     */
    @Query("SELECT COUNT(u) FROM User u WHERE u.company.id = :companyId AND u.role != :excludedRole")
    long countByCompanyIdAndRoleNot(@Param("companyId") UUID companyId, @Param("excludedRole") UserRole excludedRole);

    @Query("SELECT u FROM User u WHERE u.role = :role AND u.company.id = :companyId")
    List<User> findByRoleAndCompanyId(@Param("role") UserRole role, @Param("companyId") UUID companyId);
}
