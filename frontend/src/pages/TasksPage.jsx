/**
 * @fileoverview TasksPage - Full-Featured Task Management Page.
 *
 * Provides paginated, filterable, and sortable task listings for all user roles.
 * Admins and managers can create, approve, reject, bulk-update, and delete tasks;
 * employees can request tasks and update the status of tasks assigned to them.
 * Integrates AI assignment suggestions, LSTM duration prediction, skill extraction,
 * and complexity analysis via dedicated child components.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, X, RefreshCw, Users, User, AlertTriangle, CheckCircle, XCircle, Sparkles, BookOpen } from 'lucide-react';
import { tasksAPI, teamsAPI, employeesAPI, usersAPI, notificationsAPI, aiAPI, skillsAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import TaskDetailsModal from '../components/TaskDetailsModal';
import { useTheme } from '../contexts/ThemeContext';
import AIAssignmentModal from '../components/AIAssignmentModal';
import TaskDurationPredictor from '../components/TaskDurationPredictor';
import SkillsMultiSelect from '../components/SkillsMultiSelect';
import TaskComplexityAnalyzer from '../components/TaskComplexityAnalyzer';
import TaskSkillsExtractor from '../components/TaskSkillsExtractor';
import Pagination from '../components/Pagination';

/**
 * Task management page supporting CRUD operations, filtering, sorting, and AI-assisted assignment.
 * Adapts available actions based on the authenticated user's role.
 * @component
 * @returns {JSX.Element} The rendered task list with modals and controls.
 */
const TasksPage = () => {
  const { user } = useAuth();
  const { darkMode } = useTheme();
  
  // -- State: Data & Pagination --
  const [tasks, setTasks] = useState([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(6);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // -- State: Auxiliary Data --
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [state, setState] = useState({ myEmployeeId: null });

  // -- State: UI & Modals --
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState(null);
  
  // Bulk Actions
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [bulkMode, setBulkMode] = useState(false);

  // AI & Skills
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedTaskForAI, setSelectedTaskForAI] = useState(null);
  const [showAISuggestionsInModal, setShowAISuggestionsInModal] = useState(false);
  const [aiSuggestionsForNewTask, setAiSuggestionsForNewTask] = useState([]);
  const [loadingAISuggestions, setLoadingAISuggestions] = useState(false);
  const [predictedHours, setPredictedHours] = useState(null);
  const [selectedTeamEmployees, setSelectedTeamEmployees] = useState([]);

  // Form Data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    estimatedHours: '',
    dueDate: '',
    teamId: '',
    assignedEmployeeId: '',
    requiredSkillIds: [],
    complexityScore: 0.5
  });

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const canManage = isAdmin || isManager;

  const taskData = useMemo(() => ({
    priority: formData.priority,
    complexityScore: formData.complexityScore || 0.5,
    requiredSkillIds: formData.requiredSkillIds || []
  }), [formData.priority, formData.complexityScore, formData.requiredSkillIds]);

  // -- Data Fetching Logic --

  /**
   * Fetches a paginated page of tasks and supporting auxiliary data (teams, users, employees).
   * Applies current sort, filter, and search parameters to the API request.
   */
  const fetchData = async () => {
    try {
      if (!loading) setLoading(true);

      // 1. Fetch Paginated Tasks
      const response = await tasksAPI.getAllPaginated(
        currentPage,
        pageSize,
        sortBy,
        sortDir,
        {
          ...(statusFilter !== 'ALL' && { status: statusFilter }),
          ...(priorityFilter !== 'ALL' && { priority: priorityFilter }),
          ...(searchTerm && { search: searchTerm })
        }
      );

      // 2. Set Task Data
      setTasks(response.content);
      setTotalPages(response.totalPages);
      setTotalElements(response.totalElements);
      setCurrentPage(response.number);

      // 3. Handle Pending Requests Count (based on current page view, or fetch separately if needed)
      // Note: Ideally the API should return a separate count for pending requests. 
      // For now, we count visible ones or if we want global count, we'd need a separate API call.
      const visiblePendingRequests = response.content.filter(t => 
        t.title.startsWith('[REQUEST]') && t.status === 'PENDING'
      );
      if (canManage) {
        setPendingRequestsCount(visiblePendingRequests.length);
      }

      // 4. Fetch Auxiliary Data (Teams, Users, Employees) needed for UI
      const teamsData = await (canManage ? teamsAPI.getAll() : teamsAPI.getMyTeams());
      setTeams(teamsData);

      if (!canManage) {
        // Get current employee profile for permissions/view logic
        try {
          const empProfile = await employeesAPI.getByUserId(user.id);
          setState(prev => ({ ...prev, myEmployeeId: empProfile.id }));
        } catch (error) {
          console.log('No employee profile found');
        }
      }

      if (canManage) {
        const [allUsers, allEmployees] = await Promise.all([
          usersAPI.getAll(),
          employeesAPI.getAll()
        ]);
        setUsers(allUsers);
        setEmployees(allEmployees);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refetch when pagination params change
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, sortBy, sortDir]);

  // Refetch when filters change (reset to page 0)
  useEffect(() => {
    if (currentPage === 0) {
      fetchData();
    } else {
      setCurrentPage(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, searchTerm]);

  // Auto-refresh interval (Optional: keeping for real-time feel, but preventing conflict)
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     if (document.visibilityState === 'visible' && !showCreateModal && !showDetailsModal) {
  //       // Silent refresh
  //       tasksAPI.getAllPaginated(
  //         currentPage,
  //         pageSize,
  //         sortBy,
  //         sortDir,
  //         {
  //           ...(statusFilter !== 'ALL' && { status: statusFilter }),
  //           ...(priorityFilter !== 'ALL' && { priority: priorityFilter }),
  //           ...(searchTerm && { search: searchTerm })
  //         }
  //       ).then(response => {
  //         setTasks(response.content);
  //         setTotalElements(response.totalElements);
  //         setTotalPages(response.totalPages);
  //       }).catch(err => console.error("Silent refresh failed", err));
  //     }
  //   }, 5000); // Increased interval to 5s to reduce load
  //   return () => clearInterval(interval);
  // }, [currentPage, pageSize, sortBy, sortDir, statusFilter, priorityFilter, searchTerm, showCreateModal, showDetailsModal]);

  // -- Handlers --

  /**
   * Handles pagination and page size changes from the Pagination component.
   * Resets to page 0 when page size changes to avoid out-of-range requests.
   * @param {number} newPage - The target page index (0-based).
   * @param {number} [newSize] - Optional updated page size.
   */
  const handlePageChange = (newPage, newSize) => {
    if (newSize && newSize !== pageSize) {
      setPageSize(newSize);
      setCurrentPage(0); // Reset to first page when changing size
    } else {
      setCurrentPage(newPage);
    }
  };

  const handlePredictionReceived = useCallback((hours) => {
    setPredictedHours(hours);
    setFormData(prev => ({ ...prev, estimatedHours: hours }));
  }, []);

  // Team Selection Logic
  useEffect(() => {
    if (formData.teamId && canManage && users.length > 0 && employees.length > 0) {
      const teamEmployees = employees.filter(emp => {
        const empUser = users.find(u => u.id === emp.userId);
        return empUser?.teamId === formData.teamId;
      });
      setSelectedTeamEmployees(teamEmployees);
      if (formData.assignedEmployeeId) {
        const isInTeam = teamEmployees.some(e => e.id === formData.assignedEmployeeId);
        if (!isInTeam) {
          setFormData(prev => ({ ...prev, assignedEmployeeId: '' }));
        }
      }
    } else {
      setSelectedTeamEmployees([]);
    }
  }, [formData.teamId, formData.assignedEmployeeId, employees, users, canManage]);

  /**
   * Requests AI assignment suggestions for a task that is being created.
   * Requires a task title and priority to be filled in before requesting.
   */
  const fetchAISuggestionsForNewTask = async () => {
    if (!formData.title || !formData.priority) {
      alert('Please enter task title and priority first');
      return;
    }

    setLoadingAISuggestions(true);
    setShowAISuggestionsInModal(true);

    try {
      const response = await aiAPI.getAssignmentSuggestions({
        taskId: crypto.randomUUID(), // Temporary ID for preview
        taskTitle: formData.title,
        description: formData.description || '',
        priority: formData.priority,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
        requiredSkillIds: formData.requiredSkillIds || [],
        complexityScore: formData.complexityScore || 0.5,
        topN: 5
      });

      const suggestions = response.suggestions || [];
      const mappedSuggestions = suggestions.map(sugg => ({
        employeeId: sugg.employeeId || sugg.employee_id,
        employeeName: sugg.employeeName || sugg.employee_name || 'Unknown',
        position: sugg.position || '',
        fitScore: parseFloat(sugg.fitScore || sugg.fit_score || 0),
        confidenceScore: parseFloat(sugg.confidenceScore || sugg.confidence_score || 0),
        reasoning: sugg.reasoning || 'No reasoning available',
        availableHours: parseInt(sugg.availableHours || sugg.available_hours || 0),
        workloadWarning: sugg.workloadWarning || sugg.workload_warning || 'Unknown status',
        workloadStatus: sugg.workloadStatus || sugg.workload_status || 'blue'
      }));
      setAiSuggestionsForNewTask(mappedSuggestions);
    } catch (error) {
      alert('Failed to get AI suggestions: ' + error.message);
      setAiSuggestionsForNewTask([]);
    } finally {
      setLoadingAISuggestions(false);
    }
  };

  /**
   * Sends assignment notification messages to a list of user IDs.
   * Silently logs errors; notification failures are non-blocking.
   * @param {string[]} recipientIds - Array of user IDs to notify.
   * @param {string} title - The notification title.
   * @param {string} message - The notification message body.
   */
  const sendNotifications = async (recipientIds, title, message) => {
    if (!recipientIds || recipientIds.length === 0) return;
    try {
      await Promise.all(
        recipientIds.map(recipientId =>
          notificationsAPI.create({
            userId: recipientId,
            type: 'TASK_ASSIGNED',
            title,
            message,
            severity: 'INFO',
            relatedEntityType: 'TASK'
          })
        )
      );
    } catch (err) {
      console.error('Notification error:', err);
    }
  };

  /**
   * Submits the task creation form. Validates and resolves skill names to IDs,
   * creating new skills if needed. Employees submit as requests pending approval.
   * @param {React.FormEvent} e - The form submit event.
   */
  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        requiredSkillIds: [],
        complexityScore: formData.complexityScore || 0.5,
        ...(canManage && {
          teamId: formData.teamId || null,
          assignedEmployeeId: formData.assignedEmployeeId || null
        })
      };

      // Skill validation logic
      if (formData.requiredSkillIds && formData.requiredSkillIds.length > 0) {
        const validatedSkillIds = [];
        for (const skillIdOrName of formData.requiredSkillIds) {
          try {
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(skillIdOrName)) {
              try {
                const existing = await skillsAPI.getById(skillIdOrName);
                validatedSkillIds.push(existing.id);
                continue;
              } catch { /* ignore */ }
            }
            try {
              const existing = await skillsAPI.getByName(skillIdOrName);
              validatedSkillIds.push(existing.id);
              continue;
            } catch {
              try {
                const created = await skillsAPI.create({
                  name: skillIdOrName,
                  category: 'Custom',
                  description: `Auto-created from task: ${formData.title}`
                });
                validatedSkillIds.push(created.id);
              } catch (e) { console.warn('Failed to create skill', e); }
            }
          } catch (e) { console.warn('Skill processing error', e); }
        }
        payload.requiredSkillIds = validatedSkillIds;
      }

      let created;
      if (canManage) {
        created = await tasksAPI.create(payload);
      } else {
        created = await tasksAPI.requestTask(payload);
      }

      setShowCreateModal(false);
      setFormData({
        title: '', description: '', priority: 'MEDIUM', estimatedHours: '', dueDate: '',
        teamId: '', assignedEmployeeId: '', requiredSkillIds: [], complexityScore: 0.5 
      });
      fetchData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  /**
   * Updates a task's status and sends completion notifications when marking COMPLETED.
   * @param {string} taskId - The ID of the task to update.
   * @param {string} newStatus - The new status value (e.g., 'IN_PROGRESS', 'COMPLETED').
   */
  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await tasksAPI.updateStatus(taskId, newStatus);
      if (newStatus === 'COMPLETED') {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          const recipientIds = new Set();
          if (task.createdBy) recipientIds.add(task.createdBy);
          if (task.teamId) {
            const teamMembers = users.filter(u => u.teamId === task.teamId);
            teamMembers.forEach(u => recipientIds.add(u.id));
          }
          await sendNotifications(Array.from(recipientIds), `✅ Task Completed`, `Task "${task.title}" has been marked as completed`);
        }
      }
      fetchData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  /**
   * Deletes a task after user confirmation.
   * @param {string} id - The ID of the task to delete.
   */
  const handleDeleteTask = async (id) => {
    if (window.confirm('Delete this task?')) {
      try {
        await tasksAPI.delete(id);
        fetchData();
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
  };

  const handleApproveTask = async (taskId) => {
    try {
      await tasksAPI.approveTask(taskId);
      fetchData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleRejectTask = async (taskId) => {
    if (window.confirm('Reject this task request?')) {
      try {
        await tasksAPI.rejectTask(taskId);
        alert(' Task request rejected');
        fetchData();
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedTasks.length === 0) return;
    try {
      await Promise.all(selectedTasks.map(taskId => tasksAPI.updateStatus(taskId, newStatus)));
      alert(` ${selectedTasks.length} tasks updated to ${newStatus}`);
      setSelectedTasks([]);
      setBulkMode(false);
      fetchData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.length === 0) return;
    if (!window.confirm(`Delete ${selectedTasks.length} tasks?`)) return;
    try {
      await Promise.all(selectedTasks.map(taskId => tasksAPI.delete(taskId)));
      alert(` ${selectedTasks.length} tasks deleted`);
      setSelectedTasks([]);
      setBulkMode(false);
      fetchData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  /**
   * Returns the Tailwind CSS badge classes for a given task priority level.
   * @param {string} priority - The task priority ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').
   * @returns {string} Tailwind class string for the badge.
   */
  const getPriorityColor = (priority) => {
    const colors = {
      LOW: 'bg-green-100 text-green-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      HIGH: 'bg-orange-100 text-orange-800',
      CRITICAL: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  /**
   * Returns the Tailwind CSS badge classes for a given task status.
   * @param {string} status - The task status ('PENDING', 'IN_PROGRESS', 'COMPLETED', etc.).
   * @returns {string} Tailwind class string for the badge.
   */
  const getStatusColor = (status) => {
    const colors = {
      PENDING: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      BLOCKED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
  <div className="h-full flex flex-col">
    
    {/* Header */}
    <div className="flex-shrink-0 mb-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            Tasks
            {canManage && pendingRequestsCount > 0 && (
              <span className="ml-3 px-3 py-1 bg-orange-500 text-white text-sm rounded-full font-bold animate-pulse">
                {pendingRequestsCount} pending requests
              </span>
            )}
          </h1>
          <p className={`mt-1 flex items-center gap-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing {totalElements} tasks
            {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
          </p>
        </div>

        <div className="flex gap-3">
          {canManage && (
            <>
              <button
                onClick={() => setBulkMode(!bulkMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  bulkMode 
                    ? 'bg-indigo-600 text-white' 
                    : darkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                {bulkMode ? 'Exit Bulk Mode' : 'Bulk Actions'}
              </button>

              {bulkMode && selectedTasks.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => handleBulkStatusChange('IN_PROGRESS')} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Start ({selectedTasks.length})</button>
                  <button onClick={() => handleBulkStatusChange('COMPLETED')} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">Complete ({selectedTasks.length})</button>
                  <button onClick={handleBulkDelete} className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">Delete ({selectedTasks.length})</button>
                </div>
              )}
            </>
          )}

          <button
            onClick={fetchData}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg hover:shadow-lg transition text-white ${
              canManage ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-gradient-to-r from-orange-600 to-red-600'
            }`}
          >
            <Plus className="w-5 h-5" />
            {canManage ? 'New Task' : 'Request Task'}
          </button>
        </div>
      </div>
    </div>

    {/* Filters & Sorting */}
    <div className={`flex-shrink-0 mb-6 rounded-lg shadow p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-10 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
              darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
            darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
          }`}
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
            darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
          }`}
        >
          <option value="ALL">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <select
          value={`${sortBy}-${sortDir}`}
          onChange={(e) => {
            const [field, dir] = e.target.value.split('-');
            setSortBy(field);
            setSortDir(dir);
          }}
          className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
            darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
          }`}
        >
          <option value="createdAt-desc">Newest First</option>
          <option value="createdAt-asc">Oldest First</option>
          <option value="dueDate-asc">Due Date (Soon)</option>
          <option value="dueDate-desc">Due Date (Later)</option>
          <option value="priority-desc">Priority (High)</option>
          <option value="priority-asc">Priority (Low)</option>
        </select>
      </div>
    </div>

    {/* Tasks Grid */}
    <div className='flex-1 overflow-auto mb-6'>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading && tasks.length === 0 ? (
          <div className="col-span-1 lg:col-span-2 flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="col-span-1 lg:col-span-2 text-center py-12">
            <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>No tasks found matching your criteria.</p>
          </div>
        ) : (
          tasks.map((task, index) => (
            <div 
              key={task.id} 
              className={`rounded-lg shadow p-6 hover:shadow-lg transition card-hover fade-in ${
                darkMode ? 'bg-gray-800' : 'bg-white'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Task card content - KEEP AS IS */}
              {bulkMode && (
                <div className="mb-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTasks.includes(task.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedTasks([...selectedTasks, task.id]);
                        else setSelectedTasks(selectedTasks.filter(id => id !== task.id));
                      }}
                      className="form-checkbox h-4 w-4 text-indigo-600"
                    />
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Select</span>
                  </label>
                </div>
              )}

                {task.title.startsWith('[REQUEST]') && task.status === 'PENDING' && canManage && (
                  <div className={`mb-4 p-4 border-2 rounded-lg ${
                    darkMode ? 'bg-orange-900/20 border-orange-700' : 'bg-orange-50 border-orange-300'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-5 h-5 ${darkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                        <span className={`font-bold ${darkMode ? 'text-orange-300' : 'text-orange-900'}`}>📝 PENDING APPROVAL</span>
                      </div>
                      <span className={`text-sm ${darkMode ? 'text-orange-400' : 'text-orange-700'}`}>Requested by: {task.createdByName}</span>
                    </div>
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={() => handleApproveTask(task.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                      >
                        <CheckCircle className="w-5 h-5" /> Approve
                      </button>
                      <button
                        onClick={() => handleRejectTask(task.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
                      >
                        <XCircle className="w-5 h-5" /> Reject
                      </button>
                    </div>
                  </div>
                )}

                <h3 className={`text-lg font-bold mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {task.title.replace('[REQUEST] ', '')}
                </h3>
                <p className={`text-sm mb-4 line-clamp-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {task.description}
                </p>
                
                <div className="flex gap-2 mb-4 flex-wrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>{task.status}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                  {task.teamId ? (
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {task.teamName || 'Team Task'}
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 flex items-center gap-1">
                      <User className="w-3 h-3" /> Public Task
                    </span>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => { setSelectedTaskForDetails(task); setShowDetailsModal(true); }}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition ${
                      darkMode ? 'text-indigo-400 hover:text-indigo-300 hover:bg-gray-700' : 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50'
                    }`}
                  >
                    View Details
                  </button>
                  
                  {!task.title.startsWith('[REQUEST]') && (
                    <>
                      {(() => {
                        const isPersonallyAssigned = task.assignedEmployeeId === state.myEmployeeId;
                        const hasAcceptedAssignment = task.assignments?.some(a => a.employeeId === state.myEmployeeId && (a.status === 'ACCEPTED' || a.status === 'IN_PROGRESS'));

                        if (isPersonallyAssigned && hasAcceptedAssignment && task.status === 'PENDING') {
                          return (
                            <button
                              onClick={() => handleUpdateStatus(task.id, 'IN_PROGRESS')}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition font-medium shadow-md"
                            >
                              <CheckCircle className="w-4 h-4" /> Start Working
                            </button>
                          );
                        }
                        if (task.status === 'PENDING' && (canManage || isPersonallyAssigned || !task.assignedEmployeeId)) {
                          return (
                            <button
                              onClick={() => handleUpdateStatus(task.id, 'IN_PROGRESS')}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition font-medium shadow-md"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg> Start Task
                            </button>
                          );
                        }
                        if (task.status === 'IN_PROGRESS') {
                          return (
                            <button
                              onClick={() => handleUpdateStatus(task.id, 'COMPLETED')}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition font-medium shadow-md"
                            >
                              <CheckCircle className="w-4 h-4" /> Complete
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </>
                  )}
                  
                  {canManage && (
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className={`px-4 py-2 rounded-lg transition font-medium border ${
                        darkMode ? 'bg-red-900/20 text-red-400 border-red-700 hover:bg-red-900/30' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                      }`}
                    >
                      Delete
                    </button>
                  )}
                  
                  {!canManage && task.title.startsWith('[REQUEST]') && task.createdBy === user?.id && task.status === 'PENDING' && (
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className={`flex-1 px-4 py-2 rounded-lg transition font-medium border ${
                        darkMode ? 'bg-orange-900/20 text-orange-400 border-orange-700 hover:bg-orange-900/30' : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
                      }`}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {!loading && totalElements > 0 && (
        <div className="flex-shrink-0">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalElements={totalElements}
            size={pageSize}
            onPageChange={handlePageChange}
            darkMode={darkMode}
          />
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className={`rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto scale-in ${
            darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
          }`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                {canManage ? 'Create New Task' : 'Request New Task'}
              </h2>
              <button onClick={() => setShowCreateModal(false)}>
                <X className={`w-6 h-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
              </button>
            </div>
            
            {!canManage && (
              <div className={`mb-4 p-3 border rounded-lg ${
                darkMode ? 'bg-blue-900/20 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <p className="text-sm">📝 Your task request will be reviewed by managers/admins before being assigned.</p>
              </div>
            )}
            
            <form onSubmit={handleCreateTask} className="space-y-6">
              <div>
                <input
                  type="text"
                  placeholder="Task Title *"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                    darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  required
                />
              </div>

              {/* Only show AI features for Admin/Manager */}
              {canManage && formData.title && (
                <TaskComplexityAnalyzer
                  title={formData.title}
                  description={formData.description}
                  onComplexityDetected={(score) => setFormData({...formData, complexityScore: score})}
                  darkMode={darkMode}
                />
              )}
              
              <div>
                <textarea
                  placeholder="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                    darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  rows="3"
                />
              </div>

              {/* Only show skill extraction for Admin/Manager */}
              {canManage && (
                <TaskSkillsExtractor
                  taskTitle={formData.title}
                  taskDescription={formData.description}
                  onSkillsExtracted={(skillNames) => setFormData({...formData, requiredSkillIds: skillNames})}
                  darkMode={darkMode}
                />
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={`text-sm font-medium mb-1 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Priority *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="LOW">Low Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="CRITICAL">Critical Priority</option>
                  </select>
                </div>

                <div>
                  <label className={`text-sm font-medium mb-1 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Estimated Hours</label>
                  <input
                    type="number"
                    placeholder="Hours"
                    value={formData.estimatedHours}
                    onChange={(e) => setFormData({...formData, estimatedHours: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    step="0.5"
                  />
                </div>

                <div>
                  <label className={`text-sm font-medium mb-1 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Due Date *</label>
                  <input
                    type="datetime-local"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                  />
                </div>
              </div>

              {canManage && (
                <div>
                  <label className={`flex items-center gap-2 text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <BookOpen className="w-4 h-4" /> Required Skills (Optional)
                  </label>
                  <SkillsMultiSelect
                    selectedSkills={formData.requiredSkillIds || []}
                    onChange={(skillIds) => setFormData({...formData, requiredSkillIds: skillIds})}
                    darkMode={darkMode}
                  />
                </div>
              )}

              {canManage && formData.priority && (
                <div>
                  <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <Sparkles className="w-4 h-4" /> AI Duration Prediction (Optional)
                  </label>
                  <TaskDurationPredictor 
                    taskData={taskData}
                    onPredictionReceived={handlePredictionReceived}
                    darkMode={darkMode}
                  />
                </div>
              )}
              
              {canManage && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`flex items-center gap-2 text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      <Users className="w-4 h-4" /> Team (Optional)
                    </label>
                    <select
                      value={formData.teamId}
                      onChange={(e) => setFormData({...formData, teamId: e.target.value, assignedEmployeeId: ''})}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                        darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="">-- Public Task (All Teams Can See) --</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>

                  {formData.teamId && selectedTeamEmployees.length > 0 ? (
                    <div>
                      <label className={`flex items-center gap-2 text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <User className="w-4 h-4" /> Assign to Specific Employee (Optional)
                      </label>
                      <select
                        value={formData.assignedEmployeeId}
                        onChange={(e) => setFormData({...formData, assignedEmployeeId: e.target.value})}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                          darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      >
                        <option value="">-- Entire Team --</option>
                        {selectedTeamEmployees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                        ))}
                      </select>
                    </div>
                  ) : formData.teamId ? (
                    <div className={`flex items-center justify-center p-4 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No employees in this team</p>
                    </div>
                  ) : null}
                </div>
              )}

              {canManage && formData.teamId && formData.priority && formData.requiredSkillIds.length > 0 && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={fetchAISuggestionsForNewTask}
                    disabled={loadingAISuggestions}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition font-medium shadow-md"
                  >
                    {loadingAISuggestions ? (
                      <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Analyzing...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Get AI Assignment Suggestions</>
                    )}
                  </button>
                </div>
              )}

              {showAISuggestionsInModal && aiSuggestionsForNewTask.length > 0 && (
                <div className={`mb-4 p-4 rounded-lg border-2 ${darkMode ? 'bg-purple-900/20 border-purple-700' : 'bg-purple-50 border-purple-300'}`}>
                  <h4 className="font-bold mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" /> AI Recommendations
                  </h4>
                  <div className="space-y-2">
                    {aiSuggestionsForNewTask.slice(0, 3).map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setFormData({...formData, assignedEmployeeId: suggestion.employeeId});
                          setShowAISuggestionsInModal(false);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition ${
                          formData.assignedEmployeeId === suggestion.employeeId
                            ? darkMode ? 'border-purple-500 bg-purple-900/30' : 'border-purple-500 bg-purple-100'
                            : darkMode ? 'border-gray-600 hover:border-purple-400' : 'border-gray-300 hover:border-purple-400'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className={`font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} {suggestion.employeeName || 'Unknown Employee'}
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              Fit: {((suggestion.fitScore || 0) * 100).toFixed(0)}% | Available: {suggestion.availableHours || 0}h/week remaining
                            </p>
                          </div>
                          {formData.assignedEmployeeId === suggestion.employeeId && (
                            <CheckCircle className="w-5 h-5 text-purple-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg hover:shadow-lg transition font-semibold"
              >
                {canManage ? 'Create Task' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && selectedTaskForDetails && (
        <TaskDetailsModal
          task={selectedTaskForDetails}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedTaskForDetails(null);
          }}
          onTaskUpdate={() => {
            fetchData();
            setShowDetailsModal(false);
            setSelectedTaskForDetails(null);
          }}
        />
      )}

      {showAIModal && selectedTaskForAI && (
        <AIAssignmentModal
          task={selectedTaskForAI}
          isOpen={showAIModal}
          onClose={() => {
            setShowAIModal(false);
            setSelectedTaskForAI(null);
          }}
          onAssign={() => {
            fetchData();
            alert('✅ Task assigned successfully!');
          }}
        />
      )}
    </div>
  );
};

export default TasksPage;