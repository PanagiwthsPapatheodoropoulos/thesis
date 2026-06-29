package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.Team;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link Team} entities.
 *
 * <p>
 * Provides standard CRUD operations as well as custom queries for finding
 * teams within a company, loading team members eagerly, and retrieving
 * member-count projections to avoid N+1 fetch problems.
 * </p>
 */
@Repository
public interface TeamRepository extends JpaRepository<Team, UUID> {

        /**
         * Checks whether a team with the given name already exists across the system.
         *
         * @param name the team name to check
         * @return {@code true} if a team with that name exists, {@code false} otherwise
         */
        boolean existsByName(String name);

        /**
         * Loads a team by its ID together with its member list in a single query,
         * preventing the Hibernate N+1 problem when iterating over members.
         *
         * @param id the UUID of the team to fetch
         * @return an {@link Optional} containing the team with its users loaded,
         *         or empty if not found
         */
        @Query("SELECT t FROM Team t LEFT JOIN FETCH t.users WHERE t.id = :id")
        Optional<Team> findByIdWithMembers(@Param("id") UUID id);

        /**
         * Returns projection data (id, name, description, companyId, createdAt,
         * updatedAt, memberCount) for all teams in a company, grouped for counting.
         *
         * @param companyId the UUID of the company
         * @return list of raw {@code Object[]} rows, one per team
         */
        @Query("SELECT t.id, t.name, t.description, t.company.id, t.createdAt, t.updatedAt, COUNT(u.id) as memberCount "
                        +
                        "FROM Team t LEFT JOIN User u ON u.team.id = t.id " +
                        "WHERE t.company.id = :companyId " +
                        "GROUP BY t.id, t.name, t.description, t.company.id, t.createdAt, t.updatedAt")
        List<Object[]> findTeamsWithMemberCountByCompanyId(@Param("companyId") UUID companyId);

        /**
         * Returns paginated projection data for all teams in a company, including a
         * subquery-based member count per team.
         *
         * @param companyId the UUID of the company
         * @param pageable  pagination and sorting parameters
         * @return a {@link Page} of raw {@code Object[]} rows containing team metadata
         *         and member counts
         */
        @Query("SELECT t.id, t.name, t.description, t.company.id, t.createdAt, t.updatedAt, " +
                        "(SELECT COUNT(u) FROM User u WHERE u.team.id = t.id) as memberCount " +
                        "FROM Team t WHERE t.company.id = :companyId")
        Page<Object[]> findTeamsWithMemberCountByCompanyIdPaginated(
                        @Param("companyId") UUID companyId,
                        Pageable pageable);

        /**
         * Retrieves all teams that belong to a specific company.
         *
         * @param companyId the UUID of the company
         * @return list of {@link Team} entities for that company (may be empty)
         */
        List<Team> findByCompanyId(UUID companyId);

}
