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
 *
 * <p>
 * Central repository for user management operations including authentication
 * lookups, team/company-scoped queries, role-based filtering, and aggregate
 * counts needed for validation and statistics.
 * </p>
 */
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Looks up a user by their unique username.
     *
     * @param username the username to search for
     * @return an {@link Optional} containing the user, or empty if not found
     */
    Optional<User> findByUsername(String username);

    /**
     * Looks up a user by their email address.
     *
     * @param email the email address to search for
     * @return an {@link Optional} containing the user, or empty if not found
     */
    Optional<User> findByEmail(String email);

    /**
     * Looks up a user by either username or email — used during authentication
     * to support both login identifiers.
     *
     * @param username the username to match
     * @param email    the email address to match
     * @return an {@link Optional} containing the matching user, or empty if not
     *         found
     */
    Optional<User> findByUsernameOrEmail(String username, String email);

    /**
     * Returns all users currently assigned to a specific team.
     *
     * @param teamId the UUID of the team
     * @return list of {@link User} entities in that team (may be empty)
     */
    List<User> findByTeamId(UUID teamId);

    /**
     * Returns all users that have been assigned a specific role.
     *
     * @param role the {@link UserRole} to filter by
     * @return list of matching {@link User} entities
     */
    List<User> findByRole(UserRole role);

    /**
     * Checks whether a user with the given username already exists.
     *
     * @param username the username to check
     * @return {@code true} if the username is taken, {@code false} otherwise
     */
    boolean existsByUsername(String username);

    /**
     * Checks whether a user with the given email address already exists.
     *
     * @param email the email address to check
     * @return {@code true} if the email is taken, {@code false} otherwise
     */
    boolean existsByEmail(String email);

    /**
     * Returns all users whose account is currently marked as active.
     *
     * @return list of active {@link User} entities
     */
    List<User> findByIsActiveTrue();

    /**
     * Counts how many users have been assigned a specific role.
     *
     * @param role the {@link UserRole} to count
     * @return total number of users with that role
     */
    long countByRole(UserRole role);

    /**
     * Counts how many users are currently assigned to a specific team.
     *
     * @param teamId the UUID of the team
     * @return number of users in that team
     */
    long countByTeamId(UUID teamId);

    /**
     * Loads a user by ID and eagerly fetches their team in the same query,
     * avoiding a separate query when team data is immediately needed.
     *
     * @param id the UUID of the user
     * @return an {@link Optional} containing the user with their team loaded,
     *         or empty if not found
     */
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.team WHERE u.id = :id")
    Optional<User> findByIdWithTeam(@Param("id") UUID id);

    /**
     * Returns all users belonging to a specific company.
     *
     * @param companyId the UUID of the company
     * @return list of {@link User} entities in that company
     */
    List<User> findByCompanyId(UUID companyId);

    /**
     * Returns all users belonging to a specific company who have a specific role.
     *
     * @param companyId the UUID of the company
     * @param role      the {@link UserRole} to filter by
     * @return list of matching {@link User} entities
     */
    List<User> findByCompanyIdAndRole(UUID companyId, UserRole role);

    /**
     * Counts the total number of users registered under a specific company.
     *
     * @param companyId the UUID of the company
     * @return total user count for that company
     */
    long countByCompanyId(UUID companyId);

    /**
     * Retrieves all users in a company that have a specific role using a JPQL
     * query.
     *
     * @param role      the {@link UserRole} to filter by
     * @param companyId the UUID of the company
     * @return list of matching {@link User} entities
     */
    @Query("SELECT u FROM User u WHERE u.role = :role AND u.company.id = :companyId")
    List<User> findByRoleAndCompanyId(@Param("role") UserRole role, @Param("companyId") UUID companyId);

}
