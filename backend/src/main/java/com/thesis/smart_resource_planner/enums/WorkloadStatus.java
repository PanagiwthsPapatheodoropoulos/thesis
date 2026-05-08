package com.thesis.smart_resource_planner.enums;

/**
 * Classifies an employee's current workload level based on their
 * active task percentage relative to capacity.
 *
 * <ul>
 *   <li>{@code UNDERLOADED} – below 50 % utilization</li>
 *   <li>{@code OPTIMAL} – between 50 % and 85 % utilization</li>
 *   <li>{@code OVERLOADED} – above 85 % utilization</li>
 * </ul>
 */
public enum WorkloadStatus {

    /** Employee utilization is below 50%. */
    UNDERLOADED("UNDERLOADED"),
    /** Employee utilization is between 50% and 85%. */
    OPTIMAL("OPTIMAL"),
    /** Employee utilization is above 85%. */
    OVERLOADED("OVERLOADED");

    private final String value;

    WorkloadStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return this.value;
    }
}
