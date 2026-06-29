/**
 * @fileoverview API utility module for the Smart Allocation frontend application.
 * Provides centralized API communication functions for all backend endpoints including
 * authentication, tasks, employees, teams, assignments, notifications, chat, and AI features.
 * @module utils/api
 */

import {
  User,
  Employee,
  Skill,
  Task,
  TaskAssignment,
  TaskComment,
  TaskAuditLog,
  TaskTimeEntry,
  Team,
  Department,
  Notification as AppNotification,
  Company,
  PaginatedResponse,
  LoginResponse,
  AIAssignmentResponse,
  DurationPrediction,
  ComplexityAnalysis,
  SkillExtractionResponse,
  ChatbotResponse,
  DashboardStats,
  WorkloadData,
} from "../types";

/** @constant {string} API_BASE - Base URL for all API requests */
export const API_BASE = "/api";

// --- Shadow fetch to preserve url and options for JWT refresh interceptor ---
const originalFetch = window.fetch;
const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const fetchFunc = globalThis.fetch || window.fetch || originalFetch;
  const newInit = { ...init, credentials: "same-origin" as RequestCredentials };
  const response = await fetchFunc(input, newInit);
  if (response && (typeof response === "object" || typeof response === "function")) {
    const url = typeof input === "string" ? input : (input as any).url || input.toString();
    try {
      Object.defineProperty(response, "_originalUrl", { value: url, writable: true, configurable: true });
      Object.defineProperty(response, "_originalOptions", { value: init, writable: true, configurable: true });
    } catch (e) {
      try {
        (response as any)._originalUrl = url;
        (response as any)._originalOptions = init;
      } catch (e2) {
        // Ignore if response is frozen or cannot be written
      }
    }
  }
  return response;
};

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
export const getProfileImageUrl = (baseUrl: string | null): string | null => {
  if (!baseUrl) return null;
  if (baseUrl.startsWith('data:image')) return baseUrl;
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
export const getAuthHeaders = (): Record<string, string> => {
  const companyId = localStorage.getItem("companyId");

  return {
    "Content-Type": "application/json",
    ...(companyId && { "X-Company-Id": companyId }),
  };
};

// ─────────────────────── JWT AUTO-REFRESH INTERCEPTOR ───────────────────────

/** Tracks whether a token refresh is currently in progress. */
let isRefreshing = false;

let refreshQueue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

const processRefreshQueue = (error: Error | null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
  refreshQueue = [];
};

const attemptTokenRefresh = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return false;

    const data = await response.json();
    if (data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Handles API response by checking status and parsing JSON content.
 * If a 401 Unauthorized response is received, automatically attempts
 * to refresh the JWT token and retry the original request. Concurrent
 * 401 responses are queued to avoid multiple simultaneous refresh calls.
 *
 * @async
 * @function handleResponse
 * @param {Response} response - The fetch Response object
 * @param {string} [originalUrl] - The URL of the original request (for retry)
 * @param {RequestInit} [originalOptions] - The options of the original request (for retry)
 * @returns {Promise<Object>} Parsed JSON response or empty object for non-JSON responses
 * @throws {Error} If response is not OK, with the error message from the server
 */
const handleResponse = async (
  response: Response,
  originalUrl?: string,
  originalOptions?: RequestInit
): Promise<any> => {
  if (!response) {
    throw new Error("No response received");
  }
  const url = originalUrl || (response as any)._originalUrl;
  const options = originalOptions || (response as any)._originalOptions;
  originalUrl = url;
  originalOptions = options;

  // --- 401 Auto-Refresh Logic ---
  if (response.status === 401 && originalUrl && !originalUrl.includes("/auth/")) {
    if (isRefreshing) {
      // Another refresh is in progress — queue this request
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: async () => {
            try {
              const retryResponse = await fetch(originalUrl, originalOptions);
              resolve(await handleResponse(retryResponse));
            } catch (err) {
              reject(err);
            }
          },
          reject,
        });
      });
    }

    isRefreshing = true;
    try {
      const success = await attemptTokenRefresh();
      if (success) {
        processRefreshQueue(null);
        // Retry the original request (cookies will be attached automatically)
        const retryResponse = await fetch(originalUrl, originalOptions);
        return handleResponse(retryResponse);
      } else {
        // Refresh failed — session expired, redirect to login
        const error = new Error("Session expired. Please log in again.");
        processRefreshQueue(error, null);
        localStorage.clear();
        sessionStorage.clear();
        if (typeof window !== "undefined" && window.location && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        throw error;
      }
    } finally {
      isRefreshing = false;
    }
  }

  // --- Standard response handling ---
  if (!response.ok) {
    // Fallback 401 handler for calls without retry context
    if (response.status === 401 && !originalUrl) {
      const newToken = await attemptTokenRefresh();
      if (!newToken) {
        localStorage.clear();
        sessionStorage.clear();
        if (typeof window !== "undefined" && window.location && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        throw new Error("Session expired. Please log in again.");
      }
      // Token refreshed but we can't retry without original URL — caller should retry
      throw new Error("TOKEN_REFRESHED");
    }
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      if (errorText) {
        const errorJson = JSON.parse(errorText);
        if (errorJson.validationErrors && Object.keys(errorJson.validationErrors).length > 0) {
          const validationMsgs = Object.entries(errorJson.validationErrors)
            .map(([field, msg]) => `${field}: ${msg}`)
            .join(', ');
          errorMessage = `${errorJson.message || 'Validation failed'}: ${validationMsgs}`;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        } else if (errorJson.error) {
          errorMessage = errorJson.error;
        } else {
          errorMessage = errorText;
        }
      }
    } catch (e) {
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  // For DELETE requests or other responses with no content
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  }
  if (contentType && contentType.indexOf("text/") !== -1) {
    return response.text();
  }
  return {}; // Return empty object for non-JSON responses
};

/**
 * Wrapper around fetch that integrates with the JWT auto-refresh interceptor.
 * Passes the original URL and options to handleResponse so that 401 responses
 * can trigger a transparent token refresh and request retry.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch RequestInit options
 * @returns Promise resolving to the parsed response
 */
export const authAPI = {
  /**
   * Authenticates a user with email and password.
   * @function login
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.email - User's email address
   * @param {string} credentials.password - User's password
   * @returns {Promise<LoginResponse>} Response containing user data and JWT token
   * @throws {Error} If authentication fails
   * @example
   * const { user, token } = await authAPI.login({ email: 'user@example.com', password: 'pass123' });
   */
  login: (credentials: Record<string, any>): Promise<LoginResponse> =>
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
   * @returns {Promise<User>} Response containing created user data
   * @throws {Error} If registration fails (e.g., email already exists)
   */
  register: (userData: Record<string, any>): Promise<User> =>
    fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    }).then(handleResponse),

  /**
   * Refreshes an expired JWT token.
   * @function refreshToken
   * @returns {Promise<{ token: string; refreshToken?: string }>} Response containing new JWT token
   * @throws {Error} If token refresh fails
   */
  refreshToken: (): Promise<{ token: string; refreshToken?: string }> =>
    fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  logout: (): Promise<void> =>
    fetch(`${API_BASE}/auth/logout`, {
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
   * @returns {Promise<{ company: Company; admin: User }>} Response containing company and admin user data
   * @throws {Error} If company registration fails
   */
  registerCompany: (data: Record<string, any>): Promise<{ company: Company; admin: User }> =>
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
   * @returns {Promise<User[]>} List of user objects.
   */
  getAll: (): Promise<User[]> =>
    fetch(`${API_BASE}/users`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Fetches a specific user by their unique identifier.
   * @param {string} id - The user UUID.
   * @returns {Promise<User>} The requested user data.
   */
  getById: (id: string): Promise<User> =>
    fetch(`${API_BASE}/users/${id}`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Updates an existing user's information.
   * @param {string} id - Candidate user ID.
   * @param {Object} data - Updated user fields.
   * @returns {Promise<User>} The updated user object.
   */
  update: (id: string, data: Partial<User>): Promise<User> =>
    fetch(`${API_BASE}/users/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Updates a user's presence status (Online, Away, DND, etc).
   * @param {string} id - User ID.
   * @param {string} status - New status string.
   * @returns {Promise<void>}
   */
  updateStatus: (id: string, status: string): Promise<void> =>
    fetch(`${API_BASE}/users/${id}/status`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }).then(handleResponse),

  /**
   * Updates a user's username.
   * @param {string} id - User ID.
   * @param {string} username - New username.
   * @returns {Promise<User>} Updated user.
   */
  updateUsername: (id: string, username: string): Promise<User> =>
    fetch(`${API_BASE}/users/${id}/username`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username }),
    }).then(handleResponse),

  /**
   * Permanently deletes a user account.
   * @param {string} id - User ID to remove.
   * @returns {Promise<void>}
   */
  delete: (id: string): Promise<void> =>
    fetch(`${API_BASE}/users/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then((response) => {
      if (!response.ok) throw new Error("Failed to delete user");
    }),

  /**
   * Soft-removes a user from their company without deleting the account.
   * The user can later join another company or create their own.
   * @param {string} id - User ID to remove from company.
   * @returns {Promise<void>}
   */
  removeFromCompany: (id: string, reason?: string): Promise<void> => {
    const reasonQuery = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    return fetch(`${API_BASE}/users/${id}/remove-from-company${reasonQuery}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then((response) => {
      if (!response.ok) throw new Error("Failed to remove user from company");
    });
  },

  /**
   * Joins a company for an existing user.
   * @param {string} id - User ID.
   * @param {string} companyCode - The company join code.
   * @returns {Promise<any>}
   */
  joinCompany: (id: string, companyCode: string): Promise<any> =>
    fetch(`${API_BASE}/users/${id}/join-company`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ companyCode }),
    }).then(handleResponse),
};

// Tasks
/**
 * Task management and workflow API endpoints.
 * @namespace tasksAPI
 */
export const tasksAPI = {
  /**
   * Fetches all tasks accessible to the current user.
   * @returns {Promise<Task[]>} List of task objects.
   */
  getAll: (): Promise<Task[]> =>
    fetch(`${API_BASE}/tasks`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Retrieves detailed information for a single task.
   * @param {string} id - Task UUID.
   * @returns {Promise<Task>} Task details including assignments.
   */
  getById: (id: string): Promise<Task> =>
    fetch(`${API_BASE}/tasks/${id}`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Filters tasks based on their current workflow status.
   * @param {string} status - e.g., 'TODO', 'IN_PROGRESS', 'DONE'.
   * @returns {Promise<Task[]>} Filtered task list.
   */
  getByStatus: (status: string): Promise<Task[]> =>
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
   * @returns {Promise<PaginatedResponse<Task>>} Paginated result object with list and metadata.
   */
  getAllPaginated: (
    page = 0,
    size = 20,
    sortBy = "createdAt",
    sortDir = "desc",
    filters: Record<string, any> = {},
  ): Promise<PaginatedResponse<Task>> => {
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
   * @returns {Promise<Task>} The created task object.
   */
  create: (data: Partial<Task>): Promise<Task> =>
    fetch(`${API_BASE}/tasks`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Submits a task request for approval.
   * @param {Object} data - Request details.
   * @returns {Promise<Task>} The pending task request object.
   */
  requestTask: (data: Record<string, unknown>): Promise<Task> =>
    fetch(`${API_BASE}/tasks/request`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Approves a pending task request.
   * @param {string} id - Task ID.
   * @returns {Promise<Task>} The approved task.
   */
  approveTask: (id: string): Promise<Task> =>
    fetch(`${API_BASE}/tasks/${id}/approve`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Updates an existing task's attributes.
   * @param {string} id - Task ID.
   * @param {Object} data - Fields to update.
   * @returns {Promise<Task>} The modified task.
   */
  update: (id: string, data: Partial<Task>): Promise<Task> =>
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
  delete: (id: string): Promise<void> =>
    fetch(`${API_BASE}/tasks/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Moves a task to the archive.
   * @param {string} id - Task ID.
   * @returns {Promise<Task>} The archived task.
   */
  archive: (id: string): Promise<Task> =>
    fetch(`${API_BASE}/tasks/${id}/archive`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Retrieves all archived tasks.
   * @returns {Promise<Task[]>} List of archived tasks.
   */
  getArchived: (): Promise<Task[]> =>
    fetch(`${API_BASE}/tasks/archived`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Transitions a task to a new status.
   * @param {string} id - Task ID.
   * @param {string} status - New status code.
   * @returns {Promise<Task>} Updated task state.
   */
  updateStatus: (id: string, status: string): Promise<Task> =>
    fetch(`${API_BASE}/tasks/${id}/status?status=${status}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Fetches all pending task requests waiting for review.
   * @returns {Promise<Task[]>} List of task requests.
   */
  getTaskRequests: (): Promise<Task[]> =>
    fetch(`${API_BASE}/tasks/requests`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Rejects a task request.
   * @param {string} id - Task ID.
   * @returns {Promise<Task>} Rejected task state.
   */
  rejectTask: (id: string): Promise<Task> =>
    fetch(`${API_BASE}/tasks/${id}/reject`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Verification if the current user has permission to edit a task.
   * @param {string} id - Task ID.
   * @returns {Promise<{canEdit: boolean}>}
   */
  canEdit: (id: string): Promise<{ canEdit: boolean }> =>
    fetch(`${API_BASE}/tasks/${id}/can-edit`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Verification if the current user has permission to delete a task.
   * @param {string} id - Task ID.
   * @returns {Promise<{canDelete: boolean}>}
   */
  canDelete: (id: string): Promise<{ canDelete: boolean }> =>
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
   * @returns {Promise<TaskComment[]>} List of comment objects.
   */
  getByTask: (taskId: string): Promise<TaskComment[]> =>
    fetch(`${API_BASE}/tasks/comments/task/${taskId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Posts a new comment to a task.
   * @param {Object} data - Comment payload containing text and taskId.
   * @returns {Promise<TaskComment>} The created comment.
   */
  create: (data: Partial<TaskComment>): Promise<TaskComment> =>
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
  delete: (id: string): Promise<void> =>
    fetch(`${API_BASE}/tasks/comments/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Gets the total count of comments for a task.
   * @param {string} taskId - Task ID.
   * @returns {Promise<number>} Total comment count.
   */
  getCount: (taskId: string): Promise<number> =>
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
   * @returns {Promise<TaskAuditLog[]>} List of historical events.
   */
  getHistory: (taskId: string): Promise<TaskAuditLog[]> =>
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
   * @returns {Promise<TaskTimeEntry>} Log entry.
   */
  logTime: (data: Record<string, unknown>): Promise<TaskTimeEntry> =>
    fetch(`${API_BASE}/tasks/time`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Retrieves all time logs for a task.
   * @param {string} taskId - Task ID.
   * @returns {Promise<TaskTimeEntry[]>} Time tracking entries.
   */
  getByTask: (taskId: string): Promise<TaskTimeEntry[]> =>
    fetch(`${API_BASE}/tasks/time/task/${taskId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Calculates total hours logged for a task.
   * @param {string} taskId - Task ID.
   * @returns {Promise<number>} Cumulative hours.
   */
  getTotalHours: (taskId: string): Promise<number> =>
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
   * @returns {Promise<Employee[]>} Employee records.
   */
  getAll: (): Promise<Employee[]> =>
    fetch(`${API_BASE}/employees`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Gets specific employee data by UUID.
   * @param {string} id - Employee ID.
   * @returns {Promise<Employee>} Employee profile.
   */
  getById: (id: string): Promise<Employee> =>
    fetch(`${API_BASE}/employees/${id}`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Finds the employee profile associated with a specific user account.
   * @param {string} userId - User UUID.
   * @returns {Promise<Employee>} Employee record.
   */
  getByUserId: (userId: string): Promise<Employee> =>
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
   * @returns {Promise<PaginatedResponse<Employee>>} Paginated employee data.
   */
  getAllPaginated: (
    page = 0,
    size = 20,
    sortBy = "firstName",
    sortDir = "asc",
    filters: Record<string, any> = {},
  ): Promise<PaginatedResponse<Employee>> => {
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
    if (filters.role) {
      params.append("role", filters.role);
    }

    return fetch(`${API_BASE}/employees/paginated?${params}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse);
  },

  /**
   * Creates a new employee profile.
   * @param {Object} data - Profile data.
   * @returns {Promise<Employee>} Created record.
   */
  create: (data: Partial<Employee>): Promise<Employee> =>
    fetch(`${API_BASE}/employees`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Updates an existing employee profile.
   * @param {string} id - Employee ID.
   * @param {Object} data - Fields to update.
   * @returns {Promise<Employee>} Updated profile.
   */
  update: (id: string, data: Partial<Employee>): Promise<Employee> =>
    fetch(`${API_BASE}/employees/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Fetches the technical skills associated with an employee.
   * @param {string} id - Employee ID.
   * @returns {Promise<any[]>} List of skill names/objects.
   */
  getSkills: async (id: string): Promise<any[]> => {
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
   * Retrieves all manager-role employees for the current company.
   * @returns {Promise<Employee[]>} Manager employee records.
   */
  getManagers: (): Promise<Employee[]> =>
    fetch(`${API_BASE}/employees/managers`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Retrieves workload statistics for all employees.
   * @returns {Promise<WorkloadData[]>} Workload metrics.
   */
  getWorkload: (): Promise<WorkloadData[]> =>
    fetch(`${API_BASE}/employees/workload`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Retrieves workload statistics per department.
   * @returns {Promise<any[]>} Department Workload metrics.
   */
  getDepartmentWorkloads: (): Promise<any[]> =>
    fetch(`${API_BASE}/employees/workload/departments`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Retrieves all distinct employee positions for the current company.
   * Used to populate the position filter dropdown dynamically.
   * @returns {Promise<string[]>} Sorted list of position strings.
   */
  getPositions: (): Promise<string[]> =>
    fetch(`${API_BASE}/employees/positions`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),
};

// Departments
/** @namespace departmentsAPI */
export const departmentsAPI = {
  /**
   * List all organizational departments.
   * @returns {Promise<Department[]>}
   */
  getAll: (): Promise<Department[]> =>
    fetch(`${API_BASE}/departments`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Find department by its name indicator.
   * @param {string} name - Department name.
   * @returns {Promise<Department>}
   */
  getByName: (name: string): Promise<Department> =>
    fetch(`${API_BASE}/departments/${encodeURIComponent(name)}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Simpler list of department names.
   * @returns {Promise<string[]>}
   */
  getDepartmentNames: (): Promise<string[]> =>
    fetch(`${API_BASE}/departments/list`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /**
   * Registers a new department.
   * @param {Object} data - Department information.
   * @returns {Promise<Department>}
   */
  create: (data: Partial<Department>): Promise<Department> =>
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
  delete: (name: string): Promise<void> =>
    fetch(`${API_BASE}/departments/${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then((response) => {
      if (!response.ok) throw new Error("Failed to delete department");
    }),

  /**
   * Toggles developer/git info access for a department.
   */
  toggleDevInfo: (name: string, enabled: boolean): Promise<Department> =>
    fetch(`${API_BASE}/departments/${encodeURIComponent(name)}/toggle-dev-info?enabled=${enabled}`, {
      method: "PUT",
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

// Teams
/** @namespace teamsAPI */
export const teamsAPI = {
  /** Retrieves all defined teams. */
  getAll: (): Promise<Team[]> =>
    fetch(`${API_BASE}/teams`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /** Retrieves teams where the current user is a member. */
  getMyTeams: (): Promise<Team[]> =>
    fetch(`${API_BASE}/teams/my-teams`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /** Detail for a single team. */
  getById: (id: string): Promise<Team> =>
    fetch(`${API_BASE}/teams/${id}`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /** Paginated team list with optional sorting. */
  getAllPaginated: (
    page = 0,
    size = 20,
    sortBy = "name",
    sortDir = "asc",
    filters: Record<string, any> = {},
  ): Promise<PaginatedResponse<Team>> => {
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
  create: (data: Partial<Team>): Promise<Team> =>
    fetch(`${API_BASE}/teams`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Remove a team. */
  delete: (id: string): Promise<any> =>
    fetch(`${API_BASE}/teams/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then((response) => {
      if (!response.ok) throw new Error("Failed to delete team");
      return {};
    }),

  /**
   * Updates an existing team's name and description.
   * @param {string} id - Team ID.
   * @param {Object} data - Updated team fields.
   * @returns {Promise<Team>} Updated team record.
   */
  update: (id: string, data: Partial<{ name: string; description: string }>): Promise<any> =>
    fetch(`${API_BASE}/teams/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),
};

// Assignments
/** @namespace assignmentsAPI */
export const assignmentsAPI = {
  /** List assignments for a specific employee. */
  getByEmployee: (id: string): Promise<TaskAssignment[]> =>
    fetch(`${API_BASE}/assignments/employee/${id}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** List assignments tied to a specific task. */
  getByTask: (id: string): Promise<TaskAssignment[]> =>
    fetch(`${API_BASE}/assignments/task/${id}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Manually creates an employee-to-task assignment.
   * @param {Object} data - { taskId, employeeId, notes, ... }.
   * @returns {Promise<TaskAssignment>} The assignment record.
   */
  create: (data: Record<string, any>): Promise<TaskAssignment> => {
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
  accept: (id: string): Promise<TaskAssignment> =>
    fetch(`${API_BASE}/assignments/${id}/accept`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

// Notifications
/** @namespace notificationsAPI */
export const notificationsAPI = {
  /** Fetch notification history. */
  getByUser: (userId: string): Promise<AppNotification[]> =>
    fetch(`${API_BASE}/notifications/user/${userId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Only unread notifications. */
  getUnread: (userId: string): Promise<AppNotification[]> =>
    fetch(`${API_BASE}/notifications/user/${userId}/unread`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Mark single notification as read. */
  markAsRead: (id: string): Promise<AppNotification> =>
    fetch(`${API_BASE}/notifications/${id}/read`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Clear all notifications as read. */
  markAllAsRead: (userId: string): Promise<void> =>
    fetch(`${API_BASE}/notifications/user/${userId}/read-all`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then((response) => {
      if (!response.ok) throw new Error("Failed to mark all as read");
    }),

  /** Trigger a system notification manually. */
  create: (data: Record<string, any>): Promise<AppNotification> =>
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
  sendMessage: (data: Record<string, unknown>): Promise<any> =>
    fetch(`${API_BASE}/chat/send`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Fetch message history for a team room. */
  getTeamMessages: (teamId: string): Promise<any[]> =>
    fetch(`${API_BASE}/chat/team/${teamId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** 1-to-1 conversation history. */
  getDirectMessages: (otherUserId: string): Promise<any[]> =>
    fetch(`${API_BASE}/chat/direct/${otherUserId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Aggregate unread message counts. */
  getUnreadCount: (): Promise<{ count: number }> =>
    fetch(`${API_BASE}/chat/unread/count`, { headers: getAuthHeaders() }).then(
      handleResponse,
    ),

  /** Mark message as viewed. */
  markAsRead: (id: string): Promise<any> =>
    fetch(`${API_BASE}/chat/${id}/read`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  editMessage: (id: string, message: string): Promise<any> =>
    fetch(`${API_BASE}/chat/messages/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ message }),
    }).then(handleResponse),

  deleteMessage: (id: string): Promise<any> =>
    fetch(`${API_BASE}/chat/messages/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Unread per-contact grouping. */
  getUnreadCountPerContact: (): Promise<Record<string, number>> =>
    fetch(`${API_BASE}/chat/unread/per-contact`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** List of users available for chat. */
  getAvailableContacts: (): Promise<User[]> =>
    fetch(`${API_BASE}/chat/contacts`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** List of recent conversation threads. */
  getConversations: (): Promise<any[]> =>
    fetch(`${API_BASE}/chat/conversations`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** List of team-based chat rooms. */
  getUserTeamChats: (): Promise<Team[]> =>
    fetch(`${API_BASE}/chat/teams`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Clears all unread badges for the user. */
  markAllAsRead: (): Promise<any> =>
    fetch(`${API_BASE}/chat/read-all`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

// Skills
/** @namespace skillsAPI */
export const skillsAPI = {
  /** Global catalog of technical skills. */
  getAll: (): Promise<Skill[]> =>
    fetch(`${API_BASE}/skills`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Unique skill record. */
  getById: (id: string): Promise<Skill> =>
    fetch(`${API_BASE}/skills/${id}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Retrieve skill by exact name match. */
  getByName: (name: string): Promise<Skill> =>
    fetch(`${API_BASE}/skills/name/${encodeURIComponent(name)}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Skills grouped by domain category (e.g. 'Frontend'). */
  getByCategory: (category: string): Promise<Skill[]> =>
    fetch(`${API_BASE}/skills/category/${encodeURIComponent(category)}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Add a new skill to the taxonomy. */
  create: (data: Partial<Skill>): Promise<Skill> =>
    fetch(`${API_BASE}/skills`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Update skill metadata. */
  update: (id: string, data: Partial<Skill>): Promise<Skill> =>
    fetch(`${API_BASE}/skills/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Delete skill. */
  delete: (id: string): Promise<void> =>
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
   * @returns {Promise<AIAssignmentResponse>} Suggestions with fit scores and reasoning.
   */
  getAssignmentSuggestions: (data: Record<string, unknown>): Promise<AIAssignmentResponse> =>
    fetch(`${API_BASE}/ai/assignments/suggest`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Predicts completion time for a task based on historical performance.
   * @param {Object} data - { taskId, priority, complexityScore, requiredSkillIds }.
   * @returns {Promise<DurationPrediction>} Estimation with confidence intervals.
   */
  predictDuration: (data: Record<string, unknown>): Promise<DurationPrediction> =>
    fetch(`${API_BASE}/ai/prediction/duration`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /**
   * Efficiently fetches skills for multiple employees in one request.
   * @param {Array<string>} employeeIds - UUID collection.
   * @returns {Promise<Record<string, Skill[]>>} Mapping of employee ID to skill list.
   */
  getEmployeeSkillsBatch: (employeeIds: string[]): Promise<Record<string, Skill[]>> => {
    const params = new URLSearchParams();
    employeeIds.forEach((id: string) => params.append("employeeIds", id));
    params.append("format", "simple");

    return fetch(`${API_BASE}/employees/skills/batch?${params}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse);
  },

  /**
   * Fetches required skills for a batch of tasks.
   * @param {Array<string>} taskIds - UUID collection.
   * @returns {Promise<Record<string, Skill[]>>} Mapping of task ID to requirements.
   */
  getTaskSkillsBatch: (taskIds: string[]): Promise<Record<string, Skill[]>> => {
    const params = new URLSearchParams();
    taskIds.forEach((id: string) => params.append("taskIds", id));

    return fetch(`${API_BASE}/tasks/required-skills/batch?${params}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse);
  },

  /**
   * Detects outliers or issues in task distribution and hours.
   * @param {Object} data - { entityType, entityId }.
   * @param {boolean} [bustCache=false] - Force bypass of server-side cache.
   * @returns {Promise<{results: any[]}>} List of flags and anomalies.
   */
  detectAnomalies: (data: Record<string, unknown>, bustCache: boolean = false): Promise<{ results: any[] }> => {
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
   * @returns {Promise<any>} Aggregated analytics object.
   */
  getProductivityAnalytics: (timePeriodDays: number = 30, bustCache: boolean = false): Promise<any> => {
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
   * @returns {Promise<any>} Global assignment plan.
   */
  bulkOptimize: (data: Record<string, unknown>): Promise<any> =>
    fetch(`${API_BASE}/ai/assignments/bulk-optimize`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Alternate load-balanced optimization endpoint. */
  bulkOptimizeBalanced: (taskIds: string[], companyId: string): Promise<any> =>
    fetch(`${API_BASE}/api/ai/assignment/bulk-optimize-balanced`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "X-Company-Id": companyId,
      },
      body: JSON.stringify({
        task_ids: taskIds,
        optimize_workload: true,
      }),
    }).then(handleResponse),

  /** Triggers model retraining based on user feedback and new data. */
  triggerRetraining: (fullRetrain: boolean = false): Promise<any> =>
    fetch(`${API_BASE}/ai/feedback/retrain?fullRetrain=${fullRetrain}`, {
      method: "POST",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Fetches metadata about currently deployed ML models. */
  getModelInfo: (): Promise<any> =>
    fetch(`${API_BASE}/ai/feedback/model-info`, {
      method: "GET",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** NLP-based skill extraction from task text. */
  extractSkillsFromText: (data: Record<string, unknown>): Promise<SkillExtractionResponse> =>
    fetch(`${API_BASE}/ai/skills/extract`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Analyzes linguistic patterns to determine task complexity. */
  analyzeTaskComplexity: (data: Record<string, unknown>): Promise<ComplexityAnalysis> =>
    fetch(`${API_BASE}/ai/task-analysis/analyze`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Ranks tasks by AI priority signals. */
  prioritizeBacklog: (tasks: Record<string, unknown>[]): Promise<any> =>
    fetch(`${API_BASE}/ai/task-analysis/prioritize-backlog`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(tasks),
    }).then(handleResponse),

  /** Recommends missing skills for a team based on assigned tasks. */
  suggestTeamSkills: (data: Record<string, unknown>): Promise<any> =>
    fetch(`${API_BASE}/ai/skills/suggest-for-team`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Retrieves categories detected by AI in the skill catalog. */
  getSkillCategories: (): Promise<string[]> =>
    fetch(`${API_BASE}/ai/skills/categories`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Batch NLP extraction for multiple task items. */
  batchExtractSkills: (tasks: Record<string, unknown>[]): Promise<any> =>
    fetch(`${API_BASE}/ai/skills/batch-extract`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(tasks),
    }).then(handleResponse),
};

// Companies
/** @namespace companiesAPI */
export const companiesAPI = {
  /** Returns the company of the currently logged-in user (includes joinCode for admins). */
  getMyCompany: (): Promise<Company> =>
    fetch(`${API_BASE}/companies/my-company`, { headers: getAuthHeaders() }).then(handleResponse),

  /** Regenerate the join code for a company (admin only). */
  regenerateJoinCode: (companyId: string): Promise<Company> =>
    fetch(`${API_BASE}/companies/${companyId}/regenerate-code`, {
      method: 'POST',
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

// Company Blocklist
/**
 * Per-company email blocklist API (admin/manager only).
 * @namespace blocklistAPI
 */
export const blocklistAPI = {
  /** Fetch all blocked emails for current company. */
  getAll: (): Promise<any[]> =>
    fetch(`${API_BASE}/blocklist`, { headers: getAuthHeaders() }).then(handleResponse),

  /** Block an email address. */
  block: (email: string): Promise<any> =>
    fetch(`${API_BASE}/blocklist`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email }),
    }).then(handleResponse),

  /** Remove a block by entry ID. */
  unblock: (id: string): Promise<void> =>
    fetch(`${API_BASE}/blocklist/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
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
   * @returns {Promise<ChatbotResponse>} Chatbot response and suggested actions.
   */
  query: (data: Record<string, unknown>): Promise<ChatbotResponse> =>
    fetch(`${API_BASE}/ai/chatbot/query`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  /** Verification of chatbot engine availability. */
  health: (): Promise<{ status: string }> =>
    fetch(`${API_BASE}/ai/chatbot/health`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /** Admin trigger to download/update specific LLM models. */
  pullModel: (modelName: string = "phi3"): Promise<any> =>
    fetch(`${API_BASE}/ai/chatbot/pull-model?model_name=${modelName}`, {
      method: "POST",
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

// Task Attachments
/**
 * API for managing task attachments/files.
 * @namespace taskAttachmentsAPI
 */
export const taskAttachmentsAPI = {
  /**
   * Retrieves all attachments metadata for a given task.
   * @param {string} taskId - Target task UUID.
   * @returns {Promise<any[]>} List of attachment objects.
   */
  getByTask: (taskId: string): Promise<any[]> =>
    fetch(`${API_BASE}/tasks/attachments/task/${taskId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Uploads a new attachment file to a task.
   * @param {string} taskId - Target task UUID.
   * @param {File} file - The file to upload.
   * @returns {Promise<any>} The created attachment object.
   */
  upload: (taskId: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("taskId", taskId);
    formData.append("file", file);

    const headers = getAuthHeaders();
    delete headers["Content-Type"];

    return fetch(`${API_BASE}/tasks/attachments`, {
      method: "POST",
      headers,
      body: formData,
    }).then(handleResponse);
  },

  /**
   * Removes a specific attachment.
   * @param {string} id - Attachment ID.
   * @returns {Promise<void>}
   */
  delete: (id: string): Promise<void> =>
    fetch(`${API_BASE}/tasks/attachments/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),

  /**
   * Downloads an attachment file from the server.
   * @param {string} id - Attachment ID.
   * @param {string} filename - The file name to save as.
   */
  download: async (id: string, filename: string): Promise<void> => {
    const headers = getAuthHeaders();
    const response = await fetch(`${API_BASE}/tasks/attachments/${id}/download`, {
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};
