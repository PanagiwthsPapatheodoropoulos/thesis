package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.enums.TaskAssignmentStatus;
import com.thesis.smart_resource_planner.enums.TaskStatus;
import com.thesis.smart_resource_planner.model.entity.TaskAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Repository for managing {@link TaskAssignment} entities in the database.
 * Provides query methods to find assignments by task, employee, and company.
 */
@Repository
public interface TaskAssignmentRepository extends JpaRepository<TaskAssignment, UUID> {
        List<TaskAssignment> findByTaskId(UUID taskId);

        List<TaskAssignment> findByEmployeeId(UUID employeeId);

        @Query("SELECT ta FROM TaskAssignment ta WHERE ta.task.id IN :taskIds")
        List<TaskAssignment> findByTaskIdIn(@Param("taskIds") List<UUID> taskIds);

        @Query("SELECT ta FROM TaskAssignment ta WHERE ta.employee.id = :employeeId AND ta.task.company.id = :companyId")
        List<TaskAssignment> findByEmployeeIdAndCompanyId(UUID employeeId, UUID companyId);

        @Query("SELECT ta FROM TaskAssignment ta WHERE ta.task.id = :taskId AND ta.task.company.id = :companyId")
        List<TaskAssignment> findByTaskIdAndCompanyId(UUID taskId, UUID companyId);

        @Query("SELECT ta FROM TaskAssignment ta WHERE ta.employee.id = :employeeId " +
                        "AND ta.task.status IN :statuses AND ta.task.company.id = :companyId")
        List<TaskAssignment> findActiveAssignmentsByEmployeeAndCompany(
                        @Param("employeeId") UUID employeeId,
                        @Param("statuses") List<TaskStatus> statuses,
                        @Param("companyId") UUID companyId);

        @Query("SELECT ta FROM TaskAssignment ta " +
                        "JOIN FETCH ta.task t " +
                        "JOIN FETCH ta.employee e " +
                        "WHERE t.company.id = :companyId " +
                        "AND ta.status = :status")
        List<TaskAssignment> findByCompanyIdAndStatus(
                        @Param("companyId") UUID companyId,
                        @Param("status") TaskAssignmentStatus status);

        void deleteByEmployeeId(UUID employeeId);
}