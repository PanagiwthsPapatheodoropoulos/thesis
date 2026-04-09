package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.EmployeeAvailability;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for managing {@link EmployeeAvailability} entities in the
 * database.
 * Provides queries to fetch and manage an employee's availability details and
 * schedules.
 */
@Repository
public interface EmployeeAvailabilityRepository extends JpaRepository<EmployeeAvailability, UUID> {
        List<EmployeeAvailability> findByEmployeeId(UUID employeeId);

        // Query for single date with company filter
        @Query("SELECT ea FROM EmployeeAvailability ea WHERE " +
                        "ea.employee.id = :employeeId AND " +
                        "ea.employee.user.company.id = :companyId AND " +
                        "ea.date = :date")
        Optional<EmployeeAvailability> findByEmployeeIdAndDateAndCompanyId(
                        @Param("employeeId") UUID employeeId,
                        @Param("date") LocalDate date,
                        @Param("companyId") UUID companyId);

        // Query for date range with company filter
        @Query("SELECT ea FROM EmployeeAvailability ea WHERE " +
                        "ea.employee.id = :employeeId AND " +
                        "ea.employee.user.company.id = :companyId AND " +
                        "ea.date BETWEEN :startDate AND :endDate")
        List<EmployeeAvailability> findByEmployeeIdAndDateBetweenAndCompanyId(
                        @Param("employeeId") UUID employeeId,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate,
                        @Param("companyId") UUID companyId);

        void deleteByEmployeeId(UUID employeeId);
}