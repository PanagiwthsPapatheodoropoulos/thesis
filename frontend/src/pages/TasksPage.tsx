/**
 * @fileoverview TasksPage - Full-Featured Task Management Page.
 *
 * Provides paginated, filterable, and sortable task listings for all user roles.
 * Admins and managers can create, approve, reject, bulk-update, and delete tasks;
 * employees can request tasks and update the status of tasks assigned to them.
 * Integrates AI assignment suggestions, LSTM duration prediction, skill extraction,
 * and complexity analysis via dedicated child components.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Search, X, RefreshCw, Users, User, AlertTriangle, CheckCircle, XCircle, Sparkles, BookOpen, Radar, Brain, BarChart3 } from 'lucide-react';
import { tasksAPI, teamsAPI, employeesAPI, usersAPI, notificationsAPI, aiAPI, skillsAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import TaskDetailsModal from '../components/TaskDetailsModal';
import { useTheme } from '../contexts/ThemeContext';
import AIAssignmentModal from '../components/AIAssignmentModal';
import TaskDurationPredictor from '../components/TaskDurationPredictor';
import SkillsMultiSelect from '../components/SkillsMultiSelect';
import Pagination from '../components/Pagination';
import AIBulkPlannerModal from '../components/AIBulkPlannerModal';
import AIPrioritizerModal from '../components/AIPrioritizerModal';
import TeamSkillGapRadarModal from '../components/TeamSkillGapRadarModal';
import { useToast } from '../components/Toast';
import type { PaginatedResponse, TaskFilters, Task, Team, Employee, User as UserType, AISuggestion } from '../types';

/**
 * Task management page supporting CRUD operations, filtering, sorting, and AI-assisted assignment.
 * Adapts available actions based on the authenticated user's role.
 * @component
 * @returns {JSX.Element} The rendered task list with modals and controls.
 */
const TasksPage = () => {
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const { showToast } = useToast();
  
  // -- State: Data & Pagination --
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState(6);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // -- State: Auxiliary Data --
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [state, setState] = useState<{ myEmployeeId: string | null }>({ myEmployeeId: null });

  // -- State: UI & Modals --
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);
  
  // Bulk Actions
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<boolean>(false);

  // AI & Skills
  const [showAIModal, setShowAIModal] = useState<boolean>(false);
  const [selectedTaskForAI, setSelectedTaskForAI] = useState<Task | null>(null);
  const [showAISuggestionsInModal, setShowAISuggestionsInModal] = useState<boolean>(false);
  const [aiSuggestionsForNewTask, setAiSuggestionsForNewTask] = useState<AISuggestion[]>([]);
  const [loadingAISuggestions, setLoadingAISuggestions] = useState<boolean>(false);
  const [predictedHours, setPredictedHours] = useState<number | null>(null);
  const [showAIDetails, setShowAIDetails] = useState<boolean>(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState<boolean>(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState<boolean>(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState<boolean>(false);
  const [selectedTeamEmployees, setSelectedTeamEmployees] = useState<Employee[]>([]);

  // Per-task AI states
  const [singleAITask, setSingleAITask] = useState<Task | null>(null);
  const [showPrioritizerModal, setShowPrioritizerModal] = useState<boolean>(false);
  const [showBulkPlannerModal, setShowBulkPlannerModal] = useState<boolean>(false);
  const [showSkillGapRadarModal, setShowSkillGapRadarModal] = useState<boolean>(false);

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

  // -- State: Auto-Detection --
  const [autoDetectedSkills, setAutoDetectedSkills] = useState<any[]>([]);
  const [isAutoDetecting, setIsAutoDetecting] = useState<boolean>(false);
  const autoDetectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const canManage = isAdmin || isManager;

  const taskData = useMemo(() => ({
    priority: formData.priority,
    complexityScore: formData.complexityScore || 0.5,
    requiredSkillIds: formData.requiredSkillIds || []
  }), [formData.priority, formData.complexityScore, formData.requiredSkillIds]);

  const selectedTaskDetails = useMemo<Task[]>(
    () => tasks.filter(t => selectedTasks.includes(t.id)),
    [tasks, selectedTasks]
  );

  // -- Category color map for auto-detected skill pills --
  const skillCategoryColors: Record<string, { light: string; dark: string }> = {
    'Programming':   { light: 'bg-blue-100 text-blue-800 border-blue-300',      dark: 'bg-blue-900/40 text-blue-300 border-blue-700' },
    'Frontend':      { light: 'bg-cyan-100 text-cyan-800 border-cyan-300',      dark: 'bg-cyan-900/40 text-cyan-300 border-cyan-700' },
    'Backend':       { light: 'bg-green-100 text-green-800 border-green-300',    dark: 'bg-green-900/40 text-green-300 border-green-700' },
    'DevOps':        { light: 'bg-orange-100 text-orange-800 border-orange-300',  dark: 'bg-orange-900/40 text-orange-300 border-orange-700' },
    'Data Science':  { light: 'bg-purple-100 text-purple-800 border-purple-300',  dark: 'bg-purple-900/40 text-purple-300 border-purple-700' },
    'Testing':       { light: 'bg-yellow-100 text-yellow-800 border-yellow-300',  dark: 'bg-yellow-900/40 text-yellow-300 border-yellow-700' },
    'Finance':       { light: 'bg-emerald-100 text-emerald-800 border-emerald-300', dark: 'bg-emerald-900/40 text-emerald-300 border-emerald-700' },
    'Marketing':     { light: 'bg-pink-100 text-pink-800 border-pink-300',        dark: 'bg-pink-900/40 text-pink-300 border-pink-700' },
    'HR':            { light: 'bg-rose-100 text-rose-800 border-rose-300',        dark: 'bg-rose-900/40 text-rose-300 border-rose-700' },
    'Design':        { light: 'bg-violet-100 text-violet-800 border-violet-300',  dark: 'bg-violet-900/40 text-violet-300 border-violet-700' },
  };
  const defaultSkillColor = { light: 'bg-gray-100 text-gray-800 border-gray-300', dark: 'bg-gray-700 text-gray-300 border-gray-600' };

  const getSkillPillColor = (category: string) => {
    const colors = skillCategoryColors[category] || defaultSkillColor;
    return darkMode ? colors.dark : colors.light;
  };

  const aiModalTasks = useMemo<Task[]>(
    () => singleAITask ? [singleAITask] : selectedTaskDetails,
    [singleAITask, selectedTaskDetails]
  );

  // -- Data Fetching Logic --

  /**
   * Fetches a paginated page of tasks and supporting auxiliary data (teams, users, employees).
   * Applies current sort, filter, and search parameters to the API request.
   */
  const fetchData = async () => {
    try {
      if (!loading) setLoading(true);
      setErrorMessage(null);

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
        } catch (error: any) {
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

    } catch (error: any) {
      console.error('Error fetching data:', error);
      setErrorMessage('Unable to load tasks. Please try again.');
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

  // -- Debounced Auto-Detection of Skills --
  useEffect(() => {
    if (!canManage || !showCreateModal) return;

    const combinedText = `${formData.title} ${formData.description}`.trim();
    if (combinedText.length <= 15) {
      setAutoDetectedSkills([]);
      return;
    }

    // Clear previous timer
    if (autoDetectTimerRef.current) {
      clearTimeout(autoDetectTimerRef.current);
    }

    autoDetectTimerRef.current = setTimeout(async () => {
      setIsAutoDetecting(true);
      try {
        const response = await aiAPI.extractSkillsFromText({
          task_title: formData.title.substring(0, 100),
          task_description: combinedText,
          min_confidence: 0.4
        });
        const skills = response.extracted_skills || [];
        setAutoDetectedSkills(skills);
      } catch (err: any) {
        console.error('Auto-detect skills error:', err);
        setAutoDetectedSkills([]);
      } finally {
        setIsAutoDetecting(false);
      }
    }, 1500);

    return () => {
      if (autoDetectTimerRef.current) {
        clearTimeout(autoDetectTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.title, formData.description, canManage, showCreateModal]);

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
      showToast('Please enter task title and priority first', 'warning');
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
        estimatedHours: Number(formData.estimatedHours) ? parseFloat(formData.estimatedHours) : null,
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
    } catch (error: any) {
      showToast('Failed to get AI suggestions: ' + error.message, 'error');
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
    } catch (err: any) {
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
        estimatedHours: Number(formData.estimatedHours) ? parseFloat(formData.estimatedHours) : null,
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
              } catch (e: any) { console.warn('Failed to create skill', e); }
            }
          } catch (e: any) { console.warn('Skill processing error', e); }
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
    } catch (error: any) {
      showToast('Error: ' + error.message, 'error');
    }
  };

  const handleCloneTask = (taskToClone: Task) => {
    setPredictedHours(
      typeof taskToClone.estimatedHours === 'number'
        ? taskToClone.estimatedHours
        : taskToClone.estimatedHours
        ? parseFloat(taskToClone.estimatedHours)
        : null
    );
    setShowAIDetails(false);
    setShowTeamDropdown(false);
    setShowEmployeeDropdown(false);
    setShowPriorityDropdown(false);
    setFormData({
      title: taskToClone.title || '',
      description: taskToClone.description || '',
      priority: taskToClone.priority || 'MEDIUM',
      estimatedHours: taskToClone.estimatedHours ? taskToClone.estimatedHours.toString() : '',
      dueDate: taskToClone.dueDate ? new Date(taskToClone.dueDate).toISOString().split('T')[0] : '',
      teamId: taskToClone.teamId || '',
      assignedEmployeeId: taskToClone.assignedEmployeeId || '',
      requiredSkillIds: taskToClone.requiredSkills ? taskToClone.requiredSkills.map(s => s.skillId) : [],
      complexityScore: taskToClone.complexityScore || 0.5
    });
    setShowCreateModal(true);
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
    } catch (error: any) {
      showToast('Error: ' + error.message, 'error');
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
      } catch (error: any) {
        showToast('Error: ' + error.message, 'error');
      }
    }
  };

  const handleApproveTask = async (taskId) => {
    try {
      await tasksAPI.approveTask(taskId);
      fetchData();
    } catch (error: any) {
      showToast('Error: ' + error.message, 'error');
    }
  };

  const handleRejectTask = async (taskId) => {
    if (window.confirm('Reject this task request?')) {
      try {
        await tasksAPI.rejectTask(taskId);
        showToast('Task request rejected', 'success');
        fetchData();
      } catch (error: any) {
        showToast('Error: ' + error.message, 'error');
      }
    }
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedTasks.length === 0) return;
    try {
      await Promise.all(selectedTasks.map(taskId => tasksAPI.updateStatus(taskId, newStatus)));
      showToast(`${selectedTasks.length} tasks updated to ${newStatus}`, 'success');
      setSelectedTasks([]);
      setBulkMode(false);
      fetchData();
    } catch (error: any) {
      showToast('Error: ' + error.message, 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.length === 0) return;
    if (!window.confirm(`Delete ${selectedTasks.length} tasks?`)) return;
    try {
      await Promise.all(selectedTasks.map(taskId => tasksAPI.delete(taskId)));
      showToast(`${selectedTasks.length} tasks deleted`, 'success');
      setSelectedTasks([]);
      setBulkMode(false);
      fetchData();
    } catch (error: any) {
      showToast('Error: ' + error.message, 'error');
    }
  };

  const openPrioritizer = (task?: Task) => {
    if (task) {
      setSingleAITask(task);
    } else if (selectedTasks.length === 0) {
      showToast('Select tasks to prioritize.', 'warning');
      return;
    } else {
      setSingleAITask(null);
    }
    setShowPrioritizerModal(true);
  };

  const openBulkPlanner = (task?: Task) => {
    if (task) {
      setSingleAITask(task);
    } else if (selectedTasks.length === 0) {
      showToast('Select tasks to plan assignments.', 'warning');
      return;
    } else {
      setSingleAITask(null);
    }
    setShowBulkPlannerModal(true);
  };

  const openSkillGapRadar = (task?: Task) => {
    if (task) {
      setSingleAITask(task);
    } else if (selectedTasks.length === 0) {
      showToast('Select tasks to analyze skill gaps.', 'warning');
      return;
    } else {
      setSingleAITask(null);
    }
    setShowSkillGapRadarModal(true);
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
                  <button onClick={() => openPrioritizer()} className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm flex items-center gap-1">
                    <Sparkles className="w-4 h-4" /> Prioritize ({selectedTasks.length})
                  </button>
                  <button onClick={() => openBulkPlanner()} className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center gap-1">
                    <Brain className="w-4 h-4" /> AI Plan ({selectedTasks.length})
                  </button>
                  <button onClick={() => openSkillGapRadar()} className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm flex items-center gap-1">
                    <Radar className="w-4 h-4" /> Skill Radar ({selectedTasks.length})
                  </button>
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
            onClick={() => {
              setPredictedHours(null);
              setShowAIDetails(false);
              setShowTeamDropdown(false);
              setShowEmployeeDropdown(false);
              setShowPriorityDropdown(false);
              setShowCreateModal(true);
            }}
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

    {errorMessage && (
      <div className={`mb-4 border-2 rounded-lg p-4 flex items-start gap-3 ${
        darkMode ? 'bg-red-900/20 border-red-700 text-red-200' : 'bg-red-50 border-red-200 text-red-800'
      }`}>
        <AlertTriangle className={`w-5 h-5 mt-0.5 ${darkMode ? 'text-red-300' : 'text-red-600'}`} />
        <p className="text-sm">{errorMessage}</p>
      </div>
    )}

    {/* Filters & Sorting */}
    <div className={`flex-shrink-0 mb-6 rounded-lg shadow p-4 border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className={`pl-10 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
              darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
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
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPriorityFilter(e.target.value)}
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
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
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
              className={`rounded-lg shadow p-6 hover:shadow-lg transition card-hover fade-in border ${
                darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md border transition ${
                      darkMode
                        ? 'text-indigo-400 border-indigo-500/20 hover:text-indigo-300 hover:bg-gray-700/50 hover:border-indigo-500/40'
                        : 'text-indigo-600 border-indigo-200 hover:text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400'
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

                {/* Per-Task AI Action Buttons (Admin/Manager only) */}
                {canManage && !task.title.startsWith('[REQUEST]') && (
                  <div className={`flex gap-2 mt-3 pt-3 border-t ${
                    darkMode ? 'border-gray-700' : 'border-gray-100'
                  }`}>
                    <button
                      onClick={() => openPrioritizer(task)}
                      title="AI Prioritize this task"
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                        darkMode
                          ? 'bg-indigo-900/30 text-indigo-300 border border-indigo-700/50 hover:bg-indigo-900/50 hover:border-indigo-500'
                          : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-400'
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      Prioritize
                    </button>
                    <button
                      onClick={() => openBulkPlanner(task)}
                      title="AI Plan assignment for this task"
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                        darkMode
                          ? 'bg-purple-900/30 text-purple-300 border border-purple-700/50 hover:bg-purple-900/50 hover:border-purple-500'
                          : 'bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 hover:border-purple-400'
                      }`}
                    >
                      <Brain className="w-3.5 h-3.5" />
                      AI Plan
                    </button>
                    <button
                      onClick={() => openSkillGapRadar(task)}
                      title="Analyze skill gaps for this task"
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                        darkMode
                          ? 'bg-teal-900/30 text-teal-300 border border-teal-700/50 hover:bg-teal-900/50 hover:border-teal-500'
                          : 'bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100 hover:border-teal-400'
                      }`}
                    >
                      <Radar className="w-3.5 h-3.5" />
                      Skill Radar
                    </button>
                  </div>
                )}
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
              <button onClick={() => {
                setShowCreateModal(false);
                setPredictedHours(null);
                setShowAIDetails(false);
                setShowTeamDropdown(false);
                setShowEmployeeDropdown(false);
                setShowPriorityDropdown(false);
              }}>
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, title: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition-all duration-200 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                  }`}
                  required
                />
              </div>
              <div>
                <textarea
                  placeholder="Description"
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, description: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition-all duration-200 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                  }`}
                  rows={3}
                />
              </div>

              {/* ✨ Auto-Detected Skills Pills (only for Admin/Manager) */}
              {canManage && (autoDetectedSkills.length > 0 || isAutoDetecting) && (
                <div className={`rounded-lg border p-4 transition-all duration-300 ${
                  darkMode
                    ? 'bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border-indigo-800/50'
                    : 'bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border-indigo-200'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    {isAutoDetecting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        <span className={`text-sm font-medium ${
                          darkMode ? 'text-indigo-300' : 'text-indigo-700'
                        }`}>
                          ✨ AI detecting skills...
                        </span>
                      </>
                    ) : (
                      <>
                        <Sparkles className={`w-4 h-4 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                        <span className={`text-sm font-semibold ${
                          darkMode ? 'text-indigo-300' : 'text-indigo-700'
                        }`}>
                          ✨ Auto-Detected Skills
                        </span>
                        <span className={`text-xs ml-auto ${
                          darkMode ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          click to add/remove
                        </span>
                      </>
                    )}
                  </div>

                  {autoDetectedSkills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {autoDetectedSkills.map((skill, idx) => {
                        const isSelected = (formData.requiredSkillIds || []).includes(skill.name);
                        const pillColor = getSkillPillColor(skill.category || 'default');
                        return (
                          <button
                            key={`${skill.name}-${idx}`}
                            type="button"
                            onClick={() => {
                              const currentSkills = formData.requiredSkillIds || [];
                              if (isSelected) {
                                setFormData({
                                  ...formData,
                                  requiredSkillIds: currentSkills.filter((s: string) => s !== skill.name)
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  requiredSkillIds: [...currentSkills, skill.name]
                                });
                              }
                            }}
                            className={`
                              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                              border transition-all duration-300 cursor-pointer
                              ${pillColor}
                              ${isSelected
                                ? 'ring-2 ring-offset-1 ring-indigo-500 shadow-md scale-105'
                                : 'opacity-80 hover:opacity-100 hover:shadow-sm'
                              }
                            `}
                            style={{
                              animation: `fadeSlideUp 0.3s ease-out ${idx * 0.07}s both`
                            }}
                          >
                            <span>{skill.name}</span>
                            <span className={`inline-flex items-center gap-0.5 text-[10px] ${
                              darkMode ? 'opacity-70' : 'opacity-60'
                            }`}>
                              <span className={`inline-block w-8 h-1 rounded-full ${
                                darkMode ? 'bg-gray-600' : 'bg-gray-300'
                              } overflow-hidden`}>
                                <span
                                  className={`block h-full rounded-full ${
                                    skill.confidence > 0.8 ? 'bg-green-500' :
                                    skill.confidence > 0.6 ? 'bg-yellow-500' :
                                    'bg-orange-500'
                                  }`}
                                  style={{ width: `${(skill.confidence || 0) * 100}%` }}
                                />
                              </span>
                              {((skill.confidence || 0) * 100).toFixed(0)}%
                            </span>
                            {isSelected && (
                              <CheckCircle className="w-3 h-3 text-indigo-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Fade-slide-up animation keyframes */}
              <style>{`
                @keyframes fadeSlideUp {
                  from {
                    opacity: 0;
                    transform: translateY(8px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
              `}</style>

              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <label className={`text-sm font-medium mb-1 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Priority *</label>
                  
                  {/* Hidden native select for standard HTML form/testing accessibility */}
                  <select
                    value={formData.priority}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({...formData, priority: e.target.value})}
                    className="hidden"
                    style={{ display: 'none' }}
                  >
                    <option value="LOW">Low Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="CRITICAL">Critical Priority</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPriorityDropdown(!showPriorityDropdown);
                      setShowTeamDropdown(false);
                      setShowEmployeeDropdown(false);
                    }}
                    className={`w-full px-3 py-2 border rounded-lg flex items-center justify-between text-left outline-none transition-all duration-200 cursor-pointer ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 hover:border-gray-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15' 
                        : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        formData.priority === 'LOW' ? 'bg-green-500' :
                        formData.priority === 'HIGH' ? 'bg-orange-500' :
                        formData.priority === 'CRITICAL' ? 'bg-red-500' : 'bg-blue-500'
                      }`} />
                      {formData.priority === 'LOW' ? 'Low Priority' :
                       formData.priority === 'HIGH' ? 'High Priority' :
                       formData.priority === 'CRITICAL' ? 'Critical Priority' : 'Medium Priority'}
                    </span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showPriorityDropdown ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showPriorityDropdown && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowPriorityDropdown(false)} />
                      <div className={`absolute left-0 right-0 mt-1 rounded-xl shadow-xl border z-40 max-h-60 overflow-y-auto transition-all ${
                        darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-250 text-gray-900'
                      }`}>
                        {[
                          { value: 'LOW', label: 'Low Priority', color: 'bg-green-500', desc: 'General backlog or low-urgency tasks' },
                          { value: 'MEDIUM', label: 'Medium Priority', color: 'bg-blue-500', desc: 'Standard timeline deliverables' },
                          { value: 'HIGH', label: 'High Priority', color: 'bg-orange-500', desc: 'Urgent milestones' },
                          { value: 'CRITICAL', label: 'Critical Priority', color: 'bg-red-500', desc: 'Immediate attention, blocker' }
                        ].map(opt => {
                          const isSelected = formData.priority === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setFormData({...formData, priority: opt.value});
                                setShowPriorityDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b last:border-0 cursor-pointer ${
                                darkMode ? 'border-gray-700/50 hover:bg-gray-700/60' : 'border-gray-100 hover:bg-indigo-50/40'
                              } ${isSelected ? (darkMode ? 'bg-indigo-950/40 text-indigo-400 font-semibold' : 'bg-indigo-50 text-indigo-700 font-semibold') : ''}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                                <div className="font-semibold text-sm">{opt.label}</div>
                              </div>
                              <div className={`text-[10px] opacity-75 mt-0.5 ml-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{opt.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`text-sm font-medium block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Estimated Hours</label>
                    {predictedHours !== null && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, estimatedHours: predictedHours.toFixed(1) }))}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                          formData.estimatedHours === predictedHours.toFixed(1)
                            ? (darkMode ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/50' : 'bg-indigo-50 text-indigo-700 border border-indigo-200')
                            : (darkMode ? 'bg-purple-950/50 hover:bg-purple-900/30 text-purple-300 border border-purple-800/40' : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200')
                        }`}
                      >
                        ✨ AI Suggests: {predictedHours.toFixed(1)}h
                        {formData.estimatedHours !== predictedHours.toFixed(1) && ' (Apply)'}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    placeholder="Hours"
                    value={formData.estimatedHours}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, estimatedHours: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition-all duration-200 ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-550 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                    }`}
                    step="0.5"
                  />
                </div>

                <div>
                  <label className={`text-sm font-medium mb-1 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Due Date *</label>
                  <input
                    type="datetime-local"
                    value={formData.dueDate}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, dueDate: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition-all duration-200 ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15' 
                        : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
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
                <div className="mt-2">
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowAIDetails(!showAIDetails)}
                      className={`text-xs flex items-center gap-1.5 font-medium transition-all cursor-pointer ${
                        darkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-650 hover:text-indigo-700'
                      }`}
                    >
                      <Brain className="w-3.5 h-3.5" />
                      {showAIDetails ? "Hide AI Confidence & Insights" : "Show AI Confidence & Insights"}
                    </button>
                  </div>
                  {showAIDetails && (
                    <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }} className="mt-2">
                      <TaskDurationPredictor 
                        taskData={taskData}
                        description={formData.description}
                        onPredictionReceived={handlePredictionReceived}
                        darkMode={darkMode}
                      />
                    </div>
                  )}
                </div>
              )}
              
              {canManage && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className={`flex items-center gap-2 text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      <Users className="w-4 h-4" /> Team (Optional)
                    </label>
                    
                    {/* Hidden native select for standard HTML form/testing accessibility */}
                    <select
                      value={formData.teamId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({...formData, teamId: e.target.value, assignedEmployeeId: ''})}
                      className="hidden"
                      style={{ display: 'none' }}
                    >
                      <option value="">-- Public Task (All Teams Can See) --</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setShowTeamDropdown(!showTeamDropdown);
                        setShowEmployeeDropdown(false);
                      }}
                      className={`w-full px-3 py-2 border rounded-lg flex items-center justify-between text-left outline-none transition-all duration-200 cursor-pointer ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-gray-100 hover:border-gray-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15' 
                          : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                      }`}
                    >
                      <span className="truncate">
                        {formData.teamId 
                          ? (teams.find(t => t.id === formData.teamId)?.name || 'Select Team') 
                          : 'Public Task (All Teams)'}
                      </span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showTeamDropdown ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showTeamDropdown && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowTeamDropdown(false)} />
                        <div className={`absolute left-0 right-0 mt-1 rounded-xl shadow-xl border z-40 max-h-60 overflow-y-auto transition-all ${
                          darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-250 text-gray-900'
                        }`}>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({...formData, teamId: '', assignedEmployeeId: ''});
                              setShowTeamDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b last:border-0 cursor-pointer ${
                              darkMode ? 'border-gray-700/50 hover:bg-gray-700/60' : 'border-gray-100 hover:bg-indigo-50/40'
                            } ${!formData.teamId ? (darkMode ? 'bg-indigo-950/40 text-indigo-400 font-semibold' : 'bg-indigo-50 text-indigo-700 font-semibold') : ''}`}
                          >
                            <div className="font-semibold text-xs uppercase tracking-wider text-purple-500 mb-0.5">Public Access</div>
                            <div className="text-sm font-medium">Public Task (All Teams)</div>
                          </button>
                          
                          {teams.map(team => {
                            const isSelected = formData.teamId === team.id;
                            return (
                              <button
                                key={team.id}
                                type="button"
                                onClick={() => {
                                  setFormData({...formData, teamId: team.id, assignedEmployeeId: ''});
                                  setShowTeamDropdown(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b last:border-0 cursor-pointer ${
                                  darkMode ? 'border-gray-700/50 hover:bg-gray-700/60' : 'border-gray-100 hover:bg-indigo-50/40'
                                } ${isSelected ? (darkMode ? 'bg-indigo-950/40 text-indigo-400 font-semibold' : 'bg-indigo-50 text-indigo-700 font-semibold') : ''}`}
                              >
                                <div className="font-medium text-sm">{team.name}</div>
                                {team.department && (
                                  <div className={`text-[10px] opacity-75 mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Department: {team.department}</div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {formData.teamId && selectedTeamEmployees.length > 0 ? (
                    <div className="relative">
                      <label className={`flex items-center gap-2 text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <User className="w-4 h-4" /> Assign to Specific Employee (Optional)
                      </label>
                      
                      {/* Hidden native select for standard HTML form/testing accessibility */}
                      <select
                        value={formData.assignedEmployeeId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({...formData, assignedEmployeeId: e.target.value})}
                        className="hidden"
                        style={{ display: 'none' }}
                      >
                        <option value="">-- Entire Team --</option>
                        {selectedTeamEmployees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          setShowEmployeeDropdown(!showEmployeeDropdown);
                          setShowTeamDropdown(false);
                        }}
                        className={`w-full px-3 py-2 border rounded-lg flex items-center justify-between text-left outline-none transition-all duration-200 cursor-pointer ${
                          darkMode 
                            ? 'bg-gray-700 border-gray-600 text-gray-100 hover:border-gray-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15' 
                            : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                        }`}
                      >
                        <span className="truncate">
                          {formData.assignedEmployeeId
                            ? (() => {
                                const emp = selectedTeamEmployees.find(e => e.id === formData.assignedEmployeeId);
                                return emp ? `${emp.firstName} ${emp.lastName}` : 'Select Employee';
                              })()
                            : 'Entire Team'}
                        </span>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showEmployeeDropdown ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showEmployeeDropdown && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setShowEmployeeDropdown(false)} />
                          <div className={`absolute left-0 right-0 mt-1 rounded-xl shadow-xl border z-40 max-h-60 overflow-y-auto transition-all ${
                            darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-250 text-gray-900'
                          }`}>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({...formData, assignedEmployeeId: ''});
                                setShowEmployeeDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b last:border-0 cursor-pointer ${
                                darkMode ? 'border-gray-700/50 hover:bg-gray-700/60' : 'border-gray-100 hover:bg-indigo-50/40'
                              } ${!formData.assignedEmployeeId ? (darkMode ? 'bg-indigo-950/40 text-indigo-400 font-semibold' : 'bg-indigo-50 text-indigo-700 font-semibold') : ''}`}
                            >
                              <div className="font-semibold text-xs uppercase tracking-wider text-purple-500 mb-0.5">General Assignment</div>
                              <div className="text-sm font-medium">Entire Team</div>
                            </button>

                            {selectedTeamEmployees.map(emp => {
                              const isSelected = formData.assignedEmployeeId === emp.id;
                              return (
                                <button
                                  key={emp.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData({...formData, assignedEmployeeId: emp.id});
                                    setShowEmployeeDropdown(false);
                                  }}
                                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b last:border-0 cursor-pointer ${
                                    darkMode ? 'border-gray-700/50 hover:bg-gray-700/60' : 'border-gray-100 hover:bg-indigo-50/40'
                                  } ${isSelected ? (darkMode ? 'bg-indigo-950/40 text-indigo-400 font-semibold' : 'bg-indigo-50 text-indigo-700 font-semibold') : ''}`}
                                >
                                  <div className="font-medium text-sm">{emp.firstName} {emp.lastName}</div>
                                  {emp.role && (
                                    <div className={`text-[10px] opacity-75 mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Role: {emp.role}</div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
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
          onTaskUpdate={(updatedTask) => {
            fetchData();
            if (updatedTask) {
              setSelectedTaskForDetails(updatedTask);
            } else {
              setShowDetailsModal(false);
              setSelectedTaskForDetails(null);
            }
          }}
          onCloneTask={handleCloneTask}
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
          onAssignmentCreated={() => {
            fetchData();
            showToast('Task assigned successfully!', 'success');
          }}
        />
      )}

      <AIPrioritizerModal
        isOpen={showPrioritizerModal}
        tasks={aiModalTasks}
        onClose={() => { setShowPrioritizerModal(false); setSingleAITask(null); }}
        onApplied={() => {
          setShowPrioritizerModal(false);
          setSingleAITask(null);
          fetchData();
        }}
      />

      <AIBulkPlannerModal
        isOpen={showBulkPlannerModal}
        tasks={aiModalTasks}
        onClose={() => { setShowBulkPlannerModal(false); setSingleAITask(null); }}
        onApplied={() => {
          setShowBulkPlannerModal(false);
          setSingleAITask(null);
          fetchData();
        }}
      />

      <TeamSkillGapRadarModal
        isOpen={showSkillGapRadarModal}
        tasks={aiModalTasks}
        onClose={() => { setShowSkillGapRadarModal(false); setSingleAITask(null); }}
      />
    </div>
  );
};

export default TasksPage;