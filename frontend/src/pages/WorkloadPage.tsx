/**
 * @file WorkloadPage.jsx
 * @description Dashboard for tracking employee and departmental workloads.
 */
import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, RefreshCw, Activity, User } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { employeesAPI, tasksAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import WorkloadHeatmap from '../components/WorkloadHeatmap';
import type { WorkloadData, Employee } from '../types';

/**
 * WorkloadPage Component
 * 
 * Displays workload statistics, a heatmap, and individual employee distribution 
 * of active, completed, and pending tasks.
 * 
 * @returns {React.ReactElement} The workload monitoring UI.
 */
const WorkloadPage = () => {
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const [workloadData, setWorkloadData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState('workload');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [employees, setEmployees] = useState<any[]>([]); 
  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  
  // useEffect(() => {
  //   fetchWorkloadData();
    
  //   let interval;
  //   if (autoRefresh) {
  //     interval = setInterval(() => {
  //       if (document.visibilityState === 'visible') {
  //         fetchWorkloadData();
  //       }
  //     }, 5000);
  //   }
    
  //   return () => {
  //     if (interval) clearInterval(interval);
  //   };
  // }, [autoRefresh]);
  useEffect(() => {
    fetchWorkloadData();
}, []);

  useEffect(() => {
    const handleProfileUpdate = () => {
      fetchWorkloadData();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  
  /**
   * Fetches employee and task data to calculate workload distributions.
   * 
   * @async
   * @function fetchWorkloadData
   * @returns {Promise<void>}
   */
  const fetchWorkloadData = async () => {
    try {
      const [employeesData, allTasks] = await Promise.all([
        employeesAPI.getAll(),
        tasksAPI.getAll()
      ]);

      setEmployees(employeesData);


      const workload = await employeesAPI.getWorkload();
            
      setWorkloadData(workload);
      setLoading(false);
    } catch (error: any) {
      setLoading(false);
    }
  };


  /**
   * Determines the UI theme colors corresponding to a workload status.
   * 
   * @function getStatusColor
   * @param {string} status - Workload status (e.g. 'OVERLOADED', 'OPTIMAL').
   * @returns {string} Tailwind CSS class strings for the status.
   */
  const getStatusColor = (status) => {
    switch (status) {
      case 'OVERLOADED': return darkMode ? 'text-red-400 bg-red-900/30 border-red-700' : 'text-red-600 bg-red-50 border-red-200';
      case 'OPTIMAL': return darkMode ? 'text-green-400 bg-green-900/30 border-green-700' : 'text-green-600 bg-green-50 border-green-200';
      case 'UNDERLOADED': return darkMode ? 'text-yellow-400 bg-yellow-900/30 border-yellow-700' : 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return darkMode ? 'text-gray-400 bg-gray-800 border-gray-700' : 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  /**
   * Returns an appropriate icon based on the workload status.
   * 
   * @function getStatusIcon
   * @param {string} status - Workload status.
   * @returns {React.ReactElement} Lucide react icon component.
   */
  const getStatusIcon = (status) => {
    switch (status) {
      case 'OVERLOADED': return <TrendingUp className="w-5 h-5" />;
      case 'OPTIMAL': return <CheckCircle className="w-5 h-5" />;
      case 'UNDERLOADED': return <TrendingDown className="w-5 h-5" />;
      default: return <Minus className="w-5 h-5" />;
    }
  };

  // Sorting
  const sortedData = [...workloadData].sort((a, b) => {
    switch (sortBy) {
      case 'workload':
        return b.workloadPercentage - a.workloadPercentage;
      case 'active':
        return (b as any).activeTasks - (a as any).activeTasks;
      case 'completed':
        return (b as any).completedTasks - (a as any).completedTasks;
      case 'name':
        return a.employeeName.localeCompare(b.employeeName);
      default:
        return 0;
    }
  });

  // Filtering
  const filteredData = filterStatus === 'ALL' 
    ? sortedData 
    : sortedData.filter(emp => emp.status === filterStatus);

  // Statistics
  const stats = {
    total: workloadData.length,
    overloaded: workloadData.filter(e => e.status === 'OVERLOADED').length,
    optimal: workloadData.filter(e => e.status === 'OPTIMAL').length,
    underloaded: workloadData.filter(e => e.status === 'UNDERLOADED').length,
    avgWorkload: workloadData.length > 0 
      ? (workloadData.reduce((sum, e) => sum + e.workloadPercentage, 0) / workloadData.length).toFixed(1)
      : 0,
    totalActiveTasks: workloadData.reduce((sum, e) => sum + (e as any).activeTasks, 0),
    totalCompletedTasks: workloadData.reduce((sum, e) => sum + (e as any).completedTasks, 0)
  };

  // Chart data
  const statusDistribution = [
    { name: 'Overloaded', value: (stats as any).overloaded, color: '#EF4444' },
    { name: 'Optimal', value: (stats as any).optimal, color: '#10B981' },
    { name: 'Underloaded', value: (stats as any).underloaded, color: '#F59E0B' }
  ].filter(item => item.value > 0);

  const chartData = filteredData.slice(0, 10).map(emp => ({
    name: emp.employeeName.split(' ')[0],
    workload: Number(emp.workloadPercentage.toFixed(1)),
    active: (emp as any).activeTasks,
    completed: (emp as any).completedTasks,
    pending: emp.pendingTasks
  }));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
        <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Loading workload data...</p>
      </div>
    );
  }

  const containerClass = darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900';
  const borderClass = darkMode ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className={`text-3xl font-bold flex items-center gap-3 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            <Activity className="w-8 h-8 text-indigo-600" />
            Employee Workload
            {autoRefresh && (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                Auto-refresh (5s)
              </span>
            )}
          </h1>
          <p className={darkMode ? 'text-gray-400 mt-1' : 'text-gray-600 mt-1'}>
            Real-time capacity (excluding pending task requests)
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              autoRefresh 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          {/* <button
            onClick={fetchWorkloadData}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Now
          </button> */}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className={`${containerClass} rounded-lg shadow p-4 border-l-4 border-indigo-500`}>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-indigo-600" />
            <p className="text-sm font-medium text-gray-600">Total</p>
          </div>
          <p className="text-3xl font-bold">{stats.total}</p>
        </div>

        <div className={`${containerClass} rounded-lg shadow p-4 border-l-4 border-red-500`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-sm font-medium text-gray-600">Overloaded</p>
          </div>
          <p className="text-3xl font-bold text-red-600">{(stats as any).overloaded}</p>
        </div>

        <div className={`${containerClass} rounded-lg shadow p-4 border-l-4 border-green-500`}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-gray-600">Optimal</p>
          </div>
          <p className="text-3xl font-bold text-green-600">{(stats as any).optimal}</p>
        </div>

        <div className={`${containerClass} rounded-lg shadow p-4 border-l-4 border-yellow-500`}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-5 h-5 text-yellow-600" />
            <p className="text-sm font-medium text-gray-600">Underloaded</p>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{(stats as any).underloaded}</p>
        </div>

        <div className={`${containerClass} rounded-lg shadow p-4 border-l-4 border-purple-500`}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <p className="text-sm font-medium text-gray-600">Avg Load</p>
          </div>
          <p className="text-3xl font-bold text-purple-600">{stats.avgWorkload}%</p>
        </div>

        <div className={`${containerClass} rounded-lg shadow p-4 border-l-4 border-blue-500`}>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-medium text-gray-600">Active</p>
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats.totalActiveTasks}</p>
        </div>

        <div className={`${containerClass} rounded-lg shadow p-4 border-l-4 border-emerald-500`}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <p className="text-sm font-medium text-gray-600">Done</p>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{stats.totalCompletedTasks}</p>
        </div>
      </div>

      {/* Heatmap Visualization */}
      <div className={`${containerClass} rounded-lg shadow p-6 border ${borderClass}`}>
        <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xl font-bold">Department Workload Overview</h3>
        </div>
        <p className={`mb-6 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Each block represents an employee, colored by their current workload. Hover for details.
        </p>
        <WorkloadHeatmap workloadData={filteredData} />
      </div>


      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className={`${containerClass} rounded-lg shadow p-6 border ${borderClass}`}>
          <h3 className="text-lg font-bold mb-4">Top 10 - Task Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
              <XAxis dataKey="name" stroke={darkMode ? '#9CA3AF' : '#6B7280'} />
              <YAxis stroke={darkMode ? '#9CA3AF' : '#6B7280'} />
              <Tooltip 
                contentStyle={{
                  backgroundColor: darkMode ? '#1F2937' : '#FFFFFF',
                  border: `1px solid ${darkMode ? '#374151' : '#E5E7EB'}`,
                  borderRadius: '8px',
                  color: darkMode ? '#F3F4F6' : '#111827'
                }}
              />
              <Legend />
              <Bar dataKey="active" fill="#3B82F6" name="Active" />
              <Bar dataKey="completed" fill="#10B981" name="Completed" />
              <Bar dataKey="pending" fill="#F59E0B" name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className={`${containerClass} rounded-lg shadow p-6 border ${borderClass}`}>
          <h3 className="text-lg font-bold mb-4">Status Distribution</h3>
          {statusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: darkMode ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${darkMode ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Team Workload Section */}
      <div className={`${containerClass} rounded-lg shadow p-6 border ${borderClass}`}>
        <h3 className="text-lg font-bold mb-4">Team Workload Distribution</h3>
        
        {(() => {
          // Group by department
          const departmentStats = workloadData.reduce((acc, emp) => {
            const dept = emp.department || 'Unassigned';
            if (!acc[dept]) {
              acc[dept] = {
                employees: [],
                totalWorkload: 0,
                activeTasks: 0,
                completedTasks: 0,
                overloaded: 0,
                optimal: 0,
                underloaded: 0
              };
            }
            acc[dept].employees.push(emp);
            acc[dept].totalWorkload += emp.workloadPercentage;
            acc[dept].activeTasks += (emp as any).activeTasks;
            acc[dept].completedTasks += (emp as any).completedTasks;
            acc[dept][emp.status.toLowerCase()]++;
            return acc;
          }, {});

          const teamData = Object.entries(departmentStats).map(([dept, stats]: [string, any]) => ({
            name: dept,
            avgWorkload: ((stats as any).totalWorkload / stats.employees.length).toFixed(1),
            employees: stats.employees.length,
            activeTasks: (stats as any).activeTasks,
            completedTasks: (stats as any).completedTasks,
            overloaded: (stats as any).overloaded,
            optimal: (stats as any).optimal,
            underloaded: (stats as any).underloaded
          }));

          return (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {teamData.map((team, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 transition ${
                      parseFloat(team.avgWorkload) > 90
                        ? darkMode
                          ? 'border-red-700 bg-red-900/30'
                          : 'border-red-300 bg-red-50'
                        : parseFloat(team.avgWorkload) > 50
                        ? darkMode
                          ? 'border-green-700 bg-green-900/30'
                          : 'border-green-300 bg-green-50'
                        : darkMode
                          ? 'border-yellow-700 bg-yellow-900/30'
                          : 'border-yellow-300 bg-yellow-50'
                    }`}
                  >
                    <h4 className={`font-bold text-lg mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                      {team.name}
                    </h4>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Avg Workload:</span>
                        <span className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          {team.avgWorkload}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Employees:</span>
                        <span className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          {team.employees}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Active:</span>
                        <span className={`font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          {(team as any).activeTasks}
                        </span>
                      </div>

                      <div className={`flex gap-2 mt-3 pt-3 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            darkMode
                              ? 'bg-red-900/50 text-red-300 border border-red-800'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {(team as any).overloaded} 🔥
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            darkMode
                              ? 'bg-green-900/50 text-green-300 border border-green-800'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {(team as any).optimal} ✓
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            darkMode
                              ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-800'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {(team as any).underloaded} ⚡
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={teamData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="name" stroke={darkMode ? '#9CA3AF' : '#6B7280'} />
                  <YAxis stroke={darkMode ? '#9CA3AF' : '#6B7280'} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: darkMode ? '#1F2937' : '#FFFFFF',
                      border: `1px solid ${darkMode ? '#374151' : '#E5E7EB'}`,
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="avgWorkload" fill="#8B5CF6" name="Avg Workload %" />
                  <Bar dataKey="activeTasks" fill="#3B82F6" name="Active Tasks" />
                </BarChart>
              </ResponsiveContainer>
            </>
          );
        })()}
      </div>

      {/* Filters */}
      <div className={`${containerClass} rounded-lg shadow p-4 border ${borderClass}`}>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e: React.ChangeEvent<any>) => setSortBy(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300'
              }`}
            >
              <option value="workload">Workload %</option>
              <option value="active">Active Tasks</option>
              <option value="completed">Completed Tasks</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">Filter by Status</label>
            <select
              value={filterStatus}
              onChange={(e: React.ChangeEvent<any>) => setFilterStatus(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300'
              }`}
            >
              <option value="ALL">All Statuses ({workloadData.length})</option>
              <option value="OVERLOADED">Overloaded ({(stats as any).overloaded})</option>
              <option value="OPTIMAL">Optimal ({(stats as any).optimal})</option>
              <option value="UNDERLOADED">Underloaded ({(stats as any).underloaded})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Employee List */}
      <div className={`${containerClass} rounded-lg shadow overflow-hidden border ${borderClass}`}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold">Employee Details ({filteredData.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                  Active
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                  Completed
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                  Pending
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                  Workload
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {filteredData.map((employee, index) => (
                <tr key={employee.employeeId} className={`transition ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {/* Check if employee has profile image */}
                      {employees.find(emp => emp.id === employee.employeeId)?.profileImageUrl ? (
                        <img
                          key={employees.find(emp => emp.id === employee.employeeId).profileImageUrl}
                          src={employees.find(emp => emp.id === employee.employeeId).profileImageUrl}
                          alt={employee.employeeName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                          <User className="w-5 h-5" />
                        </div>
                      )}
                      <div className="ml-3">
                        <p className="font-medium">{employee.employeeName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {employee.department || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                      {(employee as any).activeTasks}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                      {(employee as any).completedTasks}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
                      {employee.pendingTasks}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            employee.workloadPercentage > 90 ? 'bg-red-600' :
                            employee.workloadPercentage > 50 ? 'bg-green-600' :
                            'bg-yellow-600'
                          }`}
                          style={{ width: `${Math.min(employee.workloadPercentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold">
                        {employee.workloadPercentage.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold border-2 ${getStatusColor(employee.status)}`}>
                      {getStatusIcon(employee.status)}
                      {employee.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredData.length === 0 && (
        <div className={`text-center py-12 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
            No employees match the selected filters
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkloadPage;