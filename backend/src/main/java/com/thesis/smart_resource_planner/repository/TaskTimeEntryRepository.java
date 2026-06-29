package com.thesis.smart_resource_planner.repository;

import com.thesis.smart_resource_planner.model.entity.TaskTimeEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link TaskTimeEntry} entities.
 *
 * <p>
 * Supports retrieval of time-tracking records logged against individual tasks,
 * as well as aggregation of the total hours spent on a given task.
 * </p>
 */
@Repository
public interface TaskTimeEntryRepository extends JpaRepository<TaskTimeEntry, UUID> {

    /**
     * Returns all time entries for a specific task, ordered from most recent to
     * oldest.
     *
     * @param taskId the UUID of the task whose time entries are requested
     * @return list of {@link TaskTimeEntry} objects ordered by {@code workDate}
     *         descending
     */
    List<TaskTimeEntry> findByTaskIdOrderByWorkDateDesc(UUID taskId);

    /**
     * Calculates the cumulative hours logged against a task.
     *
     * <p>
     * Returns {@code 0} via {@code COALESCE} when no entries exist yet, so
     * the result is never {@code null}.
     * </p>
     *
     * @param taskId the UUID of the task to aggregate
     * @return total hours spent as a {@link BigDecimal}, or {@code 0} if no entries
     *         exist
     */
    @Query("SELECT COALESCE(SUM(t.hoursSpent), 0) FROM TaskTimeEntry t WHERE t.task.id = :taskId")
    BigDecimal getTotalHoursByTask(UUID taskId);

}
