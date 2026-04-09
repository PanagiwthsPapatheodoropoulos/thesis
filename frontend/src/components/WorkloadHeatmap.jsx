/**
 * @fileoverview WorkloadHeatmap - Department-grouped employee workload visualisation.
 *
 * Displays a colour-coded grid of employee tiles, grouped by department.
 * The active metric (workload %, active tasks, or completed tasks) is
 * selectable via a dropdown. Each tile shows a tooltip on hover with full
 * employee stats. A legend explains the colour scale.
 */
import React, { useState } from 'react';
import { Activity, Users } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Component that renders a heatmap grid of employee workload grouped by department.
 *
 * @component
 * @param {Object[]} props.workloadData - Array of employee workload objects.
 * @param {string}   props.workloadData[].employeeId         - Unique identifier for the employee.
 * @param {string}   props.workloadData[].employeeName       - Display name of the employee.
 * @param {string}   [props.workloadData[].department]       - Department name (defaults to "Unassigned").
 * @param {number}   props.workloadData[].workloadPercentage - Current workload as a percentage.
 * @param {number}   props.workloadData[].activeTasks        - Number of tasks currently in progress.
 * @param {number}   props.workloadData[].completedTasks     - Number of completed tasks.
 * @returns {JSX.Element} The heatmap grid with legend and metric selector.
 */
const WorkloadHeatmap = ({ workloadData }) => {
  const [selectedMetric, setSelectedMetric] = useState('workload');
  const { darkMode } = useTheme();

  // Group by department
  const departments = workloadData.reduce((acc, emp) => {
    const dept = emp.department || 'Unassigned';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(emp);
    return acc;
  }, {});

  /**
   * Maps a numeric value to a Tailwind background-colour class based on the selected metric.
   * Workload percentage thresholds: >90 → red, >70 → orange, >50 → yellow, >30 → green, else blue.
   * Task count thresholds:          >8  → red, >5  → orange, >3  → yellow, >1  → green, else blue.
   *
   * @param {number} value  - The metric value to colour-map.
   * @param {string} metric - The active metric key ('workload' or task counts).
   * @returns {string} A Tailwind CSS class string for the background colour.
   */
  const getColor = (value, metric) => {
    if (metric === 'workload') {
      if (value > 90) return darkMode ? 'bg-red-700' : 'bg-red-600';
      if (value > 70) return darkMode ? 'bg-orange-600' : 'bg-orange-500';
      if (value > 50) return darkMode ? 'bg-yellow-600' : 'bg-yellow-500';
      if (value > 30) return darkMode ? 'bg-green-600' : 'bg-green-500';
      return darkMode ? 'bg-blue-600' : 'bg-blue-400';
    }
    // For task counts
    if (value > 8) return darkMode ? 'bg-red-700' : 'bg-red-600';
    if (value > 5) return darkMode ? 'bg-orange-600' : 'bg-orange-500';
    if (value > 3) return darkMode ? 'bg-yellow-600' : 'bg-yellow-500';
    if (value > 1) return darkMode ? 'bg-green-600' : 'bg-green-500';
    return darkMode ? 'bg-blue-600' : 'bg-blue-400';
  };

  /**
   * Returns the numeric value for the currently selected metric from an employee record.
   *
   * @param {Object} emp - An employee workload record from {@code workloadData}.
   * @returns {number} The value corresponding to {@code selectedMetric}.
   */
  const getValue = (emp) => {
    switch (selectedMetric) {
      case 'workload':
        return emp.workloadPercentage;
      case 'active':
        return emp.activeTasks;
      case 'completed':
        return emp.completedTasks;
      default:
        return emp.workloadPercentage;
    }
  };

  return (
    <div
      className={`rounded-lg shadow p-6 transition-colors ${
        darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
      }`}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-indigo-500" />
          <h3 className="text-xl font-bold">Workload Heatmap</h3>
        </div>

        <select
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value)}
          className={`px-4 py-2 border rounded-lg outline-none transition ${
            darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-indigo-500'
              : 'bg-white border-gray-300 text-gray-900 focus:ring-indigo-500'
          }`}
        >
          <option value="workload">Workload %</option>
          <option value="active">Active Tasks</option>
          <option value="completed">Completed Tasks</option>
        </select>
      </div>

      <div className="space-y-6">
        {Object.entries(departments).map(([dept, employees]) => (
          <div key={dept}>
            <h4
              className={`font-semibold mb-3 flex items-center gap-2 ${
                darkMode ? 'text-gray-200' : 'text-gray-900'
              }`}
            >
              <Users className="w-4 h-4" />
              {dept} ({employees.length})
            </h4>

            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              }}
            >
              {employees.map((emp) => {
                const value = getValue(emp);
                const colorClass = getColor(value, selectedMetric);

                return (
                  <div
                    key={emp.employeeId}
                    className={`${colorClass} text-white rounded-lg p-4 hover:opacity-90 transition cursor-pointer relative group`}
                    title={`${emp.employeeName}: ${value.toFixed(0)}${
                      selectedMetric === 'workload' ? '%' : ''
                    }`}
                  >
                    <div className="text-xs font-medium truncate mb-1">
                      {emp.employeeName.split(' ')[0]}
                    </div>
                    <div className="text-2xl font-bold">
                      {value.toFixed(0)}
                      {selectedMetric === 'workload' ? '%' : ''}
                    </div>

                    {/* Tooltip */}
                    <div
                      className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10`}
                    >
                      <div
                        className={`text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow ${
                          darkMode
                            ? 'bg-gray-900 text-gray-100 border border-gray-700'
                            : 'bg-white text-gray-900 border border-gray-200'
                        }`}
                      >
                        <div className="font-semibold">{emp.employeeName}</div>
                        <div>Workload: {emp.workloadPercentage.toFixed(0)}%</div>
                        <div>Active: {emp.activeTasks}</div>
                        <div>Completed: {emp.completedTasks}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div
        className={`mt-6 pt-6 border-t ${
          darkMode ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-center gap-4 text-sm flex-wrap">
          <span
            className={`font-semibold ${
              darkMode ? 'text-gray-200' : 'text-gray-700'
            }`}
          >
            Legend:
          </span>
          {[
            { color: 'bg-red-600', label: 'Critical' },
            { color: 'bg-orange-500', label: 'High' },
            { color: 'bg-yellow-500', label: 'Moderate' },
            { color: 'bg-green-500', label: 'Optimal' },
            { color: 'bg-blue-400', label: 'Low' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-4 h-4 ${color} rounded`}></div>
              <span
                className={`${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                } whitespace-nowrap`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkloadHeatmap;
