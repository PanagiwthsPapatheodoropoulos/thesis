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
// src/components/TaskDetailsModal.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Clock, User, Calendar, AlertCircle, MessageSquare, 
  History, Send, Trash2, CheckCircle, XCircle, PlayCircle,
  PauseCircle, Flag, Users, Plus, GitCommit, GitBranch, Diff, Hash, Github, RefreshCw, Tag, ExternalLink, Settings,
  Paperclip, UploadCloud, FileText, FileSpreadsheet, FileArchive, FileCode, FileImage, File, Download
} from 'lucide-react';
import { tasksAPI, taskCommentsAPI, taskTimeAPI, employeesAPI,taskAuditAPI, departmentsAPI, taskAttachmentsAPI } from '../utils/api';
import { parseUTCDate, formatDate, getRelativeTime } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/Toast';
import { useWebSocket } from '../contexts/WebSocketProvider';
import { useConfirm } from './ConfirmDialog';
import { CustomDatePicker } from './CustomDatePicker';
import type { TaskDetailsModalProps, Task, TaskAssignment, Employee, TaskComment, TaskAuditLog, TaskTimeEntry } from '../types';

const TASK_EVENTS = {
    TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
    TASK_UPDATED: 'TASK_UPDATED',
    TASK_COMMENT_ADDED: 'TASK_COMMENT_ADDED',
    ASSIGNMENT_UPDATED: 'ASSIGNMENT_UPDATED'
};

const getFileIconAndColor = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
        return {
            icon: <FileText className="w-8 h-8" />,
            color: 'text-red-500 bg-red-100 dark:bg-red-950/45 dark:text-red-400'
        };
    }
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
        return {
            icon: <FileSpreadsheet className="w-8 h-8" />,
            color: 'text-green-600 bg-green-100 dark:bg-green-950/45 dark:text-green-400'
        };
    }
    if (['docx', 'doc'].includes(ext)) {
        return {
            icon: <FileText className="w-8 h-8" />,
            color: 'text-blue-500 bg-blue-100 dark:bg-blue-950/45 dark:text-blue-400'
        };
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) {
        return {
            icon: <FileImage className="w-8 h-8" />,
            color: 'text-amber-500 bg-amber-100 dark:bg-amber-950/45 dark:text-amber-400'
        };
    }
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
        return {
            icon: <FileArchive className="w-8 h-8" />,
            color: 'text-purple-500 bg-purple-100 dark:bg-purple-950/45 dark:text-purple-400'
        };
    }
    if (['html', 'css', 'js', 'ts', 'tsx', 'jsx', 'json', 'py', 'java', 'sql', 'sh'].includes(ext)) {
        return {
            icon: <FileCode className="w-8 h-8" />,
            color: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-950/45 dark:text-indigo-400'
        };
    }
    return {
        icon: <File className="w-8 h-8" />,
        color: 'text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
    };
};

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({ task, isOpen, onClose, onTaskUpdate, onCloneTask }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('details');
    const { connected, subscribe } = useWebSocket();
    const [taskData, setTaskData] = useState<Task | null>(task);
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [auditLogs, setAuditLogs] = useState<TaskAuditLog[]>([]);
    const [systemLogs, setSystemLogs] = useState<TaskAuditLog[]>([]);
    const { darkMode } = useTheme();
    const { showToast } = useToast();
    const confirm = useConfirm();
    const [timeEntries, setTimeEntries] = useState<TaskTimeEntry[]>([]);
    const [employeeProfile, setEmployeeProfile] = useState<Employee | null>(null);
    const [newComment, setNewComment] = useState<string>('');
    const [commentError, setCommentError] = useState<string | null>(null);
    const [newTimeEntry, setNewTimeEntry] = useState({
        hoursSpent: '',
        workDate: new Date().toISOString().split('T')[0],
        description: ''
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [totalHours, setTotalHours] = useState<number>(0);
    const commentsEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Git branching states
    const [branches, setBranches] = useState<string[]>(() => {
        if (task?.branches) {
            try { return JSON.parse(task.branches); } catch { return task.branches.split(',').map(b => b.trim()); }
        }
        return ['main'];
    });
    const [activeBranch, setActiveBranch] = useState<string>(task?.activeBranch || 'main');
    const [isCreatingBranch, setIsCreatingBranch] = useState<boolean>(false);
    const [newBranchName, setNewBranchName] = useState<string>('');
    const [showBranchDropdown, setShowBranchDropdown] = useState<boolean>(false);

    // GitHub integration states
    const [githubRepo, setGithubRepo] = useState<string>(task?.githubRepo || '');
    const [isLinkedToGithub, setIsLinkedToGithub] = useState<boolean>(false);
    const [githubError, setGithubError] = useState<string | null>(null);
    const [isLinking, setIsLinking] = useState<boolean>(false);
    const [tempRepoPath, setTempRepoPath] = useState<string>('');
    const [githubToken, setGithubToken] = useState<string>(() => {
        return localStorage.getItem('github_global_token') || '';
    });
    const [tempToken, setTempToken] = useState<string>('');

    // Simulated/custom commits states
    const [showCommitForm, setShowCommitForm] = useState<boolean>(false);
    const [newCommitMessage, setNewCommitMessage] = useState<string>('');
    const [newCommitDesc, setNewCommitDesc] = useState<string>('');

    const [deptDevInfoEnabled, setDeptDevInfoEnabled] = useState<boolean>(false);

    const [showAddTagInput, setShowAddTagInput] = useState<boolean>(false);
    const [newTagInput, setNewTagInput] = useState<string>('');

    // File attachments states
    const [attachments, setAttachments] = useState<any[]>([]);
    const [uploadingFile, setUploadingFile] = useState<boolean>(false);

    // Fetch employee profile on mount/open
    useEffect(() => {
        if (isOpen && user?.id) {
            employeesAPI.getByUserId(user.id)
                .then(async (profile) => {
                    setEmployeeProfile(profile);
                    if (profile.department) {
                        try {
                            const dept = await departmentsAPI.getByName(profile.department);
                            setDeptDevInfoEnabled(dept.devInfoEnabled || false);
                        } catch (err) {
                            console.error("Error fetching department for dev info check:", err);
                        }
                    }
                })
                .catch(err => console.error("Error fetching employee profile:", err));
        }
    }, [isOpen, user?.id]);

    // Sync GitHub repo state when task changes
    useEffect(() => {
        if (isOpen && task?.id) {
            setGithubRepo(task.githubRepo || '');
            const storedToken = localStorage.getItem('github_global_token');
            setGithubToken(storedToken || '');
            setIsLinking(false);
            setGithubError(null);
            setIsLinkedToGithub(false);
            setShowCommitForm(false);
            setNewCommitMessage('');
            setNewCommitDesc('');

            // Also sync active branch and branches from task
            setActiveBranch(task.activeBranch || 'main');
            if (task.branches) {
                try { setBranches(JSON.parse(task.branches)); } catch { setBranches(task.branches.split(',').map(b => b.trim())); }
            } else {
                setBranches(['main']);
            }
        }
    }, [isOpen, task?.id, task]);

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

        const handleTaskUpdate = (data: Record<string, unknown>) => {
            // Check if the update is for the current task
            // Handle potentially different payload structures
            const nested = data.task as Record<string, unknown> | undefined;
            const updatedTaskId = nested?.id || data.taskId || data.id;
            
            if (updatedTaskId === task.id) {
                fetchTaskDetails(); 
                
                // If it was a status change, notify parent to update list
                if (onTaskUpdate) onTaskUpdate?.(undefined as unknown as Task);
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
            if (!taskData || !taskData.description) setLoading(true); 
            setLoadError(null);

            // Parallel fetch for better performance
            const [fetchedTask, fetchedComments, fetchedLogs, fetchedTime, fetchedAttachments] = await Promise.all([
                tasksAPI.getById(task.id),
                taskCommentsAPI.getByTask(task.id).catch(() => []),
                taskAuditAPI.getHistory ? Promise.resolve(taskAuditAPI.getHistory(task.id)).catch(() => []) : Promise.resolve([]), 
                taskTimeAPI.getByTask(task.id).catch(() => []),
                taskAttachmentsAPI.getByTask(task.id).catch(() => [])
            ]);

            setTaskData(fetchedTask);
            setComments(fetchedComments);
            setTimeEntries(fetchedTime);
            setAttachments(fetchedAttachments);

            // Set system logs for the dedicated History tab
            const sortedSystemLogs = [...fetchedLogs];
            sortedSystemLogs.sort((a, b) => parseUTCDate(b.createdAt || '').getTime() - parseUTCDate(a.createdAt || '').getTime());
            setSystemLogs(sortedSystemLogs);

            let githubCommits: TaskAuditLog[] = [];
            let githubBranches: string[] = ['main'];
            let fetchedFromGithub = false;

            const dbRepo = fetchedTask.githubRepo || '';
            const dbActiveBranch = fetchedTask.activeBranch || 'main';
            let dbBranches = ['main'];
            if (fetchedTask.branches) {
                try {
                    dbBranches = JSON.parse(fetchedTask.branches);
                } catch {
                    dbBranches = fetchedTask.branches.split(',').map((b: string) => b.trim());
                }
            }

            setGithubRepo(dbRepo);
            setActiveBranch(dbActiveBranch);
            setBranches(dbBranches);

            if (dbRepo) {
                try {
                    const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json' };
                    const storedToken = localStorage.getItem('github_global_token') || '';
                    if (storedToken) {
                        headers['Authorization'] = `token ${storedToken}`;
                    }

                    // Try to fetch branches from GitHub API
                    const branchesRes = await fetch(`https://api.github.com/repos/${dbRepo}/branches`, {
                        headers
                    });
                    
                    if (branchesRes && branchesRes.ok) {
                        const branchesData = await branchesRes.json();
                        githubBranches = branchesData.map((b: { name: string }) => b.name);
                        
                        // Merge uniquely
                        const mergedBranches = Array.from(new Set([...githubBranches, ...dbBranches, 'main']));
                        
                        // Check if activeBranch is still valid, else default to main or first branch
                        let finalActive = dbActiveBranch;
                        if (!mergedBranches.includes(dbActiveBranch)) {
                            finalActive = mergedBranches.includes('main') ? 'main' : (mergedBranches[0] || 'main');
                        }

                        setBranches(mergedBranches);
                        setActiveBranch(finalActive);

                        if (JSON.stringify(mergedBranches) !== fetchedTask.branches || finalActive !== fetchedTask.activeBranch) {
                            tasksAPI.update(task.id, {
                                branches: JSON.stringify(mergedBranches),
                                activeBranch: finalActive
                            })
                            .then(updated => {
                                if (onTaskUpdate) onTaskUpdate(updated);
                            })
                            .catch(err => console.error("Error auto-updating branches in backend:", err));
                        }

                        // Try to fetch commits for activeBranch from GitHub API
                        const commitsRes = await fetch(`https://api.github.com/repos/${dbRepo}/commits?sha=${finalActive}&per_page=15`, {
                            headers
                        });

                        if (commitsRes && commitsRes.ok) {
                            const commitsData = await commitsRes.json();
                            githubCommits = commitsData.map((item: any) => ({
                                id: item.sha,
                                taskId: task.id,
                                action: item.commit.message.split('\n')[0],
                                description: item.commit.message,
                                userName: item.commit.author?.name || item.author?.login || 'GitHub Contributor',
                                createdAt: item.commit.author?.date || new Date().toISOString(),
                                fieldName: undefined,
                                oldValue: undefined,
                                newValue: undefined
                            }));
                            fetchedFromGithub = true;
                            setIsLinkedToGithub(true);
                            setGithubError(null);
                        } else {
                            if (commitsRes && commitsRes.status === 403) {
                                setGithubError("GitHub API rate limit exceeded. Using simulated commits.");
                            } else if (commitsRes) {
                                setGithubError(`Failed to fetch commits (${commitsRes.status}). Using simulated commits.`);
                            } else {
                                setGithubError("Failed to fetch commits. Using simulated commits.");
                            }
                        }
                    } else {
                        if (branchesRes && branchesRes.status === 404) {
                            setGithubError("Repository not found or private. Using simulated commits.");
                        } else if (branchesRes && branchesRes.status === 403) {
                            setGithubError("GitHub API rate limit exceeded. Using simulated commits.");
                        } else if (branchesRes) {
                            setGithubError(`Failed to connect to GitHub (${branchesRes.status}). Using simulated commits.`);
                        } else {
                            setGithubError(`Failed to connect to GitHub. Using simulated commits.`);
                        }
                        setIsLinkedToGithub(false);
                    }
                } catch (e) {
                    console.error("Error communicating with GitHub:", e);
                    setGithubError("GitHub connection error. Using simulated commits.");
                    setIsLinkedToGithub(false);
                }
            }

            if (fetchedFromGithub) {
                setAuditLogs(githubCommits);
            } else {
                setIsLinkedToGithub(false);
                
                let customCommits: TaskAuditLog[] = [];
                if (fetchedTask.customCommits) {
                    try {
                        customCommits = JSON.parse(fetchedTask.customCommits);
                    } catch {
                        customCommits = [];
                    }
                }

                // Filter commits by branch
                const filteredCommits = customCommits.filter((c: any) => {
                    return !c.branch || c.branch === dbActiveBranch;
                });

                // Sort chronologically descending
                filteredCommits.sort((a, b) => parseUTCDate(b.createdAt || '').getTime() - parseUTCDate(a.createdAt || '').getTime());

                setAuditLogs(filteredCommits);
            }

            // Calculate total hours
            const total = fetchedTime.reduce((acc: number, entry: TaskTimeEntry) => acc + (Number(entry.hoursSpent) || 0), 0);
            setTotalHours(total);

        } catch (error: unknown) {
            console.error("Error fetching task details:", error);
            setLoadError('Unable to load task details. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newBranchName.trim().toLowerCase().replace(/[^a-z0-9/_-]/g, '-');
        if (!trimmed) {
            showToast('Branch name cannot be empty', 'error');
            return;
        }
        if (branches.includes(trimmed)) {
            showToast('Branch already exists', 'error');
            return;
        }

        const updatedBranches = [...branches, trimmed];
        setBranches(updatedBranches);
        setActiveBranch(trimmed);
        setNewBranchName('');
        setIsCreatingBranch(false);
        setShowBranchDropdown(false);
        showToast(`Created and checked out branch '${trimmed}'`, 'success');

        try {
            const updated = await tasksAPI.update(task.id, {
                branches: JSON.stringify(updatedBranches),
                activeBranch: trimmed
            });
            if (onTaskUpdate) onTaskUpdate(updated);
            fetchTaskDetails();
        } catch (err) {
            console.error("Error creating branch:", err);
            showToast('Failed to save branch to database', 'error');
        }
    };

    const handleMergeBranch = async () => {
        if (activeBranch === 'main') return;
        
        try {
            let customCommits: any[] = [];
            if (taskData?.customCommits) {
                try {
                    customCommits = JSON.parse(taskData.customCommits);
                } catch {
                    customCommits = [];
                }
            }

            let mergedCount = 0;
            customCommits.forEach(c => {
                if (c.branch === activeBranch) {
                    c.branch = 'main';
                    mergedCount++;
                }
            });

            const updated = await tasksAPI.update(task.id, {
                customCommits: JSON.stringify(customCommits),
                activeBranch: 'main'
            });
            
            showToast(`Merged branch '${activeBranch}' into 'main' (${mergedCount} commits)`, 'success');
            setActiveBranch('main');
            if (onTaskUpdate) onTaskUpdate(updated);
            fetchTaskDetails();
        } catch (err) {
            console.error("Error merging branches:", err);
            showToast('Failed to merge branch.', 'error');
        }
    };

    const handleDeleteBranch = async (branchToDelete: string) => {
        if (branchToDelete === 'main') return;
        
        const updated = branches.filter(b => b !== branchToDelete);
        setBranches(updated);
        
        const nextActive = activeBranch === branchToDelete ? 'main' : activeBranch;
        setActiveBranch(nextActive);

        let customCommits: any[] = [];
        if (taskData?.customCommits) {
            try {
                customCommits = JSON.parse(taskData.customCommits);
            } catch {
                customCommits = [];
            }
        }
        const updatedCommits = customCommits.filter(c => c.branch !== branchToDelete);

        try {
            const updatedTask = await tasksAPI.update(task.id, {
                branches: JSON.stringify(updated),
                activeBranch: nextActive,
                customCommits: JSON.stringify(updatedCommits)
            });
            showToast(`Deleted branch '${branchToDelete}'`, 'success');
            if (onTaskUpdate) onTaskUpdate(updatedTask);
            fetchTaskDetails();
        } catch (err) {
            console.error("Error deleting branch:", err);
            showToast('Failed to delete branch.', 'error');
        }
    };

    const handleCreateSimulatedCommit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCommitMessage.trim()) {
            showToast('Commit message cannot be empty', 'error');
            return;
        }

        const customLog = {
            id: 'cmit-' + Math.random().toString(36).substring(2, 9),
            taskId: task.id,
            action: newCommitMessage.trim(),
            description: newCommitDesc.trim() || undefined,
            userName: user?.username || 'Developer',
            createdAt: new Date().toISOString(),
            branch: activeBranch,
        };

        try {
            let customCommits: any[] = [];
            if (taskData?.customCommits) {
                try {
                    customCommits = JSON.parse(taskData.customCommits);
                } catch {
                    customCommits = [];
                }
            }
            customCommits.push(customLog);

            const updated = await tasksAPI.update(task.id, {
                customCommits: JSON.stringify(customCommits)
            });

            showToast(`Logged local commit: ${customLog.action}`, 'success');
            setNewCommitMessage('');
            setNewCommitDesc('');
            setShowCommitForm(false);
            if (onTaskUpdate) onTaskUpdate(updated);
            fetchTaskDetails();
        } catch (err) {
            console.error("Error creating local commit:", err);
            showToast('Failed to create local commit', 'error');
        }
    };

    /**
     * Submits a new comment for the current task.
     * Clears the comment input and refreshes details on success.
     *
     * @param {React.FormEvent} e - The form submit event.
     */
    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) {
            setCommentError('Please enter a comment before posting.');
            return;
        }

        try {
            setCommentError(null);
            await taskCommentsAPI.create({
                taskId: task.id,
                comment: newComment
            });
            
            setNewComment('');
            await fetchTaskDetails();
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            showToast('Error adding comment: ' + errMsg, 'error');
        }
    };

    /**
     * Deletes a comment after user confirmation.
     *
     * @param {string} commentId - The UUID of the comment to delete.
     */
    const handleDeleteComment = async (commentId: string) => {
        const isConfirmed = await confirm({
            title: 'Delete Comment',
            message: 'Are you sure you want to delete this comment?',
            confirmText: 'Delete',
            variant: 'danger'
        });
        if (!isConfirmed) return;

        try {
            await taskCommentsAPI.delete(commentId);
            await fetchTaskDetails();
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            showToast('Error deleting comment: ' + errMsg, 'error');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Limit to 15MB
        if (file.size > 15 * 1024 * 1024) {
            showToast('File size exceeds 15MB limit.', 'error');
            return;
        }

        const allowedExtensions = [
            "pdf", "xlsx", "xls", "docx", "doc", "csv", "png", "jpg", "jpeg", "gif", "txt", "md", "zip", "rar", "tar", "gz"
        ];
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        if (!allowedExtensions.includes(extension)) {
            showToast(`Extension .${extension} is not supported.`, 'error');
            return;
        }

        setUploadingFile(true);
        try {
            await taskAttachmentsAPI.upload(task.id, file);
            showToast('File uploaded successfully!', 'success');
            await fetchTaskDetails();
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            showToast('Upload failed: ' + errMsg, 'error');
        } finally {
            setUploadingFile(false);
            if (e.target) e.target.value = ''; // Reset file input
        }
    };

    const handleFileDownload = async (attachmentId: string, filename: string) => {
        try {
            await taskAttachmentsAPI.download(attachmentId, filename);
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            showToast('Download failed: ' + errMsg, 'error');
        }
    };

    const handleFileDelete = async (attachmentId: string) => {
        const isConfirmed = await confirm({
            title: 'Delete Attachment',
            message: 'Are you sure you want to permanently delete this attachment?',
            confirmText: 'Delete',
            variant: 'danger'
        });
        if (!isConfirmed) return;

        try {
            await taskAttachmentsAPI.delete(attachmentId);
            showToast('Attachment deleted successfully!', 'success');
            await fetchTaskDetails();
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            showToast('Failed to delete attachment: ' + errMsg, 'error');
        }
    };

    /**
     * Logs a time entry for the current task.
     * Verifies that the user has an employee profile before calling the API.
     * Resets the form and refreshes details on success.
     *
     * @param {React.FormEvent} e - The form submit event.
     */
    const handleAddTimeEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTimeEntry.hoursSpent || parseFloat(newTimeEntry.hoursSpent) <= 0) {
            showToast('Please enter valid hours', 'warning');
            return;
        }

        try {
            // Check employee profile existence
            try {
                await employeesAPI.getByUserId(user.id);
            } catch (error: unknown) {
                showToast('You need an employee profile to log time. Contact an administrator.', 'warning');
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
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            showToast('Error logging time: ' + errMsg, 'error');
        }
    };

    /**
     * Updates the task's status via the tasks API and notifies the parent.
     *
     * @param {string} newStatus - The target status string (e.g. "IN_PROGRESS", "COMPLETED").
     */
    const handleStatusChange = async (newStatus: string) => {
        try {
            await tasksAPI.updateStatus(task.id, newStatus);
            await fetchTaskDetails();

            if (onTaskUpdate) onTaskUpdate?.(undefined as unknown as Task);
    
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            showToast('Error updating status: ' + errMsg, 'error');
        }
    };

    /**
     * Removes a tag from the current task.
     * Only admins/managers are authorized to trigger this.
     */
    const handleRemoveTag = async (tagToRemove: string) => {
        if (!taskData) return;
        const currentTags = taskData.tags || [];
        const newTags = currentTags.filter((t: string) => t !== tagToRemove);
        try {
            const updated = await tasksAPI.update(taskData.id, {
                tags: newTags
            });
            setTaskData(updated);
            if (onTaskUpdate) onTaskUpdate(updated);
            showToast(`Tag "${tagToRemove}" removed`, 'success');
        } catch (error: any) {
            showToast('Error removing tag: ' + (error.message || error), 'error');
        }
    };

    /**
     * Submits a new tag to be added to the current task.
     * Prevents duplicate tag additions.
     */
    const handleAddTagSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!taskData) return;
        const trimmed = newTagInput.trim();
        if (!trimmed) return;
        
        const currentTags = taskData.tags || [];
        if (currentTags.some((t: string) => t.toLowerCase() === trimmed.toLowerCase())) {
            showToast(`Tag "${trimmed}" already exists on this task`, 'warning');
            return;
        }
        
        const newTags = [...currentTags, trimmed];
        try {
            const updated = await tasksAPI.update(taskData.id, {
                tags: newTags
            });
            setTaskData(updated);
            setNewTagInput('');
            setShowAddTagInput(false);
            if (onTaskUpdate) onTaskUpdate(updated);
            showToast(`Tag "${trimmed}" added`, 'success');
        } catch (error: any) {
            showToast('Error adding tag: ' + (error.message || error), 'error');
        }
    };

    /**
     * Returns CSS class string for a priority badge based on the priority level.
     *
     * @param {string} priority - Task priority ("LOW", "MEDIUM", "HIGH", "CRITICAL").
     * @returns {string} Tailwind CSS classes for the priority badge.
     */
    const getPriorityColor = (priority: string) => {
        if (darkMode) {
            const colors: Record<string, string> = {
                LOW: 'bg-green-950/40 text-green-300 border border-green-800/60',
                MEDIUM: 'bg-amber-950/40 text-amber-300 border border-amber-800/60',
                HIGH: 'bg-orange-950/40 text-orange-300 border border-orange-800/60',
                CRITICAL: 'bg-rose-950/40 text-rose-300 border border-rose-800/60'
            };
            return colors[priority] || 'bg-gray-900/40 text-gray-350 border border-gray-700';
        } else {
            const colors: Record<string, string> = {
                LOW: 'bg-green-50/60 text-green-700 border border-green-300',
                MEDIUM: 'bg-amber-50/60 text-amber-800 border border-amber-300',
                HIGH: 'bg-orange-50/60 text-orange-700 border border-orange-300',
                CRITICAL: 'bg-rose-50/60 text-rose-700 border border-rose-300'
            };
            return colors[priority] || 'bg-gray-50 text-gray-600 border border-gray-300';
        }
    };

    /**
     * Returns CSS class string for a status badge based on the task status.
     *
     * @param {string} status - Task status ("PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED", "CANCELLED").
     * @returns {string} Tailwind CSS classes for the status badge.
     */
    const getStatusColor = (status: string) => {
        if (darkMode) {
            const colors: Record<string, string> = {
                PENDING: 'bg-gray-900/40 text-gray-350 border border-gray-700',
                IN_PROGRESS: 'bg-blue-950/40 text-blue-300 border border-blue-900/60',
                COMPLETED: 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/60',
                BLOCKED: 'bg-red-950/40 text-red-300 border border-red-900/60',
                CANCELLED: 'bg-gray-900/30 text-gray-400 border border-gray-800'
            };
            return colors[status] || 'bg-gray-900/40 text-gray-350 border border-gray-700';
        } else {
            const colors: Record<string, string> = {
                PENDING: 'bg-gray-50 text-gray-600 border border-gray-300',
                IN_PROGRESS: 'bg-blue-50/60 text-blue-700 border border-blue-300',
                COMPLETED: 'bg-emerald-50/60 text-emerald-700 border border-emerald-300',
                BLOCKED: 'bg-red-50/60 text-red-700 border border-red-300',
                CANCELLED: 'bg-gray-50 text-gray-500 border border-gray-300'
            };
            return colors[status] || 'bg-gray-50 text-gray-600 border border-gray-300';
        }
    };

    /**
     * Formats an ISO date string into a localised date-time string.
     *
     * @param {string|null} dateString - An ISO 8601 date string, or null/undefined.
     * @returns {string} A formatted date-time string, or 'N/A' if the input is falsy.
     */
    /**
     * Generates a short git-style commit hash from an ID string.
     */
    const getShortHash = (id: string): string => {
        return id.replace(/-/g, '').substring(0, 7);
    };

    /**
     * Maps an audit action to a git-style icon color.
     */
    const getCommitColor = (action: string): string => {
        const lower = action.toLowerCase();
        if (lower.includes('created') || lower.includes('added')) return 'bg-green-500';
        if (lower.includes('deleted') || lower.includes('removed') || lower.includes('cancelled')) return 'bg-red-500';
        if (lower.includes('completed')) return 'bg-emerald-500';
        if (lower.includes('blocked')) return 'bg-orange-500';
        if (lower.includes('assigned') || lower.includes('assignment')) return 'bg-purple-500';
        return 'bg-indigo-500';
    };

    const isDev = useMemo(() => {
        if (!user) return false;
        if (user.role === 'ADMIN' || user.role === 'MANAGER') return true;
        if (!employeeProfile) return false;
        
        const dept = (employeeProfile.department || '').toLowerCase();
        const pos = (employeeProfile.position || '').toLowerCase();
        
        return deptDevInfoEnabled ||
               dept.includes('engineering') || 
               dept.includes('development') || 
               dept.includes('it') || 
               dept.includes('software') || 
               dept.includes('tech') ||
               dept.includes('devops') ||
               dept.includes('r&d') ||
               pos.includes('dev') || 
               pos.includes('engineer') || 
               pos.includes('programmer') || 
               pos.includes('architect') || 
               pos.includes('coder');
    }, [user, employeeProfile, deptDevInfoEnabled]);

    const availableTabs = useMemo(() => {
        const tabs = ["details", "discussion", "attachments", "time"];
        if (isDev) {
            tabs.push("commits");
        }
        tabs.push("history");
        return tabs;
    }, [isDev]);

    const canManageTask = user?.role === 'ADMIN' || user?.role === 'MANAGER' ||
    taskData?.createdBy === user?.id;

    const canEditTags = user?.role === 'ADMIN' || user?.role === 'MANAGER';

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
                                    taskData?.status || ''
                                )}`}
                            >
                                {taskData?.status}
                            </span>
                            <span
                                className={`px-3 py-1 text-xs font-semibold rounded-full border-2 ${getPriorityColor(
                                    taskData?.priority || ''
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
                    {availableTabs.map((tab) => (
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
                            {tab === "discussion" && <MessageSquare className="w-4 h-4 inline mr-1" />}
                            {tab === "attachments" && <Paperclip className="w-4 h-4 inline mr-1" />}
                            {tab === "time" && <Clock className="w-4 h-4 inline mr-1" />}
                            {tab === "commits" && <GitCommit className="w-4 h-4 inline mr-1" />}
                            {tab === "history" && <History className="w-4 h-4 inline mr-1" />}
                            {tab === "details" ? "Overview" : tab === "discussion" ? "Discussion" : tab === "attachments" ? "Attachments" : tab === "commits" ? "Commits" : tab === "history" ? "History" : "Time Log"}
                            {tab === "discussion" && comments.length > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                                    {comments.length}
                                </span>
                            )}
                            {tab === "attachments" && attachments.length > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                                    {attachments.length}
                                </span>
                            )}
                            {tab === "commits" && auditLogs.length > 0 && (
                                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-mono ${
                                    darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {auditLogs.length}
                                </span>
                            )}
                            {tab === "history" && systemLogs.length > 0 && (
                                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-mono ${
                                    darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {systemLogs.length}
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
                            {loadError && (
                                <div className={`mb-4 border-2 rounded-lg p-3 flex items-start gap-2 ${
                                    darkMode ? 'bg-red-900/20 border-red-700 text-red-200' : 'bg-red-50 border-red-200 text-red-800'
                                }`}>
                                    <AlertCircle className={`w-4 h-4 mt-0.5 ${darkMode ? 'text-red-300' : 'text-red-600'}`} />
                                    <p className="text-sm">{loadError}</p>
                                </div>
                            )}
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

                                        {taskData?.pendingByName && (
                                            <div className={`p-4 rounded-lg ${
                                                darkMode ? 'bg-gray-700' : 'bg-gray-50'
                                            }`}>
                                                <div className={`flex items-center gap-2 text-sm mb-1 ${
                                                    darkMode ? 'text-gray-400' : 'text-gray-600'
                                                }`}>
                                                    <User className="w-4 h-4" />
                                                    <span>Set to Pending By</span>
                                                </div>
                                                <p className={`font-medium ${
                                                    darkMode ? 'text-gray-100' : 'text-gray-900'
                                                }`}>
                                                    {taskData.pendingByName}
                                                </p>
                                            </div>
                                        )}

                                        {taskData?.completedByName && (
                                            <div className={`p-4 rounded-lg ${
                                                darkMode ? 'bg-green-900/20' : 'bg-green-50'
                                            }`}>
                                                <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
                                                    <User className="w-4 h-4" />
                                                    <span>Completed By</span>
                                                </div>
                                                <p className={`font-medium ${
                                                    darkMode ? 'text-green-400' : 'text-green-900'
                                                }`}>
                                                    {taskData.completedByName}
                                                </p>
                                            </div>
                                        )}

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

                                        {Number(taskData?.estimatedHours || 0) > 0 && (
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

                                    {/* Tags Section */}
                                    <div>
                                        <h3 className={`font-semibold mb-2 flex items-center gap-2 ${
                                            darkMode ? 'text-gray-100' : 'text-gray-900'
                                        }`}>
                                            <Tag className="w-4 h-4 text-indigo-500" />
                                            <span>Tags</span>
                                        </h3>
                                        <div className="flex flex-wrap gap-2 items-center">
                                            {taskData?.tags && taskData.tags.map((tag: string) => (
                                                <span
                                                    key={tag}
                                                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-all ${
                                                        darkMode
                                                            ? 'bg-gray-800 border-gray-700 text-gray-300'
                                                            : 'bg-gray-50 border-gray-250 text-gray-600'
                                                    }`}
                                                >
                                                    {tag}
                                                    {canEditTags && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveTag(tag)}
                                                            className="hover:text-red-500 font-bold transition-colors cursor-pointer"
                                                            title="Remove Tag"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </span>
                                            ))}
                                            {(!taskData?.tags || taskData.tags.length === 0) && (
                                                <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    No tags applied
                                                </span>
                                            )}
                                            {canEditTags && (
                                                <div className="flex items-center gap-1 ml-1">
                                                    {showAddTagInput ? (
                                                        <form onSubmit={handleAddTagSubmit} className="flex items-center gap-1">
                                                            <input
                                                                type="text"
                                                                value={newTagInput}
                                                                onChange={(e) => setNewTagInput(e.target.value)}
                                                                placeholder="Add tag..."
                                                                className={`px-2 py-0.5 text-xs rounded border outline-none ${
                                                                    darkMode
                                                                        ? 'bg-gray-700 border-gray-600 text-gray-150 focus:border-indigo-500'
                                                                        : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                                                                }`}
                                                                autoFocus
                                                                maxLength={30}
                                                            />
                                                            <button
                                                                type="submit"
                                                                className="px-2 py-0.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded transition cursor-pointer"
                                                            >
                                                                Add
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setShowAddTagInput(false);
                                                                    setNewTagInput('');
                                                                }}
                                                                className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 cursor-pointer"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </form>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowAddTagInput(true)}
                                                            className={`px-2 py-1 text-xs border border-dashed rounded-md flex items-center gap-1 transition ${
                                                                darkMode
                                                                    ? 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                                                                    : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700'
                                                            } cursor-pointer`}
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            <span>Add Tag</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Assignments */}
                                    {taskData?.assignments && taskData.assignments.length > 0 && (
                                        <div>
                                            <h3 className={`font-semibold mb-3 ${
                                                darkMode ? 'text-gray-100' : 'text-gray-900'
                                            }`}>Assignments</h3>
                                            <div className="space-y-2">
                                                {taskData.assignments.map((assignment, index) => (
                                                    <div
                                                        key={assignment.id || assignment.employeeId || index}
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

                            {/* DISCUSSION TAB (PR-style) */}
                            {activeTab === "discussion" && (
                                <div className="space-y-4">
                                    {/* Write Comment Box */}
                                    <form onSubmit={handleAddComment} className={`border rounded-lg overflow-hidden ${
                                        darkMode ? 'border-gray-600' : 'border-gray-300'
                                    }`}>
                                        <div className={`px-4 py-2 text-xs font-medium border-b ${
                                            darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'
                                        }`}>
                                            Write
                                        </div>
                                        <textarea
                                            value={newComment}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                                setNewComment(e.target.value);
                                                if (commentError) setCommentError(null);
                                            }}
                                            placeholder="Leave a comment..."
                                            className={`w-full px-4 py-3 outline-none resize-none text-sm ${
                                                darkMode
                                                    ? 'bg-gray-800 text-gray-100 placeholder-gray-500'
                                                    : 'bg-white text-gray-900 placeholder-gray-400'
                                            }`}
                                            rows={3}
                                        />
                                        {commentError && (
                                            <p className={`px-4 py-1 text-xs ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
                                                {commentError}
                                            </p>
                                        )}
                                        <div className={`flex justify-between items-center px-4 py-2 border-t ${
                                            darkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'
                                        }`}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveTab("attachments");
                                                    setTimeout(() => {
                                                        fileInputRef.current?.click();
                                                    }, 100);
                                                }}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                                                    darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-650 hover:text-gray-850 hover:bg-gray-100'
                                                }`}
                                                title="Attach a file to this task"
                                            >
                                                <Paperclip className="w-4 h-4 text-indigo-500" />
                                                <span className="hidden sm:inline">Attach File</span>
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={!newComment.trim()}
                                                className="flex items-center gap-2 px-4 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Comment
                                            </button>
                                        </div>
                                    </form>

                                    {/* Discussion Thread */}
                                    <div className="space-y-0">
                                        {comments.length > 0 ? (
                                            comments.map((comment, idx) => {
                                                const canDeleteComment = 
                                                    (user?.role === 'ADMIN' || user?.role === 'MANAGER') || 
                                                    comment.userId === user?.id;
                                                
                                                return (
                                                    <div
                                                        key={comment.id || idx}
                                                        className={`border-l-2 pl-4 py-4 ${
                                                            idx === 0 ? '' : darkMode ? 'border-t border-gray-700' : 'border-t border-gray-100'
                                                        } ${
                                                            darkMode ? 'border-l-indigo-500' : 'border-l-indigo-400'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                                                    {comment.userName?.[0] || "U"}
                                                                </div>
                                                                <span className={`font-semibold text-sm ${
                                                                    darkMode ? 'text-gray-100' : 'text-gray-900'
                                                                }`}>
                                                                    {comment.userName || 'User'}
                                                                </span>
                                                                <span className={`text-xs ${
                                                                    darkMode ? 'text-gray-500' : 'text-gray-400'
                                                                }`}>
                                                                    commented {getRelativeTime(comment.createdAt)}
                                                                </span>
                                                            </div>
                                                            {canDeleteComment && (
                                                                <button
                                                                    onClick={() => handleDeleteComment(comment.id)}
                                                                    className={`p-1 rounded text-xs transition ${
                                                                        darkMode
                                                                            ? 'text-gray-500 hover:text-red-400 hover:bg-red-900/20'
                                                                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                                                    }`}
                                                                    title="Delete comment"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className={`whitespace-pre-wrap text-sm leading-relaxed ${
                                                            darkMode ? 'text-gray-300' : 'text-gray-700'
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
                                                <MessageSquare className={`w-10 h-10 mx-auto mb-2 ${
                                                    darkMode ? 'text-gray-600' : 'text-gray-300'
                                                }`} />
                                                <p className="text-sm">No discussion yet. Start the conversation!</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ATTACHMENTS TAB */}
                            {activeTab === "attachments" && (
                                <div className="space-y-6">
                                    {/* Upload Area */}
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
                                            darkMode
                                                ? 'border-gray-700 bg-gray-800/40 hover:border-indigo-500 hover:bg-gray-800/80'
                                                : 'border-gray-300 bg-gray-50 hover:border-indigo-600 hover:bg-indigo-50/30'
                                        }`}
                                    >
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                        {uploadingFile ? (
                                            <div className="space-y-2">
                                                <RefreshCw className="w-10 h-10 mx-auto text-indigo-500 animate-spin" />
                                                <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    Uploading file...
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <UploadCloud className={`w-10 h-10 mx-auto ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                                <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    Click to browse or drag a file here
                                                </p>
                                                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    Supported formats: PDF, DOCX, XLSX, CSV, Images, Text, ZIP (Max 15MB)
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Attachments List */}
                                    <div>
                                        <h3 className={`font-semibold mb-3 ${
                                            darkMode ? 'text-gray-100' : 'text-gray-900'
                                        }`}>Task Attachments</h3>
                                        
                                        {attachments.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {attachments.map((att) => {
                                                    const { icon, color } = getFileIconAndColor(att.filename);
                                                    const canDeleteAttachment = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'EMPLOYEE' || att.uploadedByUserId === user?.id;
                                                    
                                                    return (
                                                        <div
                                                            key={att.id}
                                                            className={`flex items-center justify-between p-3 border rounded-lg transition hover:shadow-sm ${
                                                                darkMode
                                                                    ? 'bg-gray-800/40 border-gray-700 hover:border-gray-655'
                                                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                <div className={`p-2 rounded-lg flex-shrink-0 ${color}`}>
                                                                    {icon}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p
                                                                        onClick={() => handleFileDownload(att.id, att.filename)}
                                                                        className={`font-semibold text-sm truncate cursor-pointer hover:underline ${
                                                                            darkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'
                                                                        }`}
                                                                        title={`Download ${att.filename}`}
                                                                    >
                                                                        {att.filename}
                                                                    </p>
                                                                    <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                        {formatFileSize(att.fileSize)} • by {att.uploadedByUserName}
                                                                    </p>
                                                                    <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                        {getRelativeTime(att.uploadedAt)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 ml-2">
                                                                <button
                                                                    onClick={() => handleFileDownload(att.id, att.filename)}
                                                                    className={`p-1.5 rounded transition ${
                                                                        darkMode
                                                                            ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                                                                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                                                                    }`}
                                                                    title="Download file"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </button>
                                                                {canDeleteAttachment && (
                                                                    <button
                                                                        onClick={() => handleFileDelete(att.id)}
                                                                        className={`p-1.5 rounded transition ${
                                                                            darkMode
                                                                                ? 'text-gray-500 hover:text-red-400 hover:bg-red-900/20'
                                                                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                                                        }`}
                                                                        title="Delete attachment"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className={`text-center py-12 border border-dashed rounded-lg ${
                                                darkMode ? 'border-gray-750 text-gray-500 bg-gray-800/10' : 'border-gray-200 text-gray-400 bg-gray-50/30'
                                            }`}>
                                                <Paperclip className={`w-12 h-12 mx-auto mb-2 ${
                                                    darkMode ? 'text-gray-700' : 'text-gray-300'
                                                }`} />
                                                <p className="text-sm">No attachments yet</p>
                                                <p className="text-xs">Optional: Upload a file to share with others on this task.</p>
                                            </div>
                                        )}
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
                                                    <CustomDatePicker
                                                        mode="date"
                                                        value={newTimeEntry.workDate}
                                                        onChange={(val) =>
                                                            setNewTimeEntry({
                                                                ...newTimeEntry,
                                                                workDate: val,
                                                            })
                                                        }
                                                        placeholder="Select work date"
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
                                            {Number(taskData?.estimatedHours || 0) > 0 && (
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
                                                timeEntries.map((entry, index) => (
                                                    <div
                                                        key={entry.id || index}
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
                                                                    {parseUTCDate(entry.workDate).toLocaleDateString()}
                                                                </p>
                                                                {entry.description && (
                                                                    <p className={`text-sm mt-1 ${
                                                                        darkMode ? 'text-gray-400' : 'text-gray-500'
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

                            {/* COMMITS TAB (Git-style) */}
                            {activeTab === "commits" && (
                                <div className="space-y-1">
                                    {/* Branch indicator & selector */}
                                    <div className="relative z-20 flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center gap-2 relative z-30">
                                            <button
                                                onClick={() => {
                                                    const nextVal = !showBranchDropdown;
                                                    setShowBranchDropdown(nextVal);
                                                    if (nextVal) {
                                                        setIsLinking(false);
                                                    }
                                                }}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-sm transition ${
                                                    darkMode 
                                                        ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-200' 
                                                        : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                                                }`}
                                            >
                                                <GitBranch className="w-3.5 h-3.5" />
                                                <span>{activeBranch}</span>
                                                <span className="text-[10px] opacity-60">▼</span>
                                            </button>

                                            {isLinkedToGithub ? (
                                                <div className="flex items-center">
                                                    <a
                                                        href={githubRepo.startsWith('http') ? githubRepo : `https://github.com/${githubRepo}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-l border border-r-0 text-[11px] font-mono transition ${
                                                            darkMode
                                                                ? 'bg-green-950/20 border-green-900/60 hover:bg-green-900/40 text-green-300'
                                                                : 'bg-green-50 border-green-200 hover:bg-green-100 text-green-700'
                                                        }`}
                                                        title={`View repository on GitHub: ${githubRepo}`}
                                                    >
                                                        <Github className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">
                                                            {githubRepo ? githubRepo.split('/')[1] || githubRepo : 'Link Repo'}
                                                        </span>
                                                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                                    </a>
                                                    <button
                                                        onClick={() => {
                                                            const nextVal = !isLinking;
                                                            setIsLinking(nextVal);
                                                            if (nextVal) {
                                                                setShowBranchDropdown(false);
                                                            }
                                                            setTempRepoPath(githubRepo || '');
                                                            setTempToken(githubToken || '');
                                                        }}
                                                        className={`flex items-center px-1.5 py-0.5 rounded-r border text-[11px] font-mono transition ${
                                                            darkMode
                                                                ? 'bg-green-950/30 border-green-900/60 hover:bg-green-900/50 text-green-400'
                                                                : 'bg-green-100 border-green-200 hover:bg-green-200 text-green-800'
                                                        }`}
                                                        title="Change GitHub repository settings"
                                                    >
                                                        <Settings className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        const nextVal = !isLinking;
                                                        setIsLinking(nextVal);
                                                        if (nextVal) {
                                                            setShowBranchDropdown(false);
                                                        }
                                                        setTempRepoPath(githubRepo || '');
                                                        setTempToken(githubToken || '');
                                                    }}
                                                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono transition ${
                                                        darkMode
                                                            ? 'bg-gray-800 border-gray-700 hover:bg-gray-900 text-gray-400'
                                                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-600'
                                                    }`}
                                                    title="Link public GitHub repository"
                                                >
                                                    <Github className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline">Link Repo</span>
                                                </button>
                                            )}

                                            {/* Link GitHub Repo Form Popover */}
                                            {isLinking && (
                                                <div className={`absolute top-full left-24 mt-1 w-72 rounded-lg border shadow-2xl p-3 z-50 transition-all ${
                                                    darkMode ? 'bg-gray-900 border-gray-700 shadow-indigo-950/50 text-gray-100' : 'bg-white border-gray-200 shadow-gray-400/30 text-gray-900'
                                                }`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className={`text-xs font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                                                            GitHub Integration
                                                        </h4>
                                                        <button 
                                                            onClick={() => setIsLinking(false)}
                                                            className="text-gray-400 hover:text-gray-200 text-xs"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                    <p className={`text-[10px] mb-3 leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        Enter a public GitHub repository path (e.g. <code>facebook/react</code>) and optional Personal Access Token.
                                                    </p>
                                                    <form 
                                                        onSubmit={async (e) => {
                                                            e.preventDefault();
                                                            const val = tempRepoPath.trim();
                                                            const tokenVal = tempToken.trim();
                                                            if (tokenVal) {
                                                                localStorage.setItem('github_global_token', tokenVal);
                                                            } else {
                                                                localStorage.removeItem('github_global_token');
                                                            }
                                                            setGithubToken(tokenVal);
                                                            setIsLinking(false);
                                                            try {
                                                                const updated = await tasksAPI.update(task.id, { githubRepo: val });
                                                                setGithubRepo(val);
                                                                showToast(val ? `Repository linked: ${val}` : "GitHub repository disconnected", "success");
                                                                if (onTaskUpdate) onTaskUpdate(updated);
                                                                fetchTaskDetails();
                                                            } catch (err) {
                                                                console.error("Error linking repository:", err);
                                                                showToast("Failed to link repository on server", "error");
                                                            }
                                                        }}
                                                        className="space-y-2"
                                                    >
                                                        <input
                                                            type="text"
                                                            value={tempRepoPath}
                                                            onChange={(e) => setTempRepoPath(e.target.value)}
                                                            placeholder="owner/repo"
                                                            className={`w-full px-2.5 py-1.5 text-xs rounded border outline-none font-mono ${
                                                                darkMode 
                                                                    ? 'bg-gray-800 border-gray-700 text-white focus:border-indigo-500' 
                                                                    : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-400'
                                                            }`}
                                                        />
                                                        <input
                                                            type="password"
                                                            value={tempToken}
                                                            onChange={(e) => setTempToken(e.target.value)}
                                                            placeholder="GitHub Token / PAT (Optional)"
                                                            className={`w-full px-2.5 py-1.5 text-xs rounded border outline-none font-mono ${
                                                                darkMode 
                                                                    ? 'bg-gray-800 border-gray-700 text-white focus:border-indigo-500' 
                                                                    : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-400'
                                                            }`}
                                                        />
                                                        <div className="flex gap-2 justify-end">
                                                            {githubRepo && (
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        try {
                                                                            const updated = await tasksAPI.update(task.id, { githubRepo: "" });
                                                                            setGithubRepo('');
                                                                            setIsLinking(false);
                                                                            showToast("GitHub repository disconnected", "info");
                                                                            if (onTaskUpdate) onTaskUpdate(updated);
                                                                            fetchTaskDetails();
                                                                        } catch (err) {
                                                                            console.error("Error disconnecting repository:", err);
                                                                            showToast("Failed to disconnect repository on server", "error");
                                                                        }
                                                                    }}
                                                                    className="px-2 py-1 text-[10px] bg-red-650 hover:bg-red-750 text-white rounded font-medium"
                                                                >
                                                                    Disconnect
                                                                </button>
                                                            )}
                                                            <button
                                                                type="submit"
                                                                className="px-2 py-1 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium"
                                                            >
                                                                Link Repo
                                                            </button>
                                                        </div>
                                                    </form>
                                                </div>
                                            )}

                                            {showBranchDropdown && (
                                                <div className={`absolute top-full left-0 mt-1 w-64 rounded-lg border shadow-2xl z-50 transition-all ${
                                                    darkMode ? 'bg-gray-900 border-gray-700 shadow-indigo-950/50 text-gray-100' : 'bg-white border-gray-200 shadow-gray-400/30 text-gray-900'
                                                }`}>
                                                    <div className={`p-2 border-b text-xs font-semibold ${
                                                        darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
                                                    }`}>
                                                        Switch / Manage Branches
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto p-1 space-y-0.5 animate-fadeIn">
                                                        {branches.map(b => (
                                                            <div 
                                                                key={b}
                                                                className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm cursor-pointer transition ${
                                                                    b === activeBranch
                                                                        ? darkMode 
                                                                            ? 'bg-indigo-950 border border-indigo-800 text-indigo-300 font-semibold' 
                                                                            : 'bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold'
                                                                        : darkMode 
                                                                            ? 'hover:bg-gray-800 border border-transparent text-gray-300' 
                                                                            : 'hover:bg-gray-100 border border-transparent text-gray-700'
                                                                }`}
                                                                onClick={async () => {
                                                                    setActiveBranch(b);
                                                                    setShowBranchDropdown(false);
                                                                    try {
                                                                        const updated = await tasksAPI.update(task.id, { activeBranch: b });
                                                                        if (onTaskUpdate) onTaskUpdate(updated);
                                                                        fetchTaskDetails();
                                                                    } catch (err) {
                                                                        console.error("Error setting active branch:", err);
                                                                    }
                                                                }}
                                                            >
                                                                <span className="font-mono flex items-center gap-1">
                                                                    {b === activeBranch && <span className="text-indigo-500">✓</span>}
                                                                    {b}
                                                                </span>
                                                                {b !== 'main' && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteBranch(b);
                                                                        }}
                                                                        className={`p-1 rounded opacity-65 hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500`}
                                                                        title="Delete branch"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className={`p-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                                                        {isCreatingBranch ? (
                                                            <form onSubmit={handleCreateBranch} className="flex gap-1.5">
                                                                <input
                                                                    type="text"
                                                                    value={newBranchName}
                                                                    onChange={(e) => setNewBranchName(e.target.value)}
                                                                    placeholder="branch-name"
                                                                    className={`flex-1 px-2 py-1 text-xs rounded border outline-none font-mono ${
                                                                        darkMode 
                                                                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500' 
                                                                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-400'
                                                                    }`}
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    type="submit"
                                                                    className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium"
                                                                >
                                                                    Create
                                                                </button>
                                                            </form>
                                                        ) : (
                                                            <button
                                                                onClick={() => setIsCreatingBranch(true)}
                                                                className={`w-full py-1 text-xs text-center font-medium rounded border border-dashed transition ${
                                                                    darkMode 
                                                                        ? 'border-gray-700 hover:bg-gray-800 text-indigo-400' 
                                                                        : 'border-gray-300 hover:bg-gray-50 text-indigo-600'
                                                                }`}
                                                            >
                                                                + Create New Branch
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                · {auditLogs.length} commit{auditLogs.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        {activeBranch !== 'main' && (
                                            <button
                                                onClick={handleMergeBranch}
                                                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-md border transition ${
                                                    darkMode
                                                        ? 'bg-indigo-950/40 border-indigo-900/60 hover:bg-indigo-900/40 text-indigo-300'
                                                        : 'bg-indigo-50 border-indigo-150 hover:bg-indigo-100 text-indigo-700'
                                                }`}
                                            >
                                                <Diff className="w-3.5 h-3.5" />
                                                <span>Merge into main</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Local Commit Form */}
                                    {!isLinkedToGithub && (
                                        <div className={`mb-4 p-4 rounded-lg border ${
                                            darkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-200'
                                        }`}>
                                            {showCommitForm ? (
                                                <form onSubmit={handleCreateSimulatedCommit} className="space-y-3">
                                                    <div className="flex items-center justify-between border-b pb-1.5 border-gray-250 dark:border-gray-700">
                                                        <span className="text-xs font-semibold flex items-center gap-1">
                                                            <GitCommit className="w-3.5 h-3.5 text-indigo-500" />
                                                            Create Local Commit on <code className="font-mono text-indigo-400 bg-indigo-950/20 px-1 py-0.5 rounded">{activeBranch}</code>
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowCommitForm(false)}
                                                            className="text-xs text-gray-500 hover:text-gray-300"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                    <div>
                                                        <input
                                                            type="text"
                                                            value={newCommitMessage}
                                                            onChange={(e) => setNewCommitMessage(e.target.value)}
                                                            placeholder="Commit message (e.g. feat: add validation logic)"
                                                            className={`w-full px-2.5 py-1.5 text-xs rounded border outline-none font-mono ${
                                                                darkMode 
                                                                    ? 'bg-gray-900 border-gray-700 text-white focus:border-indigo-500' 
                                                                    : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-400'
                                                            }`}
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <textarea
                                                            value={newCommitDesc}
                                                            onChange={(e) => setNewCommitDesc(e.target.value)}
                                                            placeholder="Commit description (optional detailed notes)"
                                                            rows={2}
                                                            className={`w-full px-2.5 py-1.5 text-xs rounded border outline-none font-mono resize-none ${
                                                                darkMode 
                                                                    ? 'bg-gray-900 border-gray-700 text-white focus:border-indigo-500' 
                                                                    : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-400'
                                                            }`}
                                                        />
                                                    </div>
                                                    <div className="flex justify-end">
                                                        <button
                                                            type="submit"
                                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium flex items-center gap-1"
                                                        >
                                                            <GitCommit className="w-3.5 h-3.5" />
                                                            Commit to {activeBranch}
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <button
                                                    onClick={() => setShowCommitForm(true)}
                                                    className={`w-full py-2 text-xs font-medium rounded border border-dashed transition flex items-center justify-center gap-1.5 ${
                                                        darkMode 
                                                            ? 'border-gray-700 hover:bg-gray-900 text-indigo-400 hover:border-indigo-500' 
                                                            : 'border-gray-300 hover:bg-gray-100 text-indigo-600 hover:border-indigo-500'
                                                    }`}
                                                >
                                                    <GitCommit className="w-3.5 h-3.5" />
                                                    + Write Simulated Commit Message / Work Log
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {auditLogs.length > 0 ? (
                                        <div className="relative">
                                            {/* Timeline line */}
                                            <div className={`absolute left-[15px] top-0 bottom-0 w-[2px] ${
                                                darkMode ? 'bg-gray-700' : 'bg-gray-200'
                                            }`} />

                                            {auditLogs.map((log, idx) => (
                                                <div key={log.id || idx} className="relative flex gap-4 pb-1 group">
                                                    {/* Commit dot */}
                                                    <div className="relative z-10 mt-1">
                                                        <div className={`w-8 h-8 rounded-full ${getCommitColor(log.action)} flex items-center justify-center shadow-sm`}>
                                                            <GitCommit className="w-4 h-4 text-white" />
                                                        </div>
                                                    </div>

                                                    {/* Commit card */}
                                                    <div className={`flex-1 mb-3 rounded-lg border transition ${
                                                        darkMode
                                                            ? 'bg-gray-800 border-gray-700 group-hover:border-gray-600'
                                                            : 'bg-white border-gray-200 group-hover:border-gray-300'
                                                    }`}>
                                                        {/* Commit header */}
                                                        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
                                                            darkMode ? 'border-gray-700' : 'border-gray-100'
                                                        }`}>
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                <p className={`font-medium text-sm truncate ${
                                                                    darkMode ? 'text-gray-100' : 'text-gray-900'
                                                                }`}>
                                                                    {log.action}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                                                {/* Branch badges */}
                                                                {(() => {
                                                                    let commitBranches: string[] = [];
                                                                    if (isLinkedToGithub) {
                                                                        commitBranches = [activeBranch];
                                                                    } else {
                                                                        if ((log as any).branch) {
                                                                            commitBranches = [(log as any).branch];
                                                                        } else {
                                                                            commitBranches = ['main'];
                                                                        }
                                                                    }
                                                                    return commitBranches.map(bName => (
                                                                        <span 
                                                                            key={bName} 
                                                                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                                                                                bName === 'main'
                                                                                    ? darkMode
                                                                                        ? 'bg-blue-950/60 border-blue-900/50 text-blue-300'
                                                                                        : 'bg-blue-50 border-blue-200 text-blue-700'
                                                                                    : darkMode
                                                                                        ? 'bg-indigo-950/60 border-indigo-900/50 text-indigo-300'
                                                                                        : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                                            }`}
                                                                        >
                                                                            <GitBranch className="w-2.5 h-2.5" />
                                                                            {bName}
                                                                        </span>
                                                                    ));
                                                                })()}
                                                                <code className={`px-2 py-0.5 rounded text-xs font-mono ${
                                                                    darkMode ? 'bg-gray-700 text-indigo-400' : 'bg-gray-100 text-indigo-600'
                                                                }`}>
                                                                    {getShortHash(log.id)}
                                                                </code>
                                                            </div>
                                                        </div>

                                                        {/* Commit body */}
                                                        <div className="px-4 py-2">
                                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[8px] font-bold">
                                                                        {(log.userName || 'S')[0]}
                                                                    </div>
                                                                    <span className={`text-xs ${
                                                                        darkMode ? 'text-gray-400' : 'text-gray-600'
                                                                    }`}>
                                                                        <span className="font-medium">{log.userName || 'System'}</span>
                                                                        {' committed '}
                                                                        <span title={formatDate(log.createdAt)}>{getRelativeTime(log.createdAt)}</span>
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {log.description && (
                                                                <p className={`text-xs mt-1.5 pl-6 ${
                                                                    darkMode ? 'text-gray-400' : 'text-gray-500'
                                                                }`}>
                                                                    {log.description}
                                                                </p>
                                                            )}

                                                            {/* Git diff block */}
                                                            {log.fieldName && (
                                                                <div className={`mt-2.5 ml-6 rounded-md border overflow-hidden font-mono text-xs ${
                                                                    darkMode ? 'border-gray-700' : 'border-gray-200'
                                                                }`}>
                                                                    {/* Diff header */}
                                                                    <div className={`px-3 py-1.5 flex items-center gap-2 ${
                                                                        darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500'
                                                                    }`}>
                                                                        <span className="font-semibold">{log.fieldName}</span>
                                                                    </div>
                                                                    {/* Diff lines */}
                                                                    {log.oldValue && (
                                                                        <div className={`px-3 py-1 flex items-start gap-2 ${
                                                                            darkMode ? 'bg-red-950/40 text-red-300' : 'bg-red-50 text-red-700'
                                                                        }`}>
                                                                            <span className="select-none opacity-60 font-bold">−</span>
                                                                            <span>{log.oldValue}</span>
                                                                        </div>
                                                                    )}
                                                                    {log.newValue && (
                                                                        <div className={`px-3 py-1 flex items-start gap-2 ${
                                                                            darkMode ? 'bg-green-950/40 text-green-300' : 'bg-green-50 text-green-700'
                                                                        }`}>
                                                                            <span className="select-none opacity-60 font-bold">+</span>
                                                                            <span>{log.newValue}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className={`text-center py-12 ${
                                            darkMode ? 'text-gray-400' : 'text-gray-500'
                                        }`}>
                                            <GitCommit className={`w-10 h-10 mx-auto mb-2 ${
                                                darkMode ? 'text-gray-600' : 'text-gray-300'
                                            }`} />
                                            <p className="text-sm">No commits yet</p>
                                            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                                Changes to this task will appear here
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === "history" && (
                                <div className="space-y-4">
                                    {systemLogs.length > 0 ? (
                                        <div className="relative">
                                            {/* Timeline line */}
                                            <div className={`absolute left-[15px] top-0 bottom-0 w-[2px] ${
                                                darkMode ? 'bg-gray-700' : 'bg-gray-200'
                                            }`} />

                                            {systemLogs.map((log, idx) => (
                                                <div key={log.id || idx} className="relative flex gap-4 pb-1 group">
                                                    {/* Audit dot */}
                                                    <div className="relative z-10 mt-1">
                                                        <div className={`w-8 h-8 rounded-full ${getCommitColor(log.action)} flex items-center justify-center shadow-sm`}>
                                                            <History className="w-4 h-4 text-white" />
                                                        </div>
                                                    </div>

                                                    {/* Audit card */}
                                                    <div className={`flex-1 mb-3 rounded-lg border transition ${
                                                        darkMode
                                                            ? 'bg-gray-800 border-gray-700 group-hover:border-gray-600'
                                                            : 'bg-white border-gray-200 group-hover:border-gray-300'
                                                    }`}>
                                                        {/* Header */}
                                                        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
                                                            darkMode ? 'border-gray-700' : 'border-gray-100'
                                                        }`}>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${
                                                                    log.action === 'TASK_CREATED'
                                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                                        : log.action === 'STATUS_CHANGED'
                                                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                                                }`}>
                                                                    {log.action}
                                                                </span>
                                                                {log.fieldName && (
                                                                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                        Updated <code className="font-mono font-bold">{log.fieldName}</code>
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                {getRelativeTime(log.createdAt)}
                                                            </span>
                                                        </div>

                                                        {/* Card body */}
                                                        <div className="px-4 py-2.5">
                                                            <div className="flex items-center gap-2 mb-1.5">
                                                                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[8px] font-bold">
                                                                    {(log.userName || 'S')[0]}
                                                                </div>
                                                                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                    By <span className="font-semibold">{log.userName || 'System'}</span>
                                                                </span>
                                                            </div>

                                                            {log.description && (
                                                                <p className={`text-xs pl-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                                    {log.description}
                                                                </p>
                                                            )}

                                                            {/* Diff block */}
                                                            {log.fieldName && (
                                                                <div className={`mt-2.5 ml-6 rounded-md border overflow-hidden font-mono text-xs ${
                                                                    darkMode ? 'border-gray-700' : 'border-gray-200'
                                                                }`}>
                                                                    {log.oldValue && (
                                                                        <div className={`px-3 py-1 flex items-start gap-2 ${
                                                                            darkMode ? 'bg-red-950/40 text-red-300' : 'bg-red-50 text-red-700'
                                                                        }`}>
                                                                            <span className="select-none opacity-60 font-bold">−</span>
                                                                            <span>{log.oldValue}</span>
                                                                        </div>
                                                                    )}
                                                                    {log.newValue && (
                                                                        <div className={`px-3 py-1 flex items-start gap-2 ${
                                                                            darkMode ? 'bg-green-950/40 text-green-300' : 'bg-green-50 text-green-700'
                                                                        }`}>
                                                                            <span className="select-none opacity-60 font-bold">+</span>
                                                                            <span>{log.newValue}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className={`text-center py-12 ${
                                            darkMode ? 'text-gray-400' : 'text-gray-500'
                                        }`}>
                                            <History className={`w-10 h-10 mx-auto mb-2 ${
                                                darkMode ? 'text-gray-600' : 'text-gray-300'
                                            }`} />
                                            <p className="text-sm">No history logs yet</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className={`border-t p-4 ${
                    darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
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
                                    onClick={async () => {
                                        const isConfirmed = await confirm({
                                            title: 'Cancel Task',
                                            message: 'Are you sure you want to cancel this task?',
                                            confirmText: 'Yes, Cancel',
                                            variant: 'danger'
                                        });
                                        if (isConfirmed) {
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

                            {taskData?.status === "COMPLETED" && onCloneTask && (
                                <button
                                    onClick={() => {
                                        if (taskData) {
                                            onCloneTask(taskData);
                                            onClose();
                                        }
                                    }}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-2 text-sm font-semibold"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Clone & Reopen
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