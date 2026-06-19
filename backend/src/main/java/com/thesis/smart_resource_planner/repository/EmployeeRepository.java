package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.entity.Employee;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.Collection;
import java.util.UUID;

/**
 * Repository for managing {@link Employee} entities in the database.
 */
@Repository
public interface EmployeeRepository extends JpaRepository<Employee, UUID> {

        Optional<Employee> findByUserId(UUID userId);

        List<Employee> findByUserIdIn(Collection<UUID> userIds);

        @Query("SELECT e FROM Employee e JOIN e.employeeSkills es WHERE es.skill.id = :skillId")
        List<Employee> findBySkillId(@Param("skillId") UUID skillId);

        @Query("SELECT e FROM Employee e JOIN e.employeeSkills es " +
                        "WHERE es.skill.id = :skillId AND es.proficiencyLevel >= :minProficiency")
        List<Employee> findBySkillAndMinProficiency(
                        @Param("skillId") UUID skillId,
                        @Param("minProficiency") Integer minProficiency);

        @Query("SELECT e FROM Employee e LEFT JOIN FETCH e.employeeSkills es LEFT JOIN FETCH es.skill WHERE e.id = :id")
        Optional<Employee> findByIdWithSkills(@Param("id") UUID id);

        @Query("SELECT e FROM Employee e WHERE e.user.company.id = :companyId")
        Page<Employee> findByCompanyId(@Param("companyId") UUID companyId, Pageable pageable);

        @Query("SELECT e FROM Employee e JOIN e.user u WHERE u.company.id = :companyId")
        List<Employee> findByCompanyId(@Param("companyId") UUID companyId);

        @Query("SELECT e FROM Employee e WHERE e.user.company.id = :companyId")
        List<Employee> findByCompanyIdWithSkills(@Param("companyId") UUID companyId);

        @Query("SELECT e FROM Employee e LEFT JOIN FETCH e.employeeSkills es LEFT JOIN FETCH es.skill WHERE e.user.id = :userId")
        Optional<Employee> findByUserIdWithSkills(@Param("userId") UUID userId);

        @Query("SELECT e FROM Employee e JOIN e.user u WHERE e.department = :departmentName AND u.company.id = :companyId")
        List<Employee> findByDepartmentAndCompanyId(
                        @Param("departmentName") String departmentName,
                        @Param("companyId") UUID companyId);

        @Query(value = "SELECT e.* FROM employees e " +
                        "JOIN users u ON e.user_id = u.id " +
                        "WHERE u.company_id = :companyId " +
                        "AND (CAST(:department AS TEXT) IS NULL OR e.department = CAST(:department AS TEXT)) " +
                        "AND (CAST(:position AS TEXT) IS NULL OR e.position = CAST(:position AS TEXT)) " +
                        "AND (CAST(:search AS TEXT) IS NULL OR (" +
                        "e.first_name ILIKE CAST(:search AS TEXT) OR " +
                        "e.last_name ILIKE CAST(:search AS TEXT) OR " +
                        "e.position ILIKE CAST(:search AS TEXT)))",
                        countQuery = "SELECT COUNT(*) FROM employees e " +
                                        "JOIN users u ON e.user_id = u.id " +
                                        "WHERE u.company_id = :companyId " +
                                        "AND (CAST(:department AS TEXT) IS NULL OR e.department = CAST(:department AS TEXT)) " +
                                        "AND (CAST(:position AS TEXT) IS NULL OR e.position = CAST(:position AS TEXT)) " +
                                        "AND (CAST(:search AS TEXT) IS NULL OR (" +
                                        "e.first_name ILIKE CAST(:search AS TEXT) OR " +
                                        "e.last_name ILIKE CAST(:search AS TEXT) OR " +
                                        "e.position ILIKE CAST(:search AS TEXT)))",
                        nativeQuery = true)
        Page<Employee> findByCompanyIdWithFilters(
                        @Param("companyId") UUID companyId,
                        @Param("department") String department,
                        @Param("position") String position,
                        @Param("search") String search,
                        Pageable pageable);

        // ============================================================
        // Role-based paginated search (used for Employees and Managers)
        // ============================================================
        @Query(value = "SELECT e.* FROM employees e " +
                        "JOIN users u ON e.user_id = u.id " +
                        "WHERE u.company_id = :companyId " +
                        "AND u.role = :role " +
                        "AND (CAST(:department AS TEXT) IS NULL OR e.department = CAST(:department AS TEXT)) " +
                        "AND (CAST(:position AS TEXT) IS NULL OR e.position = CAST(:position AS TEXT)) " +
                        "AND (CAST(:search AS TEXT) IS NULL OR (" +
                        "e.first_name ILIKE CAST(:search AS TEXT) OR " +
                        "e.last_name ILIKE CAST(:search AS TEXT) OR " +
                        "e.position ILIKE CAST(:search AS TEXT)))",
                        countQuery = "SELECT COUNT(*) FROM employees e " +
                                        "JOIN users u ON e.user_id = u.id " +
                                        "WHERE u.company_id = :companyId " +
                                        "AND u.role = :role " +
                                        "AND (CAST(:department AS TEXT) IS NULL OR e.department = CAST(:department AS TEXT)) " +
                                        "AND (CAST(:position AS TEXT) IS NULL OR e.position = CAST(:position AS TEXT)) " +
                                        "AND (CAST(:search AS TEXT) IS NULL OR (" +
                                        "e.first_name ILIKE CAST(:search AS TEXT) OR " +
                                        "e.last_name ILIKE CAST(:search AS TEXT) OR " +
                                        "e.position ILIKE CAST(:search AS TEXT)))",
                        nativeQuery = true)
        Page<Employee> findByCompanyIdWithFiltersNative(
                        @Param("companyId") UUID companyId,
                        @Param("role") String role,
                        @Param("department") String department,
                        @Param("position") String position,
                        @Param("search") String search,
                        Pageable pageable);

        // ============================================================
        // MANAGER-ONLY queries
        // ============================================================
        @Query("SELECT e FROM Employee e JOIN e.user u " +
                        "WHERE u.company.id = :companyId AND u.role = 'MANAGER'")
        List<Employee> findManagersByCompanyId(@Param("companyId") UUID companyId);

        // Find employees by company and user role (generic)
        @Query("SELECT e FROM Employee e JOIN e.user u " +
                        "WHERE u.company.id = :companyId AND u.role = :role")
        List<Employee> findByCompanyIdAndUserRole(
                        @Param("companyId") UUID companyId,
                        @Param("role") UserRole role);

        // ============================================================
        // SUPER ADMIN DASHBOARD QUERIES
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

        @Query("SELECT e FROM Employee e " +
                        "JOIN FETCH e.user u " +
                        "LEFT JOIN FETCH u.team " +
                        "WHERE u.company.id = :companyId")
        List<Employee> findByCompanyIdWithTeam(@Param("companyId") UUID companyId);

}
