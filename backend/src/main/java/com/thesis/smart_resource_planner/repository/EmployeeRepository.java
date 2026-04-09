package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.Employee;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.Collection; // Added for the batch fix
import java.util.UUID;

/**
 * Repository for managing {@link Employee} entities in the database.
 * Provides advanced queries including role-based visibility, pagination,
 * eager fetching of related skills, and dashboard statistics.
 */
@Repository
public interface EmployeeRepository extends JpaRepository<Employee, UUID> {

        Optional<Employee> findByUserId(UUID userId);

        // Added from N+1 fix
        List<Employee> findByUserIdIn(Collection<UUID> userIds);

        @Query("SELECT e FROM Employee e JOIN e.employeeSkills es WHERE es.skill.id = :skillId")
        List<Employee> findBySkillId(@Param("skillId") UUID skillId);

        @Query("SELECT e FROM Employee e JOIN e.employeeSkills es " +
                        "WHERE es.skill.id = :skillId AND es.proficiencyLevel >= :minProficiency")
        List<Employee> findBySkillAndMinProficiency(
                        @Param("skillId") UUID skillId,
                        @Param("minProficiency") Integer minProficiency);

        // Eager load single employee by ID with skills
        @Query("SELECT e FROM Employee e LEFT JOIN FETCH e.employeeSkills es LEFT JOIN FETCH es.skill WHERE e.id = :id")
        Optional<Employee> findByIdWithSkills(@Param("id") UUID id);

        @Query("SELECT e FROM Employee e WHERE e.user.company.id = :companyId")
        Page<Employee> findByCompanyId(@Param("companyId") UUID companyId, Pageable pageable);

        // Find employees by company ID (through user relationship)
        @Query("SELECT e FROM Employee e JOIN e.user u WHERE u.company.id = :companyId")
        List<Employee> findByCompanyId(@Param("companyId") UUID companyId);

        // Find employees by company ID (simple query without eager loading)
        @Query("SELECT e FROM Employee e WHERE e.user.company.id = :companyId")
        List<Employee> findByCompanyIdWithSkills(@Param("companyId") UUID companyId);

        // Find employee by user ID with skills
        @Query("SELECT e FROM Employee e LEFT JOIN FETCH e.employeeSkills es LEFT JOIN FETCH es.skill WHERE e.user.id = :userId")
        Optional<Employee> findByUserIdWithSkills(@Param("userId") UUID userId);

        @Query("SELECT e FROM Employee e JOIN e.user u WHERE e.department = :departmentName AND u.company.id = :companyId")
        List<Employee> findByDepartmentAndCompanyId(
                        @Param("departmentName") String departmentName,
                        @Param("companyId") UUID companyId);

        @Query("SELECT e FROM Employee e WHERE e.user.company.id = :companyId " +
                        "AND (:department IS NULL OR e.department = :department) " +
                        "AND (:position IS NULL OR e.position = :position) " +
                        "AND (:search IS NULL OR " +
                        "LOWER(e.firstName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
                        "LOWER(e.lastName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
                        "LOWER(e.position) LIKE LOWER(CONCAT('%', :search, '%')))")
        Page<Employee> findByCompanyIdWithFilters(
                        @Param("companyId") UUID companyId,
                        @Param("department") String department,
                        @Param("position") String position,
                        @Param("search") String search,
                        Pageable pageable);

        // ============================================================
        // SUPER ADMIN DASHBOARD QUERIES
        // (Only shows EMPLOYEE role - excludes ADMIN and MANAGER)
        // ============================================================

        @Query("SELECT e FROM Employee e JOIN e.user u " +
                        "WHERE u.company.id = :companyId " +
                        "AND u.role = 'EMPLOYEE'")
        List<Employee> findEmployeesByCompanyIdForDashboard(@Param("companyId") UUID companyId);

        @Query("SELECT COUNT(e) FROM Employee e JOIN e.user u " +
                        "WHERE u.company.id = :companyId " +
                        "AND u.role = 'EMPLOYEE'")
        long countEmployeesByCompanyIdForDashboard(@Param("companyId") UUID companyId);

        @Query("SELECT COUNT(e) FROM Employee e JOIN e.user u " +
                        "WHERE e.department = :departmentName " +
                        "AND u.company.id = :companyId " +
                        "AND u.role = 'EMPLOYEE'")
        long countEmployeesByDepartmentAndCompanyIdForDashboard(
                        @Param("departmentName") String departmentName,
                        @Param("companyId") UUID companyId);

        @Query(value = "SELECT e.* FROM employees e " +
                        "JOIN users u ON e.user_id = u.id " +
                        "WHERE u.company_id = :companyId " +
                        "AND (:department IS NULL OR e.department = :department) " +
                        "AND (:position IS NULL OR e.position = :position) " +
                        "AND (:search IS NULL OR " +
                        "e.first_name ILIKE CONCAT('%', :search, '%') OR " +
                        "e.last_name ILIKE CONCAT('%', :search, '%') OR " +
                        "e.position ILIKE CONCAT('%', :search, '%'))", countQuery = "SELECT COUNT(*) FROM employees e "
                                        +
                                        "JOIN users u ON e.user_id = u.id " +
                                        "WHERE u.company_id = :companyId " +
                                        "AND (:department IS NULL OR e.department = :department) " +
                                        "AND (:position IS NULL OR e.position = :position) " +
                                        "AND (:search IS NULL OR " +
                                        "e.first_name ILIKE CONCAT('%', :search, '%') OR " +
                                        "e.last_name ILIKE CONCAT('%', :search, '%') OR " +
                                        "e.position ILIKE CONCAT('%', :search, '%'))", nativeQuery = true)
        Page<Employee> findByCompanyIdWithFiltersNative(
                        @Param("companyId") UUID companyId,
                        @Param("department") String department,
                        @Param("position") String position,
                        @Param("search") String search,
                        Pageable pageable);

        @Query("SELECT e FROM Employee e " +
                        "JOIN FETCH e.user u " +
                        "LEFT JOIN FETCH u.team " +
                        "WHERE u.company.id = :companyId")
        List<Employee> findByCompanyIdWithTeam(@Param("companyId") UUID companyId);

}