/**
 * @fileoverview API utility module for the Smart Allocation frontend application.
 * Provides centralized API communication functions for all backend endpoints including
 * authentication, tasks, employees, teams, assignments, notifications, chat, and AI features.
 * @module utils/api
 */

/** @constant {string} API_BASE - Base URL for all API requests */
const API_BASE = "http://localhost:8080/api";

/** @type {number} profileImageVersion - Timestamp for cache-busting profile images */
let profileImageVersion = Date.now();

/**
 * Increments the profile image version timestamp to force cache refresh.
 * Called when a user updates their profile image.
 * @function incrementProfileImageVersion
 * @returns {number} The new timestamp value
 * @example
 * // After uploading a new profile image
 * const newVersion = incrementProfileImageVersion();
 */
export const incrementProfileImageVersion = () => {
  profileImageVersion = Date.now();
  return profileImageVersion;
};

/**
 * Appends a cache-busting version query parameter to a profile image URL.
 * @function getProfileImageUrl
 * @param {string|null} baseUrl - The base URL of the profile image
 * @returns {string|null} The URL with version query parameter, or null if no base URL provided
 * @example
 * const url = getProfileImageUrl('http://localhost:8080/api/employees/123/profile-image');
 * // Returns: 'http://localhost:8080/api/employees/123/profile-image?v=1700000000000'
 */
export const getProfileImageUrl = (baseUrl) => {
  if (!baseUrl) return null;
  return `${baseUrl}?v=${profileImageVersion}`;
};

/**
 * Constructs authentication headers for API requests.
 * Retrieves the JWT token and company ID from localStorage.
 * @function getAuthHeaders
 * @returns {Object} Headers object containing Content-Type, Authorization (if token exists), and X-Company-Id (if exists)
 * @example
 * const headers = getAuthHeaders();
 * // { 'Content-Type': 'application/json', 'Authorization': 'Bearer eyJ...' }
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  const companyId = localStorage.getItem("companyId");

  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(companyId && { "X-Company-Id": companyId }),
  };
};

/**
 * Handles API response by checking status and parsing JSON content.
 * @async
 * @function handleResponse
 * @param {Response} response - The fetch Response object
 * @returns {Promise<Object>} Parsed JSON response or empty object for non-JSON responses
 * @throws {Error} If response is not OK, with the error message from the server
 * @example
 * const data = await handleResponse(await fetch(url, options));
 */
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
  }
  // For DELETE requests or other responses with no content
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  }
  return {}; // Return empty object for non-JSON responses
};

/**
 * Authentication API endpoints.
 * @namespace authAPI
 */
export const authAPI = {
  /**
   * Authenticates a user with email and password.
   * @function login
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.email - User's email address
   * @param {string} credentials.password - User's password
   * @returns {Promise<Object>} Response containing user data and JWT token
   * @throws {Error} If authentication fails
   * @example
   * const { user, token } = await authAPI.login({ email: 'user@example.com', password: 'pass123' });
   */
  login: (credentials) =>
    fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    }).then(handleResponse),

  /**
   * Registers a new user account.
   * @function register
   * @param {Object} userData - User registration data
   * @param {string} userData.username - Desired username
   * @param {string} userData.email - User's email address
   * @param {string} userData.password - User's password
   * @returns {Promise<Object>} Response containing created user data
   * @throws {Error} If registration fails (e.g., email already exists)
   */
  register: (userData) =>
    fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    }).then(handleResponse),

  /**
   * Refreshes an expired JWT token.
   * @function refreshToken
   * @returns {Promise<Object>} Response containing new JWT token
   * @throws {Error} If token refresh fails
   */
  refreshToken: () =>
    fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Registers a new company with an admin user.
   * @function registerCompany
   * @param {Object} data - Company registration data
   * @param {string} data.companyName - Name of the company
   * @param {string} data.adminUsername - Admin's username
   * @param {string} data.adminEmail - Admin's email
   * @param {string} data.adminPassword - Admin's password
   * @returns {Promise<Object>} Response containing company and admin user data
   * @throws {Error} If company registration fails
   */
  registerCompany: (data) =>
    fetch(`${API_BASE}/auth/register-company`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(handleResponse),
};

// Users
/**
 * User management API endpoints.
 * @namespace usersAPI
 */
export const usersAPI = {
  /**
   * Retrieves all users in the current company context.
   * @returns {Promise<Array>} List of user objects.
   */
  getAll: () =>
    fetch(`${API_BASE}/users`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Fetches a specific user by their unique identifier.
   * @param {string} id - The user UUID.
   * @returns {Promise<Object>} The requested user data.
   */
  getById: (id) =>
    fetch(`${API_BASE}/users/${id}`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Updates an existing user's information.
   * @param {string} id - Candidate user ID.
   * @param {Object} data - Updated user fields.
   * @returns {Promise<Object>} The updated user object.
   */
  update: (id, data) =>
    fetch(`${API_BASE}/users/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Permanently deletes a user account.
   * @param {string} id - User ID to remove.
   * @returns {Promise<void>}
   */
  delete: (id) =>
    fetch(`${API_BASE}/users/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then((response) => {
      if (!response.ok) throw new Error("Failed to delete user");
    }),
};

// Tasks
/**
 * Task management and workflow API endpoints.
 * @namespace tasksAPI
 */
export const tasksAPI = {
  /**
   * Fetches all tasks accessible to the current user.
   * @returns {Promise<Array>} List of task objects.
   */
  getAll: () =>
    fetch(`${API_BASE}/tasks`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Retrieves detailed information for a single task.
   * @param {string} id - Task UUID.
   * @returns {Promise<Object>} Task details including assignments.
   */
  getById: (id) =>
    fetch(`${API_BASE}/tasks/${id}`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Filters tasks based on their current workflow status.
   * @param {string} status - e.g., 'TODO', 'IN_PROGRESS', 'DONE'.
   * @returns {Promise<Array>} Filtered task list.
   */
  getByStatus: (status) =>
    fetch(`${API_BASE}/tasks/status/${status}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Retrieves a paginated and filtered list of tasks.
   * @param {number} [page=0] - Page index.
   * @param {number} [size=20] - Records per page.
   * @param {string} [sortBy='createdAt'] - Field to order by.
   * @param {string} [sortDir='desc'] - Sort direction ('asc' or 'desc').
   * @param {Object} [filters={}] - Inclusion/exclusion criteria for status, priority, and search text.
   * @returns {Promise<Object>} Paginated result object with list and metadata.
   */
  getAllPaginated: (
    page = 0,
    size = 20,
    sortBy = "createdAt",
    sortDir = "desc",
    filters = {},
  ) => {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
    });

    // Dynamically append non-default filters to the query string
    if (filters.status && filters.status !== "ALL") {
      params.append("status", filters.status);
    }
    if (filters.priority && filters.priority !== "ALL") {
      params.append("priority", filters.priority);
    }
    if (filters.search && filters.search.trim()) {
      params.append("search", filters.search.trim());
    }

    return fetch(`${API_BASE}/tasks/paginated?${params}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse);
  },

  /**
   * Creates a new task in the system.
   * @param {Object} data - Task definition.
   * @returns {Promise<Object>} The created task object.
   */
  create: (data) =>
    fetch(`${API_BASE}/tasks`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Submits a task request for approval.
   * @param {Object} data - Request details.
   * @returns {Promise<Object>} The pending task request object.
   */
  requestTask: (data) =>
    fetch(`${API_BASE}/tasks/request`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Approves a pending task request.
   * @param {string} id - Task ID.
   * @returns {Promise<Object>} The approved task.
   */
  approveTask: (id) =>
    fetch(`${API_BASE}/tasks/${id}/approve`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Updates an existing task's attributes.
   * @param {string} id - Task ID.
   * @param {Object} data - Fields to update.
   * @returns {Promise<Object>} The modified task.
   */
  update: (id, data) =>
    fetch(`${API_BASE}/tasks/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Deletes a task from the system.
   * @param {string} id - Task ID.
   * @returns {Promise<void>}
   */
  delete: (id) =>
    fetch(`${API_BASE}/tasks/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Moves a task to the archive.
   * @param {string} id - Task ID.
   * @returns {Promise<Object>} The archived task.
   */
  archive: (id) =>
    fetch(`${API_BASE}/tasks/${id}/archive`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Retrieves all archived tasks.
   * @returns {Promise<Array>} List of archived tasks.
   */
  getArchived: () =>
    fetch(`${API_BASE}/tasks/archived`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Transitions a task to a new status.
   * @param {string} id - Task ID.
   * @param {string} status - New status code.
   * @returns {Promise<Object>} Updated task state.
   */
  updateStatus: (id, status) =>
    fetch(`${API_BASE}/tasks/${id}/status?status=${status}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Fetches all pending task requests waiting for review.
   * @returns {Promise<Array>} List of task requests.
   */
  getTaskRequests: () =>
    fetch(`${API_BASE}/tasks/requests`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Rejects a task request.
   * @param {string} id - Task ID.
   * @returns {Promise<Object>} Rejected task state.
   */
  rejectTask: (id) =>
    fetch(`${API_BASE}/tasks/${id}/reject`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Verification if the current user has permission to edit a task.
   * @param {string} id - Task ID.
   * @returns {Promise<{canEdit: boolean}>}
   */
  canEdit: (id) =>
    fetch(`${API_BASE}/tasks/${id}/can-edit`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Verification if the current user has permission to delete a task.
   * @param {string} id - Task ID.
   * @returns {Promise<{canDelete: boolean}>}
   */
  canDelete: (id) =>
    fetch(`${API_BASE}/tasks/${id}/can-delete`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

// Task Comments
/**
 * API for managing task discussions/comments.
 * @namespace taskCommentsAPI
 */
export const taskCommentsAPI = {
  /**
   * Retrieves all comments for a given task.
   * @param {string} taskId - Target task UUID.
   * @returns {Promise<Array>} List of comment objects.
   */
  getByTask: (taskId) =>
    fetch(`${API_BASE}/tasks/comments/task/${taskId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Posts a new comment to a task.
   * @param {Object} data - Comment payload containing text and taskId.
   * @returns {Promise<Object>} The created comment.
   */
  create: (data) =>
    fetch(`${API_BASE}/tasks/comments`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Removes a specific comment.
   * @param {string} id - Comment ID.
   * @returns {Promise<void>}
   */
  delete: (id) =>
    fetch(`${API_BASE}/tasks/comments/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Gets the total count of comments for a task.
   * @param {string} taskId - Task ID.
   * @returns {Promise<number>} Total comment count.
   */
  getCount: (taskId) =>
    fetch(`${API_BASE}/tasks/comments/task/${taskId}/count`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

// Task Audit Log
/** @namespace taskAuditAPI */
export const taskAuditAPI = {
  /**
   * Fetches the audit trail for a task.
   * @param {string} taskId - Task ID.
   * @returns {Promise<Array>} List of historical events.
   */
  getHistory: (taskId) =>
    fetch(`${API_BASE}/tasks/audit/task/${taskId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

// Task Time Tracking
/** @namespace taskTimeAPI */
export const taskTimeAPI = {
  /**
   * Logs time spent on a task.
   * @param {Object} data - { taskId, hours, description }.
   * @returns {Promise<Object>} Log entry.
   */
  logTime: (data) =>
    fetch(`${API_BASE}/tasks/time`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Retrieves all time logs for a task.
   * @param {string} taskId - Task ID.
   * @returns {Promise<Array>} Time tracking entries.
   */
  getByTask: (taskId) =>
    fetch(`${API_BASE}/tasks/time/task/${taskId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Calculates total hours logged for a task.
   * @param {string} taskId - Task ID.
   * @returns {Promise<number>} Cumulative hours.
   */
  getTotalHours: (taskId) =>
    fetch(`${API_BASE}/tasks/time/task/${taskId}/total`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

// Employees
/**
 * Employee data management API.
 * @namespace employeesAPI
 */
export const employeesAPI = {
  /**
   * Retrieves all employees in the current company.
   * @returns {Promise<Array>} Employee records.
   */
  getAll: () =>
    fetch(`${API_BASE}/employees`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Gets specific employee data by UUID.
   * @param {string} id - Employee ID.
   * @returns {Promise<Object>} Employee profile.
   */
  getById: (id) =>
    fetch(`${API_BASE}/employees/${id}`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Finds the employee profile associated with a specific user account.
   * @param {string} userId - User UUID.
   * @returns {Promise<Object>} Employee record.
   */
  getByUserId: (userId) =>
    fetch(`${API_BASE}/employees/user/${userId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Paginated retrieval of employees with filtering.
   * @param {number} [page=0]
   * @param {number} [size=20]
   * @param {string} [sortBy='firstName']
   * @param {string} [sortDir='asc']
   * @param {Object} [filters={}] - Inclusion/exclusion criteria for department and position.
   * @returns {Promise<Object>} Paginated employee data.
   */
  getAllPaginated: (
    page = 0,
    size = 20,
    sortBy = "firstName",
    sortDir = "asc",
    filters = {},
  ) => {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
    });

    // Filter out 'ALL' department/position selection to allow backend to default
    if (filters.department && filters.department !== "ALL") {
      params.append("department", filters.department);
    }
    if (filters.position && filters.position !== "ALL") {
      params.append("position", filters.position);
    }
    if (filters.search && filters.search.trim()) {
      params.append("search", filters.search.trim());
    }

    return fetch(`${API_BASE}/employees/paginated?${params}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse);
  },

  /**
   * Creates a new employee profile.
   * @param {Object} data - Profile data.
   * @returns {Promise<Object>} Created record.
   */
  create: (data) =>
    fetch(`${API_BASE}/employees`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Updates an existing employee profile.
   * @param {string} id - Employee ID.
   * @param {Object} data - Fields to update.
   * @returns {Promise<Object>} Updated profile.
   */
  update: (id, data) =>
    fetch(`${API_BASE}/employees/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Fetches the technical skills associated with an employee.
   * @param {string} id - Employee ID.
   * @returns {Promise<Array>} List of skill names/objects.
   */
  getSkills: async (id) => {
    // Explicitly request simple format to reduce bandwidth
    const response = await fetch(
      `${API_BASE}/employees/${id}/skills?format=simple`,
      {
        headers: getAuthHeaders(),
      },
    );
    const data = await handleResponse(response);

    // Handle different backend response variations for robustness
    if (Array.isArray(data)) {
      return data;
    }

    if (data && data.skills && Array.isArray(data.skills)) {
      return data.skills;
    }

    console.warn("Unexpected skills response format:", data);
    return [];
  },

  /**
   * Retrieves workload statistics for all employees.
   * @returns {Promise<Array>} Workload metrics.
   */
  getWorkload: () =>
    fetch(`${API_BASE}/employees/workload`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),
};

// Departments
/** @namespace departmentsAPI */
export const departmentsAPI = {
  /**
   * List all organizational departments.
   * @returns {Promise<Array>}
   */
  getAll: () =>
    fetch(`${API_BASE}/departments`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Find department by its name indicator.
   * @param {string} name - Department name.
   * @returns {Promise<Object>}
   */
  getByName: (name) =>
    fetch(`${API_BASE}/departments/${encodeURIComponent(name)}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Simpler list of department names.
   * @returns {Promise<Array<string>>}
   */
  getDepartmentNames: () =>
    fetch(`${API_BASE}/departments/list`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Registers a new department.
   * @param {Object} data - Department information.
   * @returns {Promise<Object>}
   */
  create: (data) =>
    fetch(`${API_BASE}/departments`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Removes a department.
   * @param {string} name - Department name.
   * @returns {Promise<void>}
   */
  delete: (name) =>
    fetch(`${API_BASE}/departments/${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then((response) => {
      if (!response.ok) throw new Error("Failed to delete department");
    }),
};

// Teams
/** @namespace teamsAPI */
export const teamsAPI = {
  /** Retrieves all defined teams. */
  getAll: () =>
    fetch(`${API_BASE}/teams`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /** Retrieves teams where the current user is a member. */
  getMyTeams: () =>
    fetch(`${API_BASE}/teams/my-teams`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /** Detail for a single team. */
  getById: (id) =>
    fetch(`${API_BASE}/teams/${id}`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /** Paginated team list with optional sorting. */
  getAllPaginated: (
    page = 0,
    size = 20,
    sortBy = "name",
    sortDir = "asc",
    filters = {},
  ) => {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
      ...filters,
    });

    return fetch(`${API_BASE}/teams/paginated?${params}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse);
  },

  /** Create a new collaboration group. */
  create: (data) =>
    fetch(`${API_BASE}/teams`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Remove a team. */
  delete: (id) =>
    fetch(`${API_BASE}/teams/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then((response) => {
      if (!response.ok) throw new Error("Failed to delete team");
      return {};
    }),
};

// Assignments
/** @namespace assignmentsAPI */
export const assignmentsAPI = {
  /** List assignments for a specific employee. */
  getByEmployee: (id) =>
    fetch(`${API_BASE}/assignments/employee/${id}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** List assignments tied to a specific task. */
  getByTask: (id) =>
    fetch(`${API_BASE}/assignments/task/${id}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Manually creates an employee-to-task assignment.
   * @param {Object} data - { taskId, employeeId, notes, ... }.
   * @returns {Promise<Object>} The assignment record.
   */
  create: (data) => {
    // Normalizing payload structure for backend ingestion
    const payload = {
      taskId: data.taskId,
      employeeId: data.employeeId,
      assignedBy: data.assignedBy || "MANUAL",
      fitScore: data.fitScore || null,
      confidenceScore: data.confidenceScore || null,
      notes: data.notes || null,
      assignedByUserId: data.assignedByUserId || null,
    };

    return fetch(`${API_BASE}/assignments`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    }).then(handleResponse);
  },

  /** Employee acceptance of a pending assignment. */
  accept: (id) =>
    fetch(`${API_BASE}/assignments/${id}/accept`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

// Notifications
/** @namespace notificationsAPI */
export const notificationsAPI = {
  /** Fetch notification history. */
  getByUser: (userId) =>
    fetch(`${API_BASE}/notifications/user/${userId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Only unread notifications. */
  getUnread: (userId) =>
    fetch(`${API_BASE}/notifications/user/${userId}/unread`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Mark single notification as read. */
  markAsRead: (id) =>
    fetch(`${API_BASE}/notifications/${id}/read`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Clear all notifications as read. */
  markAllAsRead: (userId) =>
    fetch(`${API_BASE}/notifications/user/${userId}/read-all`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Trigger a system notification manually. */
  create: (data) =>
    fetch(`${API_BASE}/notifications`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),
};

// Chat
/** @namespace chatAPI */
export const chatAPI = {
  /** Post a message to a team or user. */
  sendMessage: (data) =>
    fetch(`${API_BASE}/chat/send`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Fetch message history for a team room. */
  getTeamMessages: (teamId) =>
    fetch(`${API_BASE}/chat/team/${teamId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** 1-to-1 conversation history. */
  getDirectMessages: (otherUserId) =>
    fetch(`${API_BASE}/chat/direct/${otherUserId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Aggregate unread message counts. */
  getUnreadCount: () =>
    fetch(`${API_BASE}/chat/unread/count`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /** Mark message as viewed. */
  markAsRead: (id) =>
    fetch(`${API_BASE}/chat/${id}/read`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Unread per-contact grouping. */
  getUnreadCountPerContact: () =>
    fetch(`${API_BASE}/chat/unread/per-contact`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** List of users available for chat. */
  getAvailableContacts: () =>
    fetch(`${API_BASE}/chat/contacts`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** List of recent conversation threads. */
  getConversations: () =>
    fetch(`${API_BASE}/chat/conversations`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** List of team-based chat rooms. */
  getUserTeamChats: () =>
    fetch(`${API_BASE}/chat/teams`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Clears all unread badges for the user. */
  markAllAsRead: () =>
    fetch(`${API_BASE}/chat/read-all`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

// Skills
/** @namespace skillsAPI */
export const skillsAPI = {
  /** Global catalog of technical skills. */
  getAll: () =>
    fetch(`${API_BASE}/skills`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Unique skill record. */
  getById: (id) =>
    fetch(`${API_BASE}/skills/${id}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Retrieve skill by exact name match. */
  getByName: (name) =>
    fetch(`${API_BASE}/skills/name/${encodeURIComponent(name)}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Skills grouped by domain category (e.g. 'Frontend'). */
  getByCategory: (category) =>
    fetch(`${API_BASE}/skills/category/${encodeURIComponent(category)}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Add a new skill to the taxonomy. */
  create: (data) =>
    fetch(`${API_BASE}/skills`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Update skill metadata. */
  update: (id, data) =>
    fetch(`${API_BASE}/skills/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Delete skill. */
  delete: (id) =>
    fetch(`${API_BASE}/skills/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then((response) => {
      if (!response.ok) throw new Error("Failed to delete skill");
    }),
};

// AI API with cache-busting support
/**
 * AI Service integration endpoints for advanced decision support.
 * @namespace aiAPI
 */
export const aiAPI = {
  /**
   * Fetches employee candidates recommended by AI for a specific task.
   * @param {Object} data - { taskId, taskTitle, description, priority, ... }.
   * @returns {Promise<Object>} Suggestions with fit scores and reasoning.
   */
  getAssignmentSuggestions: (data) =>
    fetch(`${API_BASE}/ai/assignments/suggest`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Predicts completion time for a task based on historical performance.
   * @param {Object} data - { taskId, priority, complexityScore, requiredSkillIds }.
   * @returns {Promise<Object>} Estimation with confidence intervals.
   */
  predictDuration: (data) =>
    fetch(`${API_BASE}/ai/prediction/duration`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Efficiently fetches skills for multiple employees in one request.
   * @param {Array<string>} employeeIds - UUID collection.
   * @returns {Promise<Object>} Mapping of employee ID to skill list.
   */
  getEmployeeSkillsBatch: (employeeIds) => {
    const params = new URLSearchParams();
    employeeIds.forEach((id) => params.append("employeeIds", id));
    params.append("format", "simple");

    return fetch(`${API_BASE}/employees/skills/batch?${params}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse);
  },

  /**
   * Fetches required skills for a batch of tasks.
   * @param {Array<string>} taskIds - UUID collection.
   * @returns {Promise<Object>} Mapping of task ID to requirements.
   */
  getTaskSkillsBatch: (taskIds) => {
    const params = new URLSearchParams();
    taskIds.forEach((id) => params.append("taskIds", id));

    return fetch(`${API_BASE}/tasks/required-skills/batch?${params}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse);
  },

  /**
   * Detects outliers or issues in task distribution and hours.
   * @param {Object} data - { entityType, entityId }.
   * @param {boolean} [bustCache=false] - Force bypass of server-side cache.
   * @returns {Promise<Object>} List of flags and anomalies.
   */
  detectAnomalies: (data, bustCache = false) => {
    const timestamp = bustCache ? `?_t=${Date.now()}` : "";

    return fetch(`${API_BASE}/ai/anomaly/detect${timestamp}`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
      .then(handleResponse)
      .catch(() => {
        // Graceful degradation when AI service is unavailable
        return { results: [] };
      });
  },

  /**
   * Retrieves organization-wide productivity metrics.
   * @param {number} [timePeriodDays=30] - History window.
   * @param {boolean} [bustCache=false] - Force data recalculation.
   * @returns {Promise<Object>} Aggregated analytics object.
   */
  getProductivityAnalytics: (timePeriodDays = 30, bustCache = false) => {
    return fetch(`${API_BASE}/ai/analytics/productivity`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        time_period_days: timePeriodDays,
        bust_cache: bustCache,
      }),
    }).then(handleResponse);
  },

  /**
   * Optimizes resource allocation across multiple tasks simultaneously.
   * @param {Object} data - { taskIds, optimizeWorkload }.
   * @returns {Promise<Object>} Global assignment plan.
   */
  bulkOptimize: (data) =>
    fetch(`${API_BASE}/ai/assignments/bulk-optimize`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Alternate load-balanced optimization endpoint. */
  bulkOptimizeBalanced: (taskIds, token, companyId) =>
    fetch(`${API_BASE}/api/ai/assignment/bulk-optimize-balanced`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Company-Id": companyId,
      },
      body: JSON.stringify({
        task_ids: taskIds,
        optimize_workload: true,
      }),
    }).then(handleResponse),

  /** Triggers model retraining based on user feedback and new data. */
  triggerRetraining: (fullRetrain = false) =>
    fetch(`${API_BASE}/ai/feedback/retrain?fullRetrain=${fullRetrain}`, {
      method: "POST",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Fetches metadata about currently deployed ML models. */
  getModelInfo: () =>
    fetch(`${API_BASE}/ai/feedback/model-info`, {
      method: "GET",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** NLP-based skill extraction from task text. */
  extractSkillsFromText: (data) =>
    fetch(`${API_BASE}/ai/skills/extract`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Analyzes linguistic patterns to determine task complexity. */
  analyzeTaskComplexity: (data) =>
    fetch(`${API_BASE}/ai/task-analysis/analyze`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Recommends missing skills for a team based on assigned tasks. */
  suggestTeamSkills: (data) =>
    fetch(`${API_BASE}/ai/skills/suggest-for-team`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Retrieves categories detected by AI in the skill catalog. */
  getSkillCategories: () =>
    fetch(`${API_BASE}/ai/skills/categories`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Batch NLP extraction for multiple task items. */
  batchExtractSkills: (tasks) =>
    fetch(`${API_BASE}/ai/skills/batch-extract`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(tasks),
    }).then(handleResponse),
};

// Chatbot API
/**
 * Interactive AI Assistant communication endpoints.
 * @namespace chatbotAPI
 */
export const chatbotAPI = {
  /**
   * Passes a user message to the conversational AI.
   * @param {Object} data - { query, context }.
   * @returns {Promise<Object>} Chatbot response and suggested actions.
   */
  query: (data) =>
    fetch(`${API_BASE}/ai/chatbot/query`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Verification of chatbot engine availability. */
  health: () =>
    fetch(`${API_BASE}/ai/chatbot/health`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Admin trigger to download/update specific LLM models. */
  pullModel: (modelName = "phi3") =>
    fetch(`${API_BASE}/ai/chatbot/pull-model?model_name=${modelName}`, {
      method: "POST",
      headers: getAuthHeaders(),
    }).then(handleResponse),
};
