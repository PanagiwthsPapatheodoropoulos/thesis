/**
 * @fileoverview DashboardPage - Overview Page with Task and Employee Statistics.
 *
 * Displays role-aware KPI cards (total tasks, active, completed, employees, pending
 * requests) and two Recharts visualizations: a pie chart of task status distribution
 * and a bar chart of tasks by priority level. Employees see only their own team tasks;
 * admins and managers see all company tasks.
 */
// src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CheckSquare, Users, Activity, Award, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tasksAPI, employeesAPI, usersAPI } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Main dashboard page component displaying task and employee statistics.
 * Adapts displayed data based on the authenticated user's role.
 * @component
 * @returns {JSX.Element} The rendered dashboard with KPI cards and charts.
 */
const DashboardPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTasks: 0,
    activeTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    totalEmployees: 0,
    pendingRequests: 0
  });
  const [error, setError] = useState(null);
  const [priorityBreakdown, setPriorityBreakdown] = useState([]);
  const isEmployee = user?.role === 'EMPLOYEE';
  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (authLoading || !user) return;
    fetchDashboardData();
  }, [authLoading, user]);

  /**
   * Fetches task and employee data from the API and computes summary statistics.
   * Employees receive a filtered view limited to their team; admins see everything.
   */
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let tasks = [];
      let pendingRequests = 0;
      
      try {
        const allTasks = await tasksAPI.getAll();
        
        // Filter based on role
        if (isEmployee) {
          let currentEmployeeId = null;
          let userTeamId = null;
          
          try {
            const empProfile = await employeesAPI.getByUserId(user.id);
            currentEmployeeId = empProfile.id;
          } catch (error) {
            console.log('No employee profile');
          }

          try {
            const currentUser = await usersAPI.getById(user.id);
            userTeamId = currentUser.teamId;
          } catch (error) {
            console.log('Failed to get user team');
          }

          tasks = allTasks.filter(t => {
            // Show own requests
            if (t.title.startsWith('[REQUEST]') && t.createdBy === user.id) {
              return true;
            }
            
            // Hide other requests
            if (t.title.startsWith('[REQUEST]')) {
              return false;
            }
          
            // Show ONLY tasks assigned to them OR their team
            
            // 1. Personally assigned
            if (currentEmployeeId && t.assignedEmployeeId === currentEmployeeId) {
              return true;
            }
            
            // 2. Team task (no specific assignment) AND user is in that team
            if (t.teamId && userTeamId && t.teamId === userTeamId && !t.assignedEmployeeId) {
              return true;
            }
            
            // 3. Public task (no team, no assignment)
            if (!t.teamId && !t.assignedEmployeeId) {
              return true;
            }
            
            return false;
          });
          
        } else {
          // Admin/Manager sees all non-request tasks
          tasks = allTasks.filter(t => !t.title.startsWith('[REQUEST]'));
          
          // Count pending requests
          pendingRequests = allTasks.filter(t => 
            t.title.startsWith('[REQUEST]') && t.status === 'PENDING'
          ).length;
          
        }
        
      } catch (taskError) {
        console.error('Error fetching tasks:', taskError);
        tasks = [];
      }

      // Calculate counts from FILTERED tasks
      const priorityCounts = {
        LOW: tasks.filter(t => t.priority === 'LOW').length,
        MEDIUM: tasks.filter(t => t.priority === 'MEDIUM').length,
        HIGH: tasks.filter(t => t.priority === 'HIGH').length,
        CRITICAL: tasks.filter(t => t.priority === 'CRITICAL').length
      };
      
      const priorityData = [
        { name: 'Low', value: priorityCounts.LOW },
        { name: 'Medium', value: priorityCounts.MEDIUM },
        { name: 'High', value: priorityCounts.HIGH },
        { name: 'Critical', value: priorityCounts.CRITICAL }
      ].filter(item => item.value > 0);

      setPriorityBreakdown(priorityData);

      const completed = tasks.filter(t => t.status === 'COMPLETED').length;
      const active = tasks.filter(t => t.status === 'IN_PROGRESS').length;
      const pending = tasks.filter(t => t.status === 'PENDING').length;
      
      let employeeCount = 0;
      if (isAdmin || isManager) {
        try {
          const allEmployees = await employeesAPI.getAll();
          // Count only actual employees, not admins/managers
          employeeCount = allEmployees.length;
        } catch (empError) {
          console.log('Cannot fetch employees');
        }
      }

      setStats({
        totalTasks: tasks.length,
        activeTasks: active,
        completedTasks: completed,
        pendingTasks: pending,
        totalEmployees: employeeCount,
        pendingRequests
      });

    } catch (error) {
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const taskStatusData = stats.totalTasks > 0 ? [
    { name: 'Pending', value: stats.pendingTasks, color: '#8B5CF6' },
    { name: 'In Progress', value: stats.activeTasks, color: '#3B82F6' },
    { name: 'Completed', value: stats.completedTasks, color: '#10B981' }
  ].filter(item => item.value > 0) : [];

  // Tooltip style for charts
  const chartTooltipStyle = {
    contentStyle: {
      backgroundColor: darkMode ? '#1f2937' : '#ffffff', // gray-800 or white
      border: '1px solid',
      borderColor: darkMode ? '#374151' : '#e5e7eb', // gray-700 or gray-200
      borderRadius: '0.5rem'
    },
    itemStyle: { color: darkMode ? '#f3f4f6' : '#111827' }, // gray-100 or gray-900
    labelStyle: { color: darkMode ? '#f3f4f6' : '#111827' } // gray-100 or gray-900
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
        <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`border rounded-lg p-6 ${darkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className={`w-6 h-6 ${darkMode ? 'text-red-400' : 'text-red-600'}`} />
          <h3 className={`text-lg font-bold ${darkMode ? 'text-red-100' : 'text-red-900'}`}>Error Loading Dashboard</h3>
        </div>
        <p className={`mb-4 ${darkMode ? 'text-red-200' : 'text-red-800'}`}>{error}</p>
        <button 
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const allStats = [
    { label: 'Total Tasks', value: stats.totalTasks, icon: CheckSquare, color: 'from-blue-500 to-cyan-500' },
    { label: 'Active Tasks', value: stats.activeTasks, icon: Activity, color: 'from-purple-500 to-pink-500' },
    { label: 'Completed', value: stats.completedTasks, icon: Award, color: 'from-green-500 to-emerald-500' },
    { label: 'Employees', value: stats.totalEmployees, icon: Users, color: 'from-orange-500 to-red-500' },
    ...(isAdmin || isManager ? [
      { label: 'Pending Requests', value: stats.pendingRequests || 0, icon: AlertTriangle, color: 'from-yellow-500 to-amber-600' }
    ] : [])
  ];

  const statsToShow = isEmployee
    ? allStats.filter(s => s.label !== 'Employees')
    : allStats;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            Dashboard
          </h1>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
            Welcome back, {user?.username}!
            {isEmployee && " (Showing your team's tasks)"}
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          Refresh Data
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsToShow.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div 
              key={i} 
              className={`rounded-xl shadow-sm p-6 hover:shadow-md transition card-hover fade-in ${
                darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
              }`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</p>
                  <p className={`text-3xl font-bold mt-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{stat.value}</p>
                </div>
                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
               </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`rounded-xl shadow-sm p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Task Distribution</h3>
          {taskStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={taskStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={{ fill: darkMode ? '#f3f4f6' : '#111827' }} // Use JS prop for label color
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {taskStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className={`h-[300px] flex flex-col items-center justify-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <CheckSquare className={`w-16 h-16 mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
              <p>No tasks yet</p>
            </div>
          )}
        </div>

        <div className={`rounded-xl shadow-sm p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Task Status Breakdown</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Pending Tasks</span>
              <span className={`text-2xl font-bold ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>{stats.pendingTasks}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Active Tasks</span>
              <span className={`text-2xl font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>{stats.activeTasks}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Completed Tasks</span>
              <span className={`text-2xl font-bold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>{stats.completedTasks}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Breakdown */}
      {priorityBreakdown.length > 0 && (
        <div className={`rounded-xl shadow-sm p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Tasks by Priority</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
              <XAxis dataKey="name" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
              <YAxis stroke={darkMode ? '#9ca3af' : '#6b7280'} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="value" fill="#6366F1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;