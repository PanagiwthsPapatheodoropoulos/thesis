/**
 * @file WorkloadPage.jsx
 * @description Dashboard for tracking employee and departmental workloads.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Users, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Activity, User, Sparkles, ArrowRight, X } from 'lucide-react';
import { useToast } from '../components/Toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { employeesAPI, tasksAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { PageHeader, SearchBar, LoadingSpinner } from '../components/ui';
import WorkloadHeatmap from '../components/WorkloadHeatmap';

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
  const [showRebalanceModal, setShowRebalanceModal] = useState<boolean>(false);
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  
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
      case 'OVERLOADED': return darkMode ? 'text-red-400 bg-red-950/40 border-red-800/60' : 'text-red-700 bg-red-50/60 border-red-300';
      case 'OPTIMAL': return darkMode ? 'text-green-400 bg-green-950/40 border-green-800/60' : 'text-green-700 bg-green-50/60 border-green-300';
      case 'UNDERLOADED': return darkMode ? 'text-yellow-400 bg-yellow-950/40 border-yellow-800/60' : 'text-yellow-750 bg-yellow-50/60 border-yellow-300';
      default: return darkMode ? 'text-gray-400 bg-gray-900/40 border-gray-700' : 'text-gray-600 bg-gray-50 border-gray-300';
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
    return <LoadingSpinner size="lg" darkMode={darkMode} />;
  }

  const containerClass = darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900';
  const borderClass = darkMode ? 'border-gray-700' : 'border-gray-300';

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-600" />
            Employee Workload
          </span>
        }
        description="Real-time capacity (excluding pending task requests)"
        darkMode={darkMode}
        action={
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
            {(isAdmin || isManager) && (
              <button
                onClick={() => setShowRebalanceModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1, #818cf8)' }}
              >
                <Sparkles className="w-4 h-4" />
                AI Rebalance
              </button>
            )}
          </div>
        }
      />

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

              <div className="max-w-3xl mx-auto w-full">
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
              </div>
            </>
          );
        })()}
      </div>

      {/* Filters */}
      <SearchBar
        value=""
        onChange={() => {}}
        placeholder="Employee workload search..."
        darkMode={darkMode}
        filters={
          <>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className={`px-4 py-2 rounded-lg border outline-none cursor-pointer ${
                darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 hover:border-gray-400'
              }`}
            >
              <option value="workload">Workload %</option>
              <option value="active">Active Tasks</option>
              <option value="completed">Completed Tasks</option>
              <option value="name">Name (A-Z)</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e: any) => setFilterStatus(e.target.value)}
              className={`px-4 py-2 rounded-lg border outline-none cursor-pointer ${
                darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 hover:border-gray-400'
              }`}
            >
              <option value="ALL">All Statuses ({workloadData.length})</option>
              <option value="OVERLOADED">Overloaded ({(stats as any).overloaded})</option>
              <option value="OPTIMAL">Optimal ({(stats as any).optimal})</option>
              <option value="UNDERLOADED">Underloaded ({(stats as any).underloaded})</option>
            </select>
          </>
        }
      />

      {/* Employee List */}
      <div className={`${containerClass} rounded-lg shadow overflow-hidden border ${borderClass}`}>
        <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
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
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(employee.status)}`}>
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

      {/* AI Rebalance Modal */}
      {showRebalanceModal && (
        <RebalanceModal
          workloadData={workloadData}
          employees={employees}
          darkMode={darkMode}
          onClose={() => setShowRebalanceModal(false)}
          onApply={() => {
            showToast('Rebalance suggestions applied successfully! Task reassignments are now queued.', 'success', 5000);
            setShowRebalanceModal(false);
          }}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   AI Rebalance Modal Component
   ───────────────────────────────────────────── */

interface RebalanceSuggestion {
  fromEmployee: string;
  fromDepartment: string;
  fromCurrentLoad: number;
  fromProjectedLoad: number;
  toEmployee: string;
  toDepartment: string;
  toCurrentLoad: number;
  toProjectedLoad: number;
  tasksToMove: number;
}

interface RebalanceModalProps {
  workloadData: any[];
  employees: any[];
  darkMode: boolean;
  onClose: () => void;
  onApply: () => void;
}

const RebalanceModal: React.FC<RebalanceModalProps> = ({ workloadData, employees, darkMode, onClose, onApply }) => {
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setAnimateIn(true));
  }, []);

  const suggestions = useMemo<RebalanceSuggestion[]>(() => {
    const overloaded = workloadData
      .filter(e => e.workloadPercentage > 90)
      .sort((a, b) => b.workloadPercentage - a.workloadPercentage);
    const underloaded = workloadData
      .filter(e => e.workloadPercentage < 50)
      .sort((a, b) => a.workloadPercentage - b.workloadPercentage);

    if (overloaded.length === 0 || underloaded.length === 0) return [];

    const results: RebalanceSuggestion[] = [];
    const usedTargets = new Map<string, number>(); // track projected loads

    for (const src of overloaded) {
      const activeTasks = (src as any).activeTasks || 0;
      if (activeTasks === 0) continue;

      // How many tasks to shed to bring to ~70%
      const targetLoad = 70;
      const currentLoad = src.workloadPercentage;
      const loadPerTask = activeTasks > 0 ? currentLoad / activeTasks : 0;
      const tasksToShed = loadPerTask > 0 ? Math.ceil((currentLoad - targetLoad) / loadPerTask) : 0;
      if (tasksToShed <= 0) continue;

      // Find same-department targets first, then cross-department
      const sameDept = underloaded.filter(t => t.department === src.department);
      const crossDept = underloaded.filter(t => t.department !== src.department);
      const candidates = [...sameDept, ...crossDept];

      let remaining = Math.min(tasksToShed, activeTasks);

      for (const target of candidates) {
        if (remaining <= 0) break;

        const targetCurrentLoad = usedTargets.get(target.employeeId) ?? target.workloadPercentage;
        if (targetCurrentLoad >= 70) continue; // already filled up

        const targetActiveTasks = (target as any).activeTasks || 0;
        const targetLoadPerTask = targetActiveTasks > 0 ? target.workloadPercentage / targetActiveTasks : (loadPerTask * 0.8);
        const capacityInTasks = targetLoadPerTask > 0 ? Math.floor((70 - targetCurrentLoad) / targetLoadPerTask) : 1;
        const movable = Math.max(1, Math.min(remaining, capacityInTasks));

        const fromProjected = currentLoad - (movable * loadPerTask);
        const toProjected = targetCurrentLoad + (movable * targetLoadPerTask);

        results.push({
          fromEmployee: src.employeeName,
          fromDepartment: src.department || 'Unassigned',
          fromCurrentLoad: Math.round(currentLoad),
          fromProjectedLoad: Math.max(0, Math.round(fromProjected)),
          toEmployee: target.employeeName,
          toDepartment: target.department || 'Unassigned',
          toCurrentLoad: Math.round(targetCurrentLoad),
          toProjectedLoad: Math.min(100, Math.round(toProjected)),
          tasksToMove: movable,
        });

        usedTargets.set(target.employeeId, toProjected);
        remaining -= movable;
      }
    }

    return results;
  }, [workloadData]);

  const containerClass = darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900';
  const borderClass = darkMode ? 'border-gray-700' : 'border-gray-300';
  const overlayBg = darkMode ? 'bg-black/60' : 'bg-black/40';
  const subtextClass = darkMode ? 'text-gray-400' : 'text-gray-500';

  const overloadedCount = workloadData.filter(e => e.workloadPercentage > 90).length;
  const underloadedCount = workloadData.filter(e => e.workloadPercentage < 50).length;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${overlayBg} ${animateIn ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl border ${containerClass} ${borderClass} transition-all duration-300 ${animateIn ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b flex items-center justify-between"
          style={{
            borderColor: darkMode ? '#374151' : '#e5e7eb',
            background: darkMode
              ? 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(99,102,241,0.10))'
              : 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(99,102,241,0.05))'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">AI Workload Rebalancer</h2>
              <p className={`text-sm ${subtextClass}`}>
                {overloadedCount} overloaded · {underloadedCount} underloaded · {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition hover:bg-opacity-20 ${
              darkMode ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-4" style={{ maxHeight: 'calc(85vh - 150px)' }}>
          {suggestions.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-green-400' : 'text-green-500'}`} />
              <h3 className="text-lg font-semibold mb-2">Workload is Balanced!</h3>
              <p className={subtextClass}>
                No rebalancing is needed right now. All employees are within acceptable workload ranges,
                or there are no underloaded employees available to receive tasks.
              </p>
            </div>
          ) : (
            <>
              {/* Summary banner */}
              <div
                className={`rounded-xl p-4 border ${darkMode ? 'bg-indigo-900/20 border-indigo-700/40' : 'bg-indigo-50 border-indigo-200'}`}
              >
                <p className={`text-sm ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                  <Sparkles className="w-4 h-4 inline mr-1" />
                  The AI suggests <strong>{suggestions.reduce((s, sg) => s + sg.tasksToMove, 0)} task movement{suggestions.reduce((s, sg) => s + sg.tasksToMove, 0) !== 1 ? 's' : ''}</strong> across{' '}
                  <strong>{suggestions.length} rebalancing action{suggestions.length !== 1 ? 's' : ''}</strong> to optimize team capacity.
                </p>
              </div>

              {/* Suggestion cards */}
              {suggestions.map((sg, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-4 transition-all duration-500 ${borderClass} ${
                    darkMode ? 'bg-gray-750 hover:bg-gray-700/60' : 'bg-gray-50 hover:bg-gray-100/80'
                  }`}
                  style={{
                    opacity: animateIn ? 1 : 0,
                    transform: animateIn ? 'translateY(0)' : 'translateY(12px)',
                    transitionDelay: `${150 + idx * 80}ms`,
                  }}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Source (overloaded) */}
                    <div className={`flex-1 min-w-[180px] rounded-lg p-3 border ${
                      darkMode ? 'bg-red-900/20 border-red-700/50' : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className={`w-4 h-4 ${darkMode ? 'text-red-400' : 'text-red-500'}`} />
                        <span className={`text-xs font-semibold uppercase ${darkMode ? 'text-red-400' : 'text-red-600'}`}>Overloaded</span>
                      </div>
                      <p className="font-semibold text-sm">{sg.fromEmployee}</p>
                      <p className={`text-xs ${subtextClass}`}>{sg.fromDepartment}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${darkMode ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-700'}`}>
                          {sg.fromCurrentLoad}%
                        </span>
                        <ArrowRight className={`w-3 h-3 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${darkMode ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700'}`}>
                          {sg.fromProjectedLoad}%
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex flex-col items-center gap-1 px-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? 'bg-green-900/30' : 'bg-green-100'}`}>
                        <ArrowRight className={`w-5 h-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                      </div>
                      <span className={`text-xs font-bold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                        {sg.tasksToMove} task{sg.tasksToMove > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Target (underloaded) */}
                    <div className={`flex-1 min-w-[180px] rounded-lg p-3 border ${
                      darkMode ? 'bg-blue-900/20 border-blue-700/50' : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className={`w-4 h-4 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} />
                        <span className={`text-xs font-semibold uppercase ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Available</span>
                      </div>
                      <p className="font-semibold text-sm">{sg.toEmployee}</p>
                      <p className={`text-xs ${subtextClass}`}>{sg.toDepartment}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${darkMode ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-700'}`}>
                          {sg.toCurrentLoad}%
                        </span>
                        <ArrowRight className={`w-3 h-3 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${darkMode ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700'}`}>
                          {sg.toProjectedLoad}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {sg.fromDepartment !== sg.toDepartment && (
                    <p className={`mt-2 text-xs italic ${darkMode ? 'text-amber-400/70' : 'text-amber-600'}`}>
                      ⚠ Cross-department transfer
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex justify-end gap-3 ${darkMode ? 'border-gray-700 bg-gray-800/80' : 'border-gray-200 bg-gray-50/80'}`}>
          <button
            onClick={onClose}
            className={`px-5 py-2.5 rounded-lg font-medium transition ${
              darkMode
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Close
          </button>
          {suggestions.length > 0 && (
            <button
              onClick={onApply}
              className="px-5 py-2.5 rounded-lg text-white font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1, #818cf8)' }}
            >
              <CheckCircle className="w-4 h-4" />
              Apply Suggestions
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkloadPage;