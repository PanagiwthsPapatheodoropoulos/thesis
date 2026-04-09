package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.enums.TaskPriority;
import com.thesis.smart_resource_planner.enums.TaskStatus;
import com.thesis.smart_resource_planner.model.entity.Task;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link Task} entities.
 * Provides both derived-query and JPQL/native-query methods for filtering,
 * searching, and paginating tasks by company, role, status, priority, and text.
 * Role-based visibility queries separate what ADMIN/MANAGER and EMPLOYEE users
 * see.
 */
@Repository
public interface TaskRepository extends JpaRepository<Task, UUID> {
        /** Returns all tasks with the given status regardless of company. */
        List<Task> findByStatus(TaskStatus status);

        /** Returns all tasks with the given priority regardless of company. */
        List<Task> findByPriority(TaskPriority priority);

        /** Returns all tasks assigned to a specific team. */
        List<Task> findByTeamId(UUID teamId);

        /** Returns all tasks created by a specific user. */
        List<Task> findByCreatedById(UUID userId);

        /** Returns all tasks directly assigned to a specific employee. */
        List<Task> findByAssignedEmployeeId(UUID employeeId);

        /**
         * Finds tasks whose due date falls within a given date range.
         *
         * @param startDate Start of the range (inclusive).
         * @param endDate   End of the range (inclusive).
         * @return Tasks due within the specified window.
         */
        @Query("SELECT t FROM Task t WHERE t.dueDate BETWEEN :startDate AND :endDate")
        List<Task> findByDueDateBetween(
                        @Param("startDate") LocalDateTime startDate,
                        @Param("endDate") LocalDateTime endDate);

        /**
         * Finds tasks that are past their due date AND do not have the given status.
         * Useful for identifying overdue active tasks.
         *
         * @param status The status to exclude (typically COMPLETED or CANCELLED).
         * @param now    The current timestamp used as the overdue boundary.
         * @return A list of overdue tasks.
         */
        @Query("SELECT t FROM Task t WHERE t.status = :status AND t.dueDate < :now")
        List<Task> findOverdueTasks(
                        @Param("status") TaskStatus status,
                        @Param("now") LocalDateTime now);

        /** Returns all tasks belonging to a given company (unpaginated). */
        List<Task> findByCompanyId(UUID companyId);

        /**
         * Returns tasks visible to an EMPLOYEE who is a member of a team.
         * Includes tasks the employee created, was directly assigned to, or
         * that belong to their team and are unassigned.
         *
         * @param companyId  The employee's company.
         * @param userId     The authenticated user's ID.
         * @param employeeId The employee's own profile ID.
         * @param teamId     The employee's current team ID.
         * @return Tasks visible under employee-with-team visibility rules.
         */
        @Query("SELECT t FROM Task t WHERE t.company.id = :companyId AND " +
                        "(" +
                        "(t.title LIKE '[REQUEST]%' AND t.createdBy.id = :userId) OR " +
                        "(" +
                        "t.title NOT LIKE '[REQUEST]%' AND " +
                        "(" +
                        "t.createdBy.id = :userId OR " +
                        "t.assignedEmployeeId = :employeeId OR " +
                        "(t.team.id = :teamId AND t.assignedEmployeeId IS NULL) OR " +
                        "(t.team IS NULL AND t.assignedEmployeeId IS NULL)" +
                        ")" +
                        ")" +
                        ")")
        List<Task> findVisibleTasksForEmployee(@Param("companyId") UUID companyId,
                        @Param("userId") UUID userId,
                        @Param("employeeId") UUID employeeId,
                        @Param("teamId") UUID teamId);

        /**
         * Like {@link #findVisibleTasksForEmployee} but for employees who have no team.
         * Excludes team-scoped rules and only returns directly assigned or company-wide
         * tasks.
         *
         * @param companyId  The employee's company.
         * @param userId     The authenticated user's ID.
         * @param employeeId The employee's own profile ID.
         * @return Tasks visible under employee-without-team visibility rules.
         */
        @Query("SELECT t FROM Task t WHERE t.company.id = :companyId AND " +
                        "(" +
                        "(t.title LIKE '[REQUEST]%' AND t.createdBy.id = :userId) OR " +
                        "(" +
                        "t.title NOT LIKE '[REQUEST]%' AND " +
                        "(" +
                        "t.createdBy.id = :userId OR " +
                        "t.assignedEmployeeId = :employeeId OR " +
                        "(t.team IS NULL AND t.assignedEmployeeId IS NULL)" +
                        ")" +
                        ")" +
                        ")")
        List<Task> findVisibleTasksForEmployeeNoTeam(@Param("companyId") UUID companyId,
                        @Param("userId") UUID userId,
                        @Param("employeeId") UUID employeeId);

        /** Returns a page of all company tasks without any additional filters. */
        Page<Task> findByCompanyId(UUID companyId, Pageable pageable);

        /**
         * Paginated task list for ADMIN and MANAGER roles, with optional status,
         * priority, and full-text search filters.
         */

        // For EMPLOYEE role WITH TEAM - paginated with filters
        @Query("SELECT t FROM Task t WHERE t.company.id = :companyId AND " +
                        "(" +
                        // Own requests (show even if pending)
                        "(t.title LIKE '[REQUEST]%' AND t.createdBy.id = :userId) OR " +

                        // Approved tasks only (NOT requests)
                        "(" +
                        "t.title NOT LIKE '[REQUEST]%' AND " +
                        "(" +
                        "t.createdBy.id = :userId OR " +
                        "t.assignedEmployeeId = :employeeId OR " +
                        "(t.team.id = :teamId AND t.assignedEmployeeId IS NULL) OR " +
                        "(t.team IS NULL AND t.assignedEmployeeId IS NULL)" +
                        ")" +
                        ")" +
                        ") " +
                        "AND (:status IS NULL OR t.status = :status) " +
                        "AND (:priority IS NULL OR t.priority = :priority) " +
                        "AND (:search IS NULL OR LOWER(t.title) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(t.description) LIKE LOWER(CONCAT('%', :search, '%')))")
        Page<Task> findVisibleTasksForEmployeePaginated(
                        @Param("companyId") UUID companyId,
                        @Param("userId") UUID userId,
                        @Param("employeeId") UUID employeeId,
                        @Param("teamId") UUID teamId,
                        @Param("status") TaskStatus status,
                        @Param("priority") TaskPriority priority,
                        @Param("search") String search,
                        Pageable pageable);

        // For EMPLOYEE role WITHOUT TEAM - paginated with filters
        @Query("SELECT t FROM Task t WHERE t.company.id = :companyId AND " +
                        "(" +
                        // Own requests
                        "(t.title LIKE '[REQUEST]%' AND t.createdBy.id = :userId) OR " +

                        // Approved tasks only
                        "(" +
                        "t.title NOT LIKE '[REQUEST]%' AND " +
                        "(" +
                        "t.createdBy.id = :userId OR " +
                        "t.assignedEmployeeId = :employeeId OR " +
                        "(t.team IS NULL AND t.assignedEmployeeId IS NULL)" +
                        ")" +
                        ")" +
                        ") " +
                        "AND (:status IS NULL OR t.status = :status) " +
                        "AND (:priority IS NULL OR t.priority = :priority) " +
                        "AND (:search IS NULL OR LOWER(t.title) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(t.description) LIKE LOWER(CONCAT('%', :search, '%')))")
        Page<Task> findVisibleTasksForEmployeeNoTeamPaginated(
                        @Param("companyId") UUID companyId,
                        @Param("userId") UUID userId,
                        @Param("employeeId") UUID employeeId,
                        @Param("status") TaskStatus status,
                        @Param("priority") TaskPriority priority,
                        @Param("search") String search,
                        Pageable pageable);

        // For ADMIN/MANAGER - paginated with filters
        @Query("SELECT t FROM Task t WHERE t.company.id = :companyId " +
                        "AND (:status IS NULL OR t.status = :status) " +
                        "AND (:priority IS NULL OR t.priority = :priority) " +
                        "AND (:search IS NULL OR LOWER(t.title) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(t.description) LIKE LOWER(CONCAT('%', :search, '%')))")
        Page<Task> findByCompanyIdWithFilters(
                        @Param("companyId") UUID companyId,
                        @Param("status") TaskStatus status,
                        @Param("priority") TaskPriority priority,
                        @Param("search") String search,
                        Pageable pageable);

        /** Returns tasks with the given status that belong to a specific company. */
        List<Task> findByStatusAndCompanyId(TaskStatus status, UUID companyId);

        /** Returns all tasks for a specific team within a company. */
        List<Task> findByTeamIdAndCompanyId(UUID teamId, UUID companyId);

        /**
         * Returns the most recently created PENDING tasks for a company.
         * Useful for surfacing unstarted work on the dashboard.
         *
         * @param companyId The company to query.
         * @return PENDING tasks ordered by creation date descending.
         */
        @Query("SELECT t FROM Task t WHERE t.company.id = :companyId AND t.status = 'PENDING' ORDER BY t.createdAt DESC")
        List<Task> findPendingTasksByCompany(@Param("companyId") UUID companyId);

        @Query(value = "SELECT * FROM tasks t WHERE t.company_id = :companyId " +
                        "AND (:status IS NULL OR t.status = CAST(:status AS VARCHAR)) " +
                        "AND (:priority IS NULL OR t.priority = CAST(:priority AS VARCHAR)) " +
                        "AND (:search IS NULL OR t.title ILIKE CONCAT('%', :search, '%') OR t.description ILIKE CONCAT('%', :search, '%'))", countQuery = "SELECT COUNT(*) FROM tasks t WHERE t.company_id = :companyId "
                                        +
                                        "AND (:status IS NULL OR t.status = CAST(:status AS VARCHAR)) " +
                                        "AND (:priority IS NULL OR t.priority = CAST(:priority AS VARCHAR)) " +
                                        "AND (:search IS NULL OR t.title ILIKE CONCAT('%', :search, '%') OR t.description ILIKE CONCAT('%', :search, '%'))", nativeQuery = true)
        Page<Task> findByCompanyIdWithFiltersNative(
                        @Param("companyId") UUID companyId,
                        @Param("status") String status,
                        @Param("priority") String priority,
                        @Param("search") String search,
                        Pageable pageable);

        // Native query for EMPLOYEE WITH TEAM with case-insensitive search
        @Query(value = "SELECT DISTINCT t.* FROM tasks t " +
                        "LEFT JOIN users u ON t.created_by = u.id " +
                        "WHERE t.company_id = :companyId " +
                        "AND (" +
                        "  (t.title LIKE '[REQUEST]%' AND t.created_by = :userId) OR " +
                        "  (" +
                        "    t.title NOT LIKE '[REQUEST]%' AND (" +
                        "      t.created_by = :userId OR " +
                        "      t.assigned_employee_id = :employeeId OR " +
                        "      (t.team_id = :teamId AND t.assigned_employee_id IS NULL) OR " +
                        "      (t.team_id IS NULL AND t.assigned_employee_id IS NULL)" +
                        "    )" +
                        "  )" +
                        ") " +
                        "AND (:status IS NULL OR t.status = CAST(:status AS VARCHAR)) " +
                        "AND (:priority IS NULL OR t.priority = CAST(:priority AS VARCHAR)) " +
                        "AND (:search IS NULL OR t.title ILIKE CONCAT('%', :search, '%') OR t.description ILIKE CONCAT('%', :search, '%'))", countQuery = "SELECT COUNT(DISTINCT t.id) FROM tasks t "
                                        +
                                        "LEFT JOIN users u ON t.created_by = u.id " +
                                        "WHERE t.company_id = :companyId " +
                                        "AND (" +
                                        "  (t.title LIKE '[REQUEST]%' AND t.created_by = :userId) OR " +
                                        "  (" +
                                        "    t.title NOT LIKE '[REQUEST]%' AND (" +
                                        "      t.created_by = :userId OR " +
                                        "      t.assigned_employee_id = :employeeId OR " +
                                        "      (t.team_id = :teamId AND t.assigned_employee_id IS NULL) OR " +
                                        "      (t.team_id IS NULL AND t.assigned_employee_id IS NULL)" +
                                        "    )" +
                                        "  )" +
                                        ") " +
                                        "AND (:status IS NULL OR t.status = CAST(:status AS VARCHAR)) " +
                                        "AND (:priority IS NULL OR t.priority = CAST(:priority AS VARCHAR)) " +
                                        "AND (:search IS NULL OR t.title ILIKE CONCAT('%', :search, '%') OR t.description ILIKE CONCAT('%', :search, '%'))", nativeQuery = true)
        Page<Task> findVisibleTasksForEmployeePaginatedNative(
                        @Param("companyId") UUID companyId,
                        @Param("userId") UUID userId,
                        @Param("employeeId") UUID employeeId,
                        @Param("teamId") UUID teamId,
                        @Param("status") String status,
                        @Param("priority") String priority,
                        @Param("search") String search,
                        Pageable pageable);

        // Native query for EMPLOYEE WITHOUT TEAM with case-insensitive search
        @Query(value = "SELECT DISTINCT t.* FROM tasks t " +
                        "WHERE t.company_id = :companyId " +
                        "AND (" +
                        "  (t.title LIKE '[REQUEST]%' AND t.created_by = :userId) OR " +
                        "  (" +
                        "    t.title NOT LIKE '[REQUEST]%' AND (" +
                        "      t.created_by = :userId OR " +
                        "      t.assigned_employee_id = :employeeId OR " +
                        "      (t.team_id IS NULL AND t.assigned_employee_id IS NULL)" +
                        "    )" +
                        "  )" +
                        ") " +
                        "AND (:status IS NULL OR t.status = CAST(:status AS VARCHAR)) " +
                        "AND (:priority IS NULL OR t.priority = CAST(:priority AS VARCHAR)) " +
                        "AND (:search IS NULL OR t.title ILIKE CONCAT('%', :search, '%') OR t.description ILIKE CONCAT('%', :search, '%'))", countQuery = "SELECT COUNT(DISTINCT t.id) FROM tasks t "
                                        +
                                        "WHERE t.company_id = :companyId " +
                                        "AND (" +
                                        "  (t.title LIKE '[REQUEST]%' AND t.created_by = :userId) OR " +
                                        "  (" +
                                        "    t.title NOT LIKE '[REQUEST]%' AND (" +
                                        "      t.created_by = :userId OR " +
                                        "      t.assigned_employee_id = :employeeId OR " +
                                        "      (t.team_id IS NULL AND t.assigned_employee_id IS NULL)" +
                                        "    )" +
                                        "  )" +
                                        ") " +
                                        "AND (:status IS NULL OR t.status = CAST(:status AS VARCHAR)) " +
                                        "AND (:priority IS NULL OR t.priority = CAST(:priority AS VARCHAR)) " +
                                        "AND (:search IS NULL OR t.title ILIKE CONCAT('%', :search, '%') OR t.description ILIKE CONCAT('%', :search, '%'))", nativeQuery = true)
        Page<Task> findVisibleTasksForEmployeeNoTeamPaginatedNative(
                        @Param("companyId") UUID companyId,
                        @Param("userId") UUID userId,
                        @Param("employeeId") UUID employeeId,
                        @Param("status") String status,
                        @Param("priority") String priority,
                        @Param("search") String search,
                        Pageable pageable);
}