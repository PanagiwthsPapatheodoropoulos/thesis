/**
 * @fileoverview EmployeeProductivityChart - Visualizes employee productivity trends.
 * 
 * Renders a line chart showing task completion (Completed, In Progress, Pending)
 * over a selectable time range (30, 60, or 90 days). Includes summary stats
 * like total completed tasks, average tasks per week, and productivity trend.
 */
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Calendar, Activity, Award, Target } from 'lucide-react';

/**
 * Component that fetches and displays productivity metrics for a specific employee.
 *
 * @component
 * @param {Object} props - Component props.
 * @param {string} props.employeeId - Unique identifier of the employee.
 * @param {boolean} props.darkMode - Whether the UI is in dark mode.
 * @returns {JSX.Element} The rendered productivity chart and stats.
 */
const EmployeeProductivityChart = ({ employeeId, darkMode }) => {
  // State for chart data points
  const [productivityData, setProductivityData] = useState([]);
  // Loading state for API calls
  const [loading, setLoading] = useState(true);
  // Time range filter (in days)
  const [timeRange, setTimeRange] = useState('30');
  // Processed statistical metrics
  const [stats, setStats] = useState({
    totalCompleted: 0,
    averagePerWeek: 0,
    trend: 0
  });

  // useEffect(() => {
  //   if (employeeId) {
  //     fetchProductivityData();
      
  //     // Auto-refresh every 5 seconds
  //     const interval = setInterval(() => {
  //       fetchProductivityData();
  //     }, 5000);
      
  //     return () => clearInterval(interval);
  //   }
  // }, [employeeId, timeRange]);

  useEffect(() => {
    if (employeeId) {
      fetchProductivityData();
    }
  }, [employeeId, timeRange]);

  /**
   * Fetches task data from the backend to calculate productivity metrics.
   * Filters tasks associated with the specific employee and calculates stats.
   */
  const fetchProductivityData = async () => {
    try {
      setLoading(true);
      
      // Fetch ALL tasks to filter by employee
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/tasks`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch tasks');
      
      const allTasks = await response.json();
      
      // Filter tasks relevant to this employee
      const relevantTasks = allTasks.filter(task => {
        // Include tasks where employee is assigned
        if (task.assignedEmployeeId === employeeId) return true;
        
        // Include tasks with accepted assignments
        if (task.assignments && task.assignments.length > 0) {
          return task.assignments.some(a => 
            a.employeeId === employeeId && 
            (a.status === 'ACCEPTED' || a.status === 'IN_PROGRESS' || a.status === 'COMPLETED')
          );
        }
        
        return false;
      });
            
      // Process data for chart
      const processedData = processTaskData(relevantTasks, parseInt(timeRange));
      setProductivityData(processedData.chartData);
      setStats(processedData.stats);
      
    } catch (error) {
      setProductivityData([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Groups task data by week and calculates summary statistics.
   *
   * @param {Array}  tasks - Array of task objects.
   * @param {number} days  - Time range in days (30, 60, or 90).
   * @returns {Object} Chart data array and summary statistics object.
   */
  const processTaskData = (tasks, days) => {
    const now = new Date();
    const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    
    // Create week buckets
    const weeks = Math.ceil(days / 7);
    const weekData = {};
    
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(startDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000));
      const weekLabel = `Week ${i + 1}`;
      weekData[weekLabel] = {
        completed: 0,
        inProgress: 0,
        pending: 0
      };
    }

    let totalCompleted = 0;

    // Count tasks by week and status
    tasks.forEach(task => {
      const completedDate = task.completedDate ? new Date(task.completedDate) : null;
      const createdDate = task.createdAt ? new Date(task.createdAt) : null;
      
      // Use completed date if available, otherwise created date
      const relevantDate = completedDate || createdDate;
      
      if (!relevantDate || relevantDate < startDate) return;

      const weekIndex = Math.floor((relevantDate - startDate) / (7 * 24 * 60 * 60 * 1000));
      const weekLabel = `Week ${weekIndex + 1}`;
      
      if (weekData[weekLabel]) {
        if (task.status === 'COMPLETED') {
          weekData[weekLabel].completed++;
          totalCompleted++;
        } else if (task.status === 'IN_PROGRESS') {
          weekData[weekLabel].inProgress++;
        } else if (task.status === 'PENDING') {
          weekData[weekLabel].pending++;
        }
      }
    });

    // Convert to chart format
    const chartData = Object.entries(weekData).map(([week, data]) => ({
      week,
      completed: data.completed,
      inProgress: data.inProgress,
      pending: data.pending
    }));

    // Calculate stats
    const averagePerWeek = totalCompleted / weeks;
    
    // Calculate trend (comparing first half vs second half)
    const halfPoint = Math.floor(chartData.length / 2);
    const firstHalf = chartData.slice(0, halfPoint).reduce((sum, w) => sum + w.completed, 0);
    const secondHalf = chartData.slice(halfPoint).reduce((sum, w) => sum + w.completed, 0);
    const trend = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf * 100) : 0;

    return {
      chartData,
      stats: {
        totalCompleted,
        averagePerWeek: averagePerWeek.toFixed(1),
        trend: trend.toFixed(1)
      }
    };
  };

  if (loading) {
    return (
      <div className={`p-6 rounded-lg border ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="animate-pulse">
          <div className={`h-6 rounded w-48 mb-4 ${
            darkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`} />
          <div className={`h-64 rounded ${
            darkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`} />
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-lg border ${
      darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            darkMode ? 'bg-purple-900/30' : 'bg-purple-100'
          }`}>
            <TrendingUp className={`w-5 h-5 ${
              darkMode ? 'text-purple-400' : 'text-purple-600'
            }`} />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${
              darkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
              Productivity Trends
            </h3>
            <p className={`text-sm ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Task completion over time
            </p>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2">
          {['30', '60', '90'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-md text-sm transition ${
                timeRange === range
                  ? darkMode
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-600 text-white'
                  : darkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`p-4 rounded-lg ${
          darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
        }`}>
          <div className={`text-sm mb-1 ${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Total Completed
          </div>
          <div className={`text-2xl font-bold ${
            darkMode ? 'text-green-400' : 'text-green-600'
          }`}>
            {stats.totalCompleted}
          </div>
        </div>

        <div className={`p-4 rounded-lg ${
          darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
        }`}>
          <div className={`text-sm mb-1 ${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Avg per Week
          </div>
          <div className={`text-2xl font-bold ${
            darkMode ? 'text-blue-400' : 'text-blue-600'
          }`}>
            {stats.averagePerWeek}
          </div>
        </div>

        <div className={`p-4 rounded-lg ${
          darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
        }`}>
          <div className={`text-sm mb-1 ${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Trend
          </div>
          <div className={`text-2xl font-bold flex items-center gap-1 ${
            stats.trend > 0 
              ? darkMode ? 'text-green-400' : 'text-green-600'
              : darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {stats.trend > 0 ? '+' : ''}{stats.trend}%
            {stats.trend > 0 && <TrendingUp className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Chart */}
      {productivityData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={productivityData}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={darkMode ? '#374151' : '#E5E7EB'}
            />
            <XAxis 
              dataKey="week" 
              stroke={darkMode ? '#9CA3AF' : '#6B7280'}
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke={darkMode ? '#9CA3AF' : '#6B7280'}
              style={{ fontSize: '12px' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: darkMode ? '#1F2937' : '#FFFFFF',
                border: `1px solid ${darkMode ? '#374151' : '#E5E7EB'}`,
                borderRadius: '8px',
                color: darkMode ? '#F9FAFB' : '#111827'
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="completed" 
              stroke="#10B981" 
              strokeWidth={2}
              dot={{ fill: '#10B981', r: 4 }}
              activeDot={{ r: 6 }}
              name="Completed"
            />
            <Line 
              type="monotone" 
              dataKey="inProgress" 
              stroke="#3B82F6" 
              strokeWidth={2}
              dot={{ fill: '#3B82F6', r: 4 }}
              activeDot={{ r: 6 }}
              name="In Progress"
            />
            <Line 
              type="monotone" 
              dataKey="pending" 
              stroke="#F59E0B" 
              strokeWidth={2}
              dot={{ fill: '#F59E0B', r: 4 }}
              activeDot={{ r: 6 }}
              name="Pending"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <Activity className={`w-12 h-12 mb-3 ${
            darkMode ? 'text-gray-600' : 'text-gray-400'
          }`} />
          <p className={`text-sm ${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            No productivity data available yet
          </p>
        </div>
      )}

      {/* Footer Note */}
      <div className={`mt-4 pt-4 border-t flex items-center gap-2 ${
        darkMode ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-500'
      }`}>
        <Calendar className="w-4 h-4" />
        <p className="text-xs">
          Showing data for the last {timeRange} days
        </p>
      </div>
    </div>
  );
};

export default EmployeeProductivityChart;