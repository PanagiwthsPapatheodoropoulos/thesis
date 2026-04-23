/**
 * @fileoverview TaskDetailsModal - Full-featured task detail viewer / action panel.
 *
 * Renders a tabbed modal dialog for a single task, providing:
 * - **Details** tab: description, metadata, assigned employees, and time summaries.
 * - **Comments** tab: threaded comment list with add/delete support.
 * - **Time** tab: time-entry log form and cumulative hours vs. estimate comparison.
 * - **History** tab: chronological audit log of all task changes.
 *
 * Subscribes to WebSocket events so the panel updates in real time when another
 * user modifies the task while the modal is open.
 * Status transitions (Start, Complete, Block, Resume) are available via header buttons.
 */
// src/components/TaskDetailsModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Clock, User, Calendar, AlertCircle, MessageSquare, 
  History, Send, Trash2, CheckCircle, XCircle, PlayCircle,
  PauseCircle, Flag, Users, Plus
} from 'lucide-react';
import { tasksAPI, taskCommentsAPI, taskTimeAPI, employeesAPI,taskAuditAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
// FIX: Removed EVENT_TYPES from import to break circular dependency
import { useWebSocket } from '../contexts/WebSocketProvider';
import type { TaskDetailsModalProps, Task, TaskAssignment, Employee } from '../types';

// FIX: Define event types locally to avoid the ReferenceError
const TASK_EVENTS = {
    TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
    TASK_UPDATED: 'TASK_UPDATED',
    TASK_COMMENT_ADDED: 'TASK_COMMENT_ADDED', // Ensure this matches your backend event name
    ASSIGNMENT_UPDATED: 'ASSIGNMENT_UPDATED'
};

/**
 * Modal component displaying detailed information and actions for a single task.
 *
 * @component
 * @param {Object}   props             - Component props.
 * @param {Object}   props.task        - The task object to display.
 * @param {boolean}  props.isOpen      - Whether the modal is currently visible.
 * @param {Function} props.onClose     - Callback invoked when the modal should close.
 * @param {Function} [props.onTaskUpdate] - Optional callback invoked after a task status change
 *                                         so the parent list can refresh.
 * @returns {JSX.Element|null} The rendered modal, or null when {@code isOpen} is false.
 */
const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({ task, isOpen, onClose, onTaskUpdate }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('details');
    const { connected, subscribe } = useWebSocket();
    const [taskData, setTaskData] = useState(task);
    const [comments, setComments] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const { darkMode } = useTheme();
    const [timeEntries, setTimeEntries] = useState<any[]>([]);
    const [newComment, setNewComment] = useState<string>('');
    const [newTimeEntry, setNewTimeEntry] = useState({
        hoursSpent: '',
        workDate: new Date().toISOString().split('T')[0],
        description: ''
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [totalHours, setTotalHours] = useState<number>(0);
    const commentsEndRef = useRef<any>(null);

    // Sync task prop to state when it changes
    useEffect(() => {
        if (task) {
            setTaskData(task);
        }
    }, [task]);

    // Fetch details when modal opens
    useEffect(() => {
        if (isOpen && task?.id) {
            fetchTaskDetails();
        }
    }, [isOpen, task?.id]);

    // WebSocket Subscriptions
    useEffect(() => {
        if (!isOpen || !task?.id || !connected) return;

        const handleTaskUpdate = (data) => {
            // Check if the update is for the current task
            // Handle potentially different payload structures
            const updatedTaskId = data.task?.id || data.taskId || data.id;
            
            if (updatedTaskId === task.id) {
                fetchTaskDetails(); 
                
                // If it was a status change, notify parent to update list
                if (onTaskUpdate) onTaskUpdate?.(undefined as any);
            }
        };

        // Subscribe using LOCAL constants
        const unsubs = [
            subscribe(TASK_EVENTS.TASK_STATUS_CHANGED, handleTaskUpdate),
            subscribe(TASK_EVENTS.TASK_UPDATED, handleTaskUpdate),
            subscribe(TASK_EVENTS.TASK_COMMENT_ADDED, handleTaskUpdate),
            subscribe(TASK_EVENTS.ASSIGNMENT_UPDATED, handleTaskUpdate)
        ];

        return () => unsubs.forEach(fn => fn && fn());
    }, [isOpen, task?.id, connected, subscribe]);

    /**
     * Fetches all task sub-resources (details, comments, audit logs, time entries)
     * in parallel via Promise.all to minimise latency.
     * Only shows the loading spinner on the very first load to prevent UI flicker
     * on real-time WebSocket updates.
     */
    const fetchTaskDetails = async () => {
        try {
            // Only set loading on first load or manual refresh, not RT updates to prevent flicker
            if (!taskData.description) setLoading(true); 

            // Parallel fetch for better performance
            const [fetchedTask, fetchedComments, fetchedLogs, fetchedTime] = await Promise.all([
                tasksAPI.getById(task.id),
                taskCommentsAPI.getByTask(task.id).catch(() => []),
                taskAuditAPI.getHistory ? taskAuditAPI.getHistory(task.id).catch(() => []) : [], 
                taskTimeAPI.getByTask(task.id).catch(() => [])
            ]);

            setTaskData(fetchedTask);
            setComments(fetchedComments);
            setAuditLogs(fetchedLogs);
            setTimeEntries(fetchedTime);

            // Calculate total hours
            const total = fetchedTime.reduce((acc, entry) => acc + (parseFloat(entry.hoursSpent) || 0), 0);
            setTotalHours(total);

        } catch (error: any) {
            console.error("Error fetching task details:", error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Submits a new comment for the current task.
     * Clears the comment input and refreshes details on success.
     *
     * @param {React.FormEvent} e - The form submit event.
     */
    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            await taskCommentsAPI.create({
                taskId: task.id,
                comment: newComment
            });
            
            setNewComment('');
            await fetchTaskDetails();
        } catch (error: any) {
            alert('Error adding comment: ' + error.message);
        }
    };

    /**
     * Deletes a comment after user confirmation.
     *
     * @param {string} commentId - The UUID of the comment to delete.
     */
    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('Delete this comment?')) return;

        try {
            await taskCommentsAPI.delete(commentId);
            await fetchTaskDetails();
        } catch (error: any) {
            alert('Error deleting comment: ' + error.message);
        }
    };

    /**
     * Logs a time entry for the current task.
     * Verifies that the user has an employee profile before calling the API.
     * Resets the form and refreshes details on success.
     *
     * @param {React.FormEvent} e - The form submit event.
     */
    const handleAddTimeEntry = async (e) => {
        e.preventDefault();
        if (!newTimeEntry.hoursSpent || parseFloat(newTimeEntry.hoursSpent) <= 0) {
            alert('Please enter valid hours');
            return;
        }

        try {
            // Check employee profile existence
            try {
                await employeesAPI.getByUserId(user.id);
            } catch (error: any) {
                alert('You need an employee profile to log time. Contact an administrator.');
                return;
            }

            await taskTimeAPI.logTime({
                taskId: task.id,
                hoursSpent: parseFloat(newTimeEntry.hoursSpent),
                workDate: new Date(newTimeEntry.workDate).toISOString(),
                description: newTimeEntry.description
            });
            
            setNewTimeEntry({
                hoursSpent: '',
                workDate: new Date().toISOString().split('T')[0],
                description: ''
            });
            
            await fetchTaskDetails();
        } catch (error: any) {
            alert('Error logging time: ' + error.message);
        }
    };

    /**
     * Updates the task's status via the tasks API and notifies the parent.
     *
     * @param {string} newStatus - The target status string (e.g. "IN_PROGRESS", "COMPLETED").
     */
    const handleStatusChange = async (newStatus) => {
        try {
            await tasksAPI.updateStatus(task.id, newStatus);
            await fetchTaskDetails();

            if (onTaskUpdate) onTaskUpdate?.(undefined as any);
        
        } catch (error: any) {
            alert('Error updating status: ' + error.message);
        }
    };

    /**
     * Returns CSS class string for a priority badge based on the priority level.
     *
     * @param {string} priority - Task priority ("LOW", "MEDIUM", "HIGH", "CRITICAL").
     * @returns {string} Tailwind CSS classes for the priority badge.
     */
    const getPriorityColor = (priority) => {
        const colors = {
            LOW: 'bg-green-100 text-green-800 border-green-300',
            MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
            CRITICAL: 'bg-red-100 text-red-800 border-red-300'
        };
        return colors[priority] || 'bg-gray-100 text-gray-800';
    };

    /**
     * Returns CSS class string for a status badge based on the task status.
     *
     * @param {string} status - Task status ("PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED", "CANCELLED").
     * @returns {string} Tailwind CSS classes for the status badge.
     */
    const getStatusColor = (status) => {
        const colors = {
            PENDING: 'bg-gray-100 text-gray-800',
            IN_PROGRESS: 'bg-blue-100 text-blue-800',
            COMPLETED: 'bg-green-100 text-green-800',
            BLOCKED: 'bg-red-100 text-red-800',
            CANCELLED: 'bg-gray-400 text-gray-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    /**
     * Formats an ISO date string into a localised date-time string.
     *
     * @param {string|null} dateString - An ISO 8601 date string, or null/undefined.
     * @returns {string} A formatted date-time string, or 'N/A' if the input is falsy.
     */
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };

    const canManageTask = user?.role === 'ADMIN' || user?.role === 'MANAGER' ||
    taskData?.createdBy === user?.id;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
            <div className={`rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col scale-in shadow-2xl ${
                darkMode ? 'bg-gray-800 text-gray-100 border-2 border-gray-700' : 'bg-white text-gray-900'
            }`}>

                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${
                    darkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                    <div className="flex-1 pr-4">
                        <h2 className={`text-2xl font-bold mb-2 ${
                            darkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                            {taskData?.title?.replace("[REQUEST] ", "")}
                        </h2>

                        <div className="flex items-center gap-3 flex-wrap">
                            <span
                                className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                    taskData?.status
                                )}`}
                            >
                                {taskData?.status}
                            </span>
                            <span
                                className={`px-3 py-1 text-xs font-semibold rounded-full border-2 ${getPriorityColor(
                                    taskData?.priority
                                )}`}
                            >
                                <Flag className="w-3 h-3 inline mr-1" />
                                {taskData?.priority}
                            </span>
                            {taskData?.teamName && (
                                <span className="px-3 py-1 text-xs rounded-full bg-indigo-100 text-indigo-800">
                                    <Users className="w-3 h-3 inline mr-1" />
                                    {taskData.teamName}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        {taskData?.status === "PENDING" && (
                            <button
                                onClick={() => handleStatusChange("IN_PROGRESS")}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm"
                            >
                                <PlayCircle className="w-4 h-4" />
                                Start
                            </button>
                        )}

                        {taskData?.status === "IN_PROGRESS" && (
                            <>
                                <button
                                    onClick={() => handleStatusChange("COMPLETED")}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Complete
                                </button>
                                <button
                                    onClick={() => handleStatusChange("BLOCKED")}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2 text-sm"
                                >
                                    <PauseCircle className="w-4 h-4" />
                                    Block
                                </button>
                            </>
                        )}

                        {taskData?.status === "BLOCKED" && (
                            <button
                                onClick={() => handleStatusChange("IN_PROGRESS")}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm"
                            >
                                <PlayCircle className="w-4 h-4" />
                                Resume
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className={`p-2 rounded-lg transition ${
                                darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                            }`}
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className={`flex border-b px-6 ${
                    darkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                    {["details", "comments", "time", "history"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-3 font-medium text-sm transition relative ${
                                activeTab === tab
                                    ? darkMode
                                        ? 'text-indigo-300 border-b-2 border-indigo-400 bg-gray-700/50'
                                        : 'text-indigo-600 border-b-2 border-indigo-600'
                                    : darkMode
                                        ? 'text-gray-400 hover:text-gray-200'
                                        : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            {tab === "details" && <AlertCircle className="w-4 h-4 inline mr-1" />}
                            {tab === "comments" && <MessageSquare className="w-4 h-4 inline mr-1" />}
                            {tab === "time" && <Clock className="w-4 h-4 inline mr-1" />}
                            {tab === "history" && <History className="w-4 h-4 inline mr-1" />}
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            {tab === "comments" && comments.length > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                                    {comments.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
                        </div>
                    ) : (
                        <>
                            {/* DETAILS TAB */}
                            {activeTab === "details" && (
                                <div className="space-y-6">
                                    {taskData?.description && (
                                        <div>
                                            <h3 className={`font-semibold mb-2 ${
                                                darkMode ? 'text-gray-100' : 'text-gray-900'
                                            }`}>Description</h3>
                                            <p className={`whitespace-pre-wrap p-4 rounded-lg ${
                                                darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-50 text-gray-700'
                                            }`}>
                                                {taskData.description}
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className={`p-4 rounded-lg ${
                                            darkMode ? 'bg-gray-700' : 'bg-gray-50'
                                        }`}>
                                            <div className={`flex items-center gap-2 text-sm mb-1 ${
                                                darkMode ? 'text-gray-400' : 'text-gray-600'
                                            }`}>
                                                <User className="w-4 h-4" />
                                                <span>Created By</span>
                                            </div>
                                            <p className={`font-medium ${
                                                darkMode ? 'text-gray-100' : 'text-gray-900'
                                            }`}>
                                                {taskData?.createdByName || "Unknown"}
                                            </p>
                                        </div>

                                        <div className={`p-4 rounded-lg ${
                                            darkMode ? 'bg-gray-700' : 'bg-gray-50'
                                        }`}>
                                            <div className={`flex items-center gap-2 text-sm mb-1 ${
                                                darkMode ? 'text-gray-400' : 'text-gray-600'
                                            }`}>
                                                <Calendar className="w-4 h-4" />
                                                <span>Due Date</span>
                                            </div>
                                            <p className={`font-medium ${
                                                darkMode ? 'text-gray-100' : 'text-gray-900'
                                            }`}>
                                                {formatDate(taskData?.dueDate)}
                                            </p>
                                        </div>

                                        {taskData?.completedDate && (
                                            <div className={`p-4 rounded-lg ${
                                                darkMode ? 'bg-green-900/20' : 'bg-green-50'
                                            }`}>
                                                <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
                                                    <CheckCircle className="w-4 h-4" />
                                                    <span>Completed At</span>
                                                </div>
                                                <p className={`font-medium ${
                                                    darkMode ? 'text-green-400' : 'text-green-900'
                                                }`}>
                                                    {formatDate(taskData.completedDate)}
                                                </p>
                                            </div>
                                        )}

                                        {Number(taskData?.estimatedHours || 0) && (
                                            <div className={`p-4 rounded-lg ${
                                                darkMode ? 'bg-blue-900/20' : 'bg-blue-50'
                                            }`}>
                                                <div className="flex items-center gap-2 text-sm text-blue-600 mb-1">
                                                    <Clock className="w-4 h-4" />
                                                    <span>Estimated Hours</span>
                                                </div>
                                                <p className={`font-medium ${
                                                    darkMode ? 'text-blue-400' : 'text-blue-900'
                                                }`}>
                                                    {taskData.estimatedHours}h
                                                </p>
                                            </div>
                                        )}

                                        {totalHours > 0 && (
                                            <div className={`p-4 rounded-lg ${
                                                darkMode ? 'bg-purple-900/20' : 'bg-purple-50'
                                            }`}>
                                                <div className="flex items-center gap-2 text-sm text-purple-600 mb-1">
                                                    <Clock className="w-4 h-4" />
                                                    <span>Actual Hours</span>
                                                </div>
                                                <p className={`font-medium ${
                                                    darkMode ? 'text-purple-400' : 'text-purple-900'
                                                }`}>{totalHours}h</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Assignments */}
                                    {taskData?.assignments && taskData.assignments.length > 0 && (
                                        <div>
                                            <h3 className={`font-semibold mb-3 ${
                                                darkMode ? 'text-gray-100' : 'text-gray-900'
                                            }`}>Assignments</h3>
                                            <div className="space-y-2">
                                                {taskData.assignments.map((assignment) => (
                                                    <div
                                                        key={assignment.id}
                                                        className={`flex items-center justify-between p-3 rounded-lg ${
                                                            darkMode ? 'bg-gray-700' : 'bg-gray-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                                                {assignment.employeeName?.[0]}
                                                            </div>
                                                            <div>
                                                                <p className={`font-medium ${
                                                                    darkMode ? 'text-gray-100' : 'text-gray-900'
                                                                }`}>
                                                                    {assignment.employeeName}
                                                                </p>
                                                                <p className={`text-sm ${
                                                                    darkMode ? 'text-gray-400' : 'text-gray-600'
                                                                }`}>
                                                                    {assignment.assignedBy} Assignment
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span
                                                            className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                                                assignment.status === "ACCEPTED"
                                                                    ? "bg-green-100 text-green-800"
                                                                    : assignment.status === "PENDING"
                                                                    ? "bg-yellow-100 text-yellow-800"
                                                                    : "bg-red-100 text-red-800"
                                                            }`}
                                                        >
                                                            {assignment.status}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* COMMENTS TAB */}
                            {activeTab === "comments" && (
                                <div className="space-y-4">
                                    {/* Comment Form */}
                                    <form onSubmit={handleAddComment} className={`p-4 rounded-lg ${
                                        darkMode ? 'bg-gray-700' : 'bg-gray-50'
                                    }`}>
                                        <textarea
                                            value={newComment}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setNewComment(e.target.value)}
                                            placeholder="Add a comment..."
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none ${
                                                darkMode
                                                    ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400'
                                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                            }`}
                                            rows={3}
                                        />
                                        <div className="flex justify-end mt-2">
                                            <button
                                                type="submit"
                                                disabled={!newComment.trim()}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Send className="w-4 h-4" />
                                                Post Comment
                                            </button>
                                        </div>
                                    </form>

                                    {/* Comments List */}
                                    <div className="space-y-3">
                                        {comments.length > 0 ? (
                                            comments.map((comment) => {
                                                const canDeleteComment = 
                                                    (user?.role === 'ADMIN' || user?.role === 'MANAGER') || 
                                                    comment.userId === user?.id;
                                                
                                                return (
                                                    <div
                                                        key={comment.id}
                                                        className={`border rounded-lg p-4 ${
                                                            darkMode 
                                                                ? 'bg-gray-700 border-gray-600' 
                                                                : 'bg-white border-gray-200'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                                                                    {comment.userName?.[0] || "U"}
                                                                </div>
                                                                <div>
                                                                    <p className={`font-medium ${
                                                                        darkMode ? 'text-gray-100' : 'text-gray-900'
                                                                    }`}>
                                                                        {comment.userName}
                                                                    </p>
                                                                    <p className={`text-xs ${
                                                                        darkMode ? 'text-gray-400' : 'text-gray-500'
                                                                    }`}>
                                                                        {formatDate(comment.createdAt)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            {canDeleteComment && (
                                                                <button
                                                                    onClick={() => handleDeleteComment(comment.id)}
                                                                    className={`p-1 rounded transition ${
                                                                        darkMode
                                                                            ? 'text-red-400 hover:bg-red-900/20'
                                                                            : 'text-red-600 hover:bg-red-50'
                                                                    }`}
                                                                    title="Delete comment"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className={`whitespace-pre-wrap ${
                                                            darkMode ? 'text-gray-200' : 'text-gray-700'
                                                        }`}>
                                                            {comment.comment}
                                                        </p>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className={`text-center py-12 ${
                                                darkMode ? 'text-gray-400' : 'text-gray-500'
                                            }`}>
                                                <MessageSquare className={`w-12 h-12 mx-auto mb-2 ${
                                                    darkMode ? 'text-gray-600' : 'text-gray-300'
                                                }`} />
                                                <p>No comments yet. Be the first to comment!</p>
                                            </div>
                                        )}
                                        <div ref={commentsEndRef} />
                                    </div>
                                </div>
                            )}

                            {/* TIME TRACKING TAB */}
                            {activeTab === "time" && (
                                <div className="space-y-6">
                                    {/* Time Entry Form */}
                                    <div className={`p-4 rounded-lg ${
                                        darkMode ? 'bg-gray-700' : 'bg-gray-50'
                                    }`}>
                                        <h3 className={`font-semibold mb-4 ${
                                            darkMode ? 'text-gray-100' : 'text-gray-900'
                                        }`}>Log Time</h3>
                                        <form onSubmit={handleAddTimeEntry} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className={`block text-sm font-medium mb-1 ${
                                                        darkMode ? 'text-gray-300' : 'text-gray-700'
                                                    }`}>
                                                        Hours Spent *
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.25"
                                                        min="0.25"
                                                        value={newTimeEntry.hoursSpent}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
                                                            setNewTimeEntry({
                                                                ...newTimeEntry,
                                                                hoursSpent: e.target.value,
                                                            })
                                                        }
                                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                                                            darkMode
                                                                ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400'
                                                                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                                        }`}
                                                        placeholder="e.g., 2.5"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className={`block text-sm font-medium mb-1 ${
                                                        darkMode ? 'text-gray-300' : 'text-gray-700'
                                                    }`}>
                                                        Date *
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={newTimeEntry.workDate}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
                                                            setNewTimeEntry({
                                                                ...newTimeEntry,
                                                                workDate: e.target.value,
                                                            })
                                                        }
                                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                                                            darkMode
                                                                ? 'bg-gray-800 border-gray-600 text-gray-100'
                                                                : 'bg-white border-gray-300 text-gray-900'
                                                        }`}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={`block text-sm font-medium mb-1 ${
                                                    darkMode ? 'text-gray-300' : 'text-gray-700'
                                                }`}>
                                                    Description (Optional)
                                                </label>
                                                <textarea
                                                    value={newTimeEntry.description}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
                                                        setNewTimeEntry({
                                                            ...newTimeEntry,
                                                            description: e.target.value,
                                                        })
                                                    }
                                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none ${
                                                        darkMode
                                                            ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400'
                                                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                                    }`}
                                                    rows={2}
                                                    placeholder="What did you work on?"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Log Time
                                            </button>
                                        </form>
                                    </div>

                                    {/* Total Hours Summary */}
                                    <div className={`border-2 rounded-lg p-4 ${
                                        darkMode 
                                            ? 'bg-indigo-900/20 border-indigo-700'
                                            : 'bg-indigo-50 border-indigo-200'
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Clock className={`w-8 h-8 ${
                                                    darkMode ? 'text-indigo-400' : 'text-indigo-600'
                                                }`} />
                                                <div>
                                                    <p className={`text-sm font-medium ${
                                                        darkMode ? 'text-indigo-300' : 'text-indigo-700'
                                                    }`}>
                                                        Total Time Logged
                                                    </p>
                                                    <p className={`text-3xl font-bold ${
                                                        darkMode ? 'text-indigo-200' : 'text-indigo-900'
                                                    }`}>
                                                        {totalHours}h
                                                    </p>
                                                </div>
                                            </div>
                                            {Number(taskData?.estimatedHours || 0) && (
                                                <div className="text-right">
                                                    <p className={`text-sm font-medium ${
                                                        darkMode ? 'text-indigo-300' : 'text-indigo-700'
                                                    }`}>
                                                        Estimated
                                                    </p>
                                                    <p className={`text-xl font-bold ${
                                                        darkMode ? 'text-indigo-200' : 'text-indigo-900'
                                                    }`}>
                                                        {taskData.estimatedHours}h
                                                    </p>
                                                    <p
                                                        className={`text-xs font-semibold ${
                                                            totalHours > Number(taskData.estimatedHours)
                                                                ? darkMode ? "text-red-400" : "text-red-600"
                                                                : darkMode ? "text-green-400" : "text-green-600"
                                                        }`}
                                                    >
                                                        {totalHours > Number(taskData.estimatedHours)
                                                            ? `+${(totalHours - Number(taskData.estimatedHours)).toFixed(2)}h over`
                                                            : `${(Number(taskData.estimatedHours) - totalHours).toFixed(2)}h remaining`}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Time Entries List */}
                                    <div>
                                        <h3 className={`font-semibold mb-3 ${
                                            darkMode ? 'text-gray-100' : 'text-gray-900'
                                        }`}>Time Entries</h3>
                                        <div className="space-y-2">
                                            {timeEntries.length > 0 ? (
                                                timeEntries.map((entry) => (
                                                    <div
                                                        key={entry.id}
                                                        className={`flex items-center justify-between p-4 border rounded-lg ${
                                                            darkMode
                                                                ? 'bg-gray-700 border-gray-600'
                                                                : 'bg-white border-gray-200'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold">
                                                                {entry.employeeName?.[0] || "U"}
                                                            </div>
                                                            <div>
                                                                <p className={`font-medium ${
                                                                    darkMode ? 'text-gray-100' : 'text-gray-900'
                                                                }`}>
                                                                    {entry.employeeName}
                                                                </p>
                                                                <p className={`text-sm ${
                                                                    darkMode ? 'text-gray-400' : 'text-gray-600'
                                                                }`}>
                                                                    {new Date(entry.workDate).toLocaleDateString()}
                                                                </p>
                                                                {entry.description && (
                                                                    <p className={`text-sm mt-1 ${
                                                                        darkMode ? 'text-gray-500' : 'text-gray-500'
                                                                    }`}>
                                                                        {entry.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className={`text-2xl font-bold ${
                                                                darkMode ? 'text-indigo-400' : 'text-indigo-600'
                                                            }`}>
                                                                {entry.hoursSpent}h
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className={`text-center py-12 ${
                                                    darkMode ? 'text-gray-400' : 'text-gray-500'
                                                }`}>
                                                    <Clock className={`w-12 h-12 mx-auto mb-2 ${
                                                        darkMode ? 'text-gray-600' : 'text-gray-300'
                                                    }`} />
                                                    <p>No time entries yet</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* HISTORY TAB */}
                            {activeTab === "history" && (
                                <div className="space-y-3">
                                    {auditLogs.length > 0 ? (
                                        <div className="relative">
                                            <div className={`absolute left-4 top-0 bottom-0 w-0.5 ${
                                                darkMode ? 'bg-gray-700' : 'bg-gray-200'
                                            }`} />
                                            {auditLogs.map((log) => (
                                                <div key={log.id} className="relative flex gap-4 pb-6">
                                                    <div className="relative z-10">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                                                            <History className="w-4 h-4 text-white" />
                                                        </div>
                                                    </div>
                                                    <div className={`flex-1 border rounded-lg p-4 ${
                                                        darkMode
                                                            ? 'bg-gray-700 border-gray-600'
                                                            : 'bg-white border-gray-200'
                                                    }`}>
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div>
                                                                <p className={`font-medium ${
                                                                    darkMode ? 'text-gray-100' : 'text-gray-900'
                                                                }`}>
                                                                    {log.action}
                                                                </p>
                                                                <p className={`text-sm ${
                                                                    darkMode ? 'text-gray-400' : 'text-gray-600'
                                                                }`}>
                                                                    by {log.userName || "System"} •{" "}
                                                                    {formatDate(log.createdAt)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {log.description && (
                                                            <p className={`text-sm mt-2 ${
                                                                darkMode ? 'text-gray-300' : 'text-gray-700'
                                                            }`}>
                                                                {log.description}
                                                            </p>
                                                        )}
                                                        {log.fieldName && (
                                                            <div className={`mt-3 p-3 rounded text-sm ${
                                                                darkMode ? 'bg-gray-800' : 'bg-gray-50'
                                                            }`}>
                                                                <p className={`font-medium mb-1 ${
                                                                    darkMode ? 'text-gray-300' : 'text-gray-700'
                                                                }`}>
                                                                    Changed:{" "}
                                                                    <span className={darkMode ? 'text-indigo-400' : 'text-indigo-600'}>
                                                                        {log.fieldName}
                                                                    </span>
                                                                </p>
                                                                {log.oldValue && (
                                                                    <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                                                                        <span className={darkMode ? 'text-red-400 line-through' : 'text-red-600 line-through'}>
                                                                            {log.oldValue}
                                                                        </span>{" "}
                                                                        →{" "}
                                                                        <span className={`font-medium ${
                                                                            darkMode ? 'text-green-400' : 'text-green-600'
                                                                        }`}>
                                                                            {log.newValue}
                                                                        </span>
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className={`text-center py-12 ${
                                            darkMode ? 'text-gray-400' : 'text-gray-500'
                                        }`}>
                                            <History className={`w-12 h-12 mx-auto mb-2 ${
                                                darkMode ? 'text-gray-600' : 'text-gray-300'
                                            }`} />
                                            <p>No activity history yet</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className={`border-t p-4 ${
                    darkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className={`flex items-center gap-2 text-sm ${
                            darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                            <Clock className="w-4 h-4" />
                            <span>Last updated: {formatDate(taskData?.updatedAt)}</span>
                        </div>

                        <div className="flex gap-2">
                            {canManageTask && taskData?.status !== "COMPLETED" && (
                                <button
                                    onClick={() => {
                                        if (window.confirm("Cancel this task?")) {
                                            handleStatusChange("CANCELLED");
                                        }
                                    }}
                                    className={`px-4 py-2 border rounded-lg transition flex items-center gap-2 ${
                                        darkMode
                                            ? 'border-red-700 text-red-400 hover:bg-red-900/20'
                                            : 'border-red-300 text-red-600 hover:bg-red-50'
                                    }`}
                                >
                                    <XCircle className="w-4 h-4" />
                                    Cancel Task
                                </button>
                            )}

                            <button
                                onClick={onClose}
                                className={`px-4 py-2 rounded-lg transition ${
                                    darkMode
                                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailsModal;