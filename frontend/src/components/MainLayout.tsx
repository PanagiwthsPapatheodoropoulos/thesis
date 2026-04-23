
// src/components/MainLayout.jsx - FIXED with Pending Assignment Counter
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, CheckSquare, Users, UserCircle,
    Settings, LogOut, Bell, MessageSquare, Briefcase,
    Menu, X, ChevronDown, ChevronUp, User, Brain, Users as UsersIcon,
    Zap, Building2, ShieldAlert, RefreshCw, AlertTriangle,
    Moon, Sun, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notificationsAPI, chatAPI, employeesAPI, tasksAPI, assignmentsAPI } from '../utils/api';
import { useWebSocket, EVENT_TYPES } from '../contexts/WebSocketProvider';
import { useTheme } from '../contexts/ThemeContext';
import type { Notification } from '../types';

interface MainLayoutProps {
  children?: React.ReactNode;
}

interface MenuItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  roles: string[];
  badge?: number;
}

/**
 * Main application layout component that wraps all authenticated pages.
 * Handles the responsive sidebar, top navigation bar, WebSocket real-time counters,
 * and displays notifications as well as user profile menus.
 *
 * @component
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child routes rendered inside the layout.
 * @returns {JSX.Element}
 */
const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { user, logout } = useAuth();
    const { connected, ready, subscribe } = useWebSocket();
    const navigate = useNavigate();
    const location = useLocation();
    const { darkMode, toggleDarkMode } = useTheme();
    const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
    
    // State for counters
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
    const [pendingAssignmentCount, setPendingAssignmentCount] = useState<number>(0);
    const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
    const [hasEmployeeProfile, setHasEmployeeProfile] = useState<boolean>(false);
    const [showRefreshPrompt, setShowRefreshPrompt] = useState<boolean>(false);
    const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
    const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
    const [showNotifications, setShowNotifications] = useState<boolean>(false);
    
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastFetchRef = useRef(0);
    const dataRef = useRef({ 
        assignments: [], 
        lastFetch: 0, 
        myEmployeeId: null,
        pendingAssignments: 0
    });

    const isEmployee = user?.role === 'EMPLOYEE';
    const isManager = user?.role === 'MANAGER';
    const isAdmin = user?.role === 'ADMIN';

    /**
     * Fetches the number of pending assignments assigned to the current employee.
     */
    const fetchPendingAssignments = useCallback(async () => {
        if (!user?.id || user?.role === 'USER') return;
        
        try {
            // Get employee profile if not already cached
            let empId = dataRef.current.myEmployeeId;
            if (!empId) {
                try {
                    const profile = await employeesAPI.getByUserId(user.id);
                    empId = profile.id;
                    dataRef.current.myEmployeeId = empId;
                } catch (error: any) {
                    return; // No employee profile
                }
            }
            
            // Fetch assignments
            const assignments = await assignmentsAPI.getByEmployee(empId);
            
            // Count PENDING assignments only
            const pendingCount = assignments.filter(a => a.status === 'PENDING').length;
            
            // Update if changed
            if (dataRef.current.pendingAssignments !== pendingCount) {
                dataRef.current.pendingAssignments = pendingCount;
                setPendingAssignmentCount(pendingCount);
            }
        } catch (error: any) {
            console.error('Error fetching pending assignments:', error);
        }
    }, [user?.id, user?.role]);

    /**
     * Fetches unread notification, chat, and task request counts.
     * Debounced to prevent excessive API calls.
     */
    const fetchCounts = useCallback(async () => {
        if (!user?.id) return;
        
        const now = Date.now();
        if (now - lastFetchRef.current < 1500) return;
        lastFetchRef.current = now;
        
        try {
            const [notifData, chatCount] = await Promise.all([
                notificationsAPI.getUnread(user.id).catch(() => []),
                chatAPI.getUnreadCount().catch(() => 0)
            ]);
            
            setUnreadCount(notifData.length);
            setRecentNotifications(notifData.slice(0, 5));
            setUnreadChatCount(chatCount);
            
            // Fetch pending task requests for admins/managers
            if (user.role === 'ADMIN' || user.role === 'MANAGER') {
                try {
                    const allTasks = await tasksAPI.getAll();
                    const pendingRequests = allTasks.filter(t => 
                        t.title.startsWith('[REQUEST]') && t.status === 'PENDING'
                    ).length;
                    setPendingRequestsCount(pendingRequests);
                } catch (error: any) {
                    console.error('Error fetching task requests:', error);
                }
            }
            
            // Fetch pending assignments for employees
            await fetchPendingAssignments();
            
        } catch (error: any) {
            console.error('Error fetching counts:', error);
        }
    }, [user?.id, user?.role, pendingRequestsCount, fetchPendingAssignments]);

    // Initial fetch on WebSocket ready
    useEffect(() => {
        if (!ready || !user?.id) return;
        
        fetchCounts();
    }, [ready, user?.id, fetchCounts]);

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!user?.id) return;
            try {
                const empProfile = await employeesAPI.getByUserId(user.id);
                setUserProfileImage(empProfile.profileImageUrl);
            } catch (error: any) {
                console.log('No employee profile or image');
            }
        };
        
        fetchUserProfile();
        
        const handleProfileUpdate = () => {
            fetchUserProfile();
        };

        window.addEventListener('profileUpdated', handleProfileUpdate);
        
        return () => {
            window.removeEventListener('profileUpdated', handleProfileUpdate);
        };
    }, [user?.id]);

    // Subscribe to profile updates
    useEffect(() => {
        if (!connected) return;

        const unsubProfileUpdate = subscribe(EVENT_TYPES.PROFILE_UPDATED, (data: any) => {
            if (data.userId === user?.id) {
                window.dispatchEvent(new CustomEvent('profileUpdated', { detail: data }));
            }
        });

        return () => {
            unsubProfileUpdate();
        };
    }, [connected, subscribe, user?.id]);

    // WebSocket subscriptions with optimistic updates
    useEffect(() => {
        if (!ready) return;
        
        const unsubs = [
            subscribe(EVENT_TYPES.NEW_NOTIFICATION, (notification) => {                
                setUnreadCount(prev => prev + 1);
                setRecentNotifications(prev => [notification, ...prev.slice(0, 4)]);

                if (notification.type === 'TASK_REQUEST' && 
                    (user?.role === 'ADMIN' || user?.role === 'MANAGER')) {
                    setPendingRequestsCount(prev => prev + 1);
                }

                if (notification.type === 'TASK_REQUEST' && Notification.permission === 'granted') {
                    new Notification('New Task Request', {
                        body: notification.message,
                        icon: '/logo.png'
                    });
                }

                if (notification.type === 'ROLE_PROMOTION') {
                    setShowRefreshPrompt(true);
                    setHasEmployeeProfile(true);
                }
            }),
            
            subscribe(EVENT_TYPES.NOTIFICATION_READ, (data: any) => {                
                if (data.action === 'mark_all_read') {
                    setUnreadCount(0);
                    setRecentNotifications([]);
                } else if (data.action === 'mark_read') {
                    setUnreadCount(prev => Math.max(0, prev - 1));
                    setRecentNotifications(prev => prev.filter(n => n.id !== data.notificationId));
                }
            }),
            
            subscribe(EVENT_TYPES.NEW_MESSAGE, () => {
                if (location.pathname !== '/chat') {
                    setUnreadChatCount(prev => prev + 1);
                }
            }),
            
            // Listen for new assignments
            subscribe(EVENT_TYPES.ASSIGNMENT_CREATED, (assignment) => {                
                // Only increment if it's for THIS user and PENDING
                if (assignment.status === 'PENDING') {
                    setPendingAssignmentCount(prev => prev + 1);
                    dataRef.current.pendingAssignments += 1;
                }
            }),
            
            // Listen for accepted assignments
            subscribe(EVENT_TYPES.ASSIGNMENT_ACCEPTED, (assignment) => {
                // Decrement counter
                setPendingAssignmentCount(prev => Math.max(0, prev - 1));
                dataRef.current.pendingAssignments = Math.max(0, dataRef.current.pendingAssignments - 1);
            }),
            
            //Listen for task status changes (started from tasks page)
            subscribe(EVENT_TYPES.TASK_STATUS_CHANGED, async (task) => {                
                // If task was started (PENDING -> IN_PROGRESS), check if user has pending assignment
                if (task.status === 'IN_PROGRESS') {
                    try {
                        // Fetch employee ID if not cached
                        let empId = dataRef.current.myEmployeeId;
                        if (!empId) {
                            const profile = await employeesAPI.getByUserId(user.id);
                            empId = profile.id;
                            dataRef.current.myEmployeeId = empId;
                        }
                        
                        // Check if this task had a pending assignment for this employee
                        const assignments = await assignmentsAPI.getByTask(task.id);
                        const myAssignment = assignments.find(a => 
                            a.employeeId === empId && a.status === 'PENDING'
                        );
                        
                        if (myAssignment) {
                            // User started task from tasks page, decrement counter
                            setPendingAssignmentCount(prev => Math.max(0, prev - 1));
                            dataRef.current.pendingAssignments = Math.max(0, dataRef.current.pendingAssignments - 1);
                        }
                    } catch (error: any) {
                        console.error('Error checking assignment status:', error);
                    }
                }
            })
        ];
        
        return () => unsubs.forEach(fn => fn());
    }, [ready, subscribe, user?.role, user?.id, location.pathname]);

    // Focus handler
    useEffect(() => {
        const handleFocus = () => {
            fetchCounts();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) handleFocus();
        });

        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchCounts]);

    // Check employee profile
    useEffect(() => {
        if (!user?.id) return;

        const checkProfile = async () => {
            if (user.role === 'ADMIN' || user.role === 'MANAGER') {
                setHasEmployeeProfile(true);
                return;
            }

            if (user.role === 'USER') {
                setHasEmployeeProfile(false);
                return;
            }

            try {
                await employeesAPI.getByUserId(user.id);
                setHasEmployeeProfile(true);
            } catch (error: any) {
                setHasEmployeeProfile(false);
            }
        };

        checkProfile();
    }, [user?.id, user?.role]);

    //Clear assignment counter when viewing assignments page
    useEffect(() => {
        if (location.pathname === '/chat') {
            setUnreadChatCount(0);
        }
        if (location.pathname === '/assignments') {
            // Clear counter when viewing assignments page
            setPendingAssignmentCount(0);
            dataRef.current.pendingAssignments = 0;
        }
        if (location.pathname === '/notifications') {
            setTimeout(fetchCounts, 1000);
        }
    }, [location.pathname, fetchCounts]);

    useEffect(() => {
        if (!connected) return;

        const handleRolePromotion = (data) => {
            window.location.reload();
        };

        const unsub = subscribe(EVENT_TYPES.USER_PROMOTED, handleRolePromotion);
        
        return () => unsub();
    }, [connected, subscribe]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleMarkNotificationAsRead = async (notifId, e) => {
        e?.stopPropagation();
        
        setRecentNotifications(prev => prev.filter(n => n.id !== notifId));
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        try {
            await notificationsAPI.markAsRead(notifId);
        } catch (error: any) {
            fetchCounts();
        }
    };

    const baseMenuItems: MenuItem[] = [
        { path: '/profile', icon: User, label: 'My Profile', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'USER'] }
    ];

    const employeeMenuItems: MenuItem[] = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
        { 
            path: '/tasks', 
            icon: CheckSquare, 
            label: 'Tasks', 
            roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
            badge: (user?.role === 'ADMIN' || user?.role === 'MANAGER') && pendingRequestsCount > 0 
                ? pendingRequestsCount 
                : undefined
        },
        { path: '/employees', icon: Users, label: 'Employees', roles: ['ADMIN', 'MANAGER'] },
        { 
            path: '/workload', 
            icon: Activity,
            label: 'Workload', 
            roles: ['ADMIN', 'MANAGER'] 
        },
        { 
            path: '/ai-insights', 
            icon: Brain,
            label: 'AI Insights', 
            roles: ['ADMIN', 'MANAGER'] 
        },
        { path: '/departments', icon: Building2, label: 'Departments', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
        { path: '/teams', icon: UsersIcon, label: 'Teams', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
        { 
            path: '/assignments', 
            icon: Briefcase, 
            label: 'Assignments', 
            roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
            badge: pendingAssignmentCount > 0 ? pendingAssignmentCount : undefined
        },
        { 
            path: '/chat', 
            icon: MessageSquare, 
            label: 'Chat', 
            roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'], 
            badge: unreadChatCount > 0 ? unreadChatCount : undefined
        },
        { 
            path: '/notifications', 
            icon: Bell, 
            label: 'Notifications', 
            roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'], 
            badge: unreadCount > 0 ? unreadCount : undefined
        },
    ];

    const menuItems = (hasEmployeeProfile || user?.role === 'ADMIN' || user?.role === 'MANAGER')
        ? [...employeeMenuItems, ...baseMenuItems]
        : baseMenuItems;

    const filteredMenuItems = menuItems.filter(item => item.roles.includes(user?.role));

    const showWarningBanner = !hasEmployeeProfile && user?.role === 'USER';
    const topOffset = showWarningBanner ? '112px' : '64px';

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Warning Banner */}
            {showWarningBanner && (
                <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white px-4 py-3 text-center font-medium z-50">
                    <div className="flex items-center justify-center gap-2">
                        <ShieldAlert className="w-5 h-5" />
                        <span>
                            You are registered as a USER. Contact an administrator to create your EMPLOYEE profile for full access.
                        </span>
                    </div>
                </div>
            )}

            {/* Top Navigation - Rest remains the same... */}
            <div 
                className={`${
                    darkMode 
                        ? 'bg-gray-800 border-gray-700' 
                        : 'bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 border-indigo-700'
                } border-b fixed w-full z-40 shadow-lg`}
                style={{ top: showWarningBanner ? '48px' : '0' }}
            >
                <div className="flex items-center justify-between px-4 h-16">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="lg:hidden p-2 hover:bg-white/10 rounded-lg text-white transition-transform active:scale-95"
                            aria-label="Toggle menu"
                        >
                            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">Smart Allocation</h1>
                                {user?.companyName && (
                                    <p className="text-xs text-indigo-200 flex items-center gap-1">
                                        <Building2 className="w-3 h-3" />
                                        {user.companyName}
                                    </p>
                                )}
                                <p className="text-xs text-indigo-300 flex items-center gap-1">
                                    {ready ? (
                                        <>
                                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                            Real-time connected
                                        </>
                                    ) : connected ? (
                                        <>
                                            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                                            Connecting...
                                        </>
                                    ) : (
                                        <>
                                            <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                                            Disconnected
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {(hasEmployeeProfile || user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                            <>
                                <button
                                    onClick={() => navigate('/chat')}
                                    className="relative p-2 hover:bg-white/10 rounded-lg text-white"
                                >
                                    <MessageSquare className="w-6 h-6" />
                                    {unreadChatCount > 0 && (
                                        <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                                            {unreadChatCount}
                                        </span>
                                    )}
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
                                        className="relative p-2 hover:bg-white/10 rounded-lg text-white"
                                    >
                                        <Bell className="w-6 h-6" />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </button>
                                    {showNotifications && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                                            <div className={`absolute right-0 mt-2 w-80 rounded-lg shadow-xl border z-50 max-h-96 overflow-hidden ${
                                                darkMode 
                                                    ? 'bg-gray-800 border-gray-700' 
                                                    : 'bg-white border-gray-200'
                                            }`}>
                                                {/* Header */}
                                                <div className={`p-3 border-b flex items-center justify-between ${
                                                    darkMode 
                                                        ? 'border-gray-700' 
                                                        : 'border-gray-200'
                                                }`}>
                                                    <h3 className={`font-semibold ${
                                                        darkMode ? 'text-gray-100' : 'text-gray-900'
                                                    }`}>
                                                        Notifications
                                                    </h3>
                                                    {unreadCount > 0 && (
                                                        <button
                                                            onClick={async () => {
                                                                setRecentNotifications([]);
                                                                setUnreadCount(0);
                                                                await notificationsAPI.markAllAsRead(user.id);
                                                                setTimeout(fetchCounts, 500);
                                                            }}
                                                            className={`text-xs transition ${
                                                                darkMode 
                                                                    ? 'text-indigo-400 hover:text-indigo-300' 
                                                                    : 'text-indigo-600 hover:text-indigo-800'
                                                            }`}
                                                        >
                                                            Mark all as read
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Notifications List */}
                                                <div className="max-h-80 overflow-y-auto">
                                                    {recentNotifications.length > 0 ? (
                                                        recentNotifications.map(notif => (
                                                            <div
                                                                key={notif.id}
                                                                className={`p-3 border-b cursor-pointer transition ${
                                                                    darkMode 
                                                                        ? 'border-gray-700 hover:bg-gray-700/50' 
                                                                        : 'border-gray-100 hover:bg-gray-50'
                                                                }`}
                                                                onClick={() => { 
                                                                    navigate('/notifications'); 
                                                                    setShowNotifications(false); 
                                                                }}
                                                            >
                                                                <div className="flex items-start gap-2">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className={`text-sm font-medium truncate ${
                                                                            darkMode ? 'text-gray-100' : 'text-gray-900'
                                                                        }`}>
                                                                            {notif.title}
                                                                        </p>
                                                                        <p className={`text-xs line-clamp-2 mt-1 ${
                                                                            darkMode ? 'text-gray-400' : 'text-gray-600'
                                                                        }`}>
                                                                            {notif.message}
                                                                        </p>
                                                                        <p className={`text-xs mt-1 ${
                                                                            darkMode ? 'text-gray-500' : 'text-gray-400'
                                                                        }`}>
                                                                            {new Date(notif.createdAt).toLocaleString()}
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => handleMarkNotificationAsRead(notif.id, e)}
                                                                        className={`text-xs whitespace-nowrap transition ${
                                                                            darkMode 
                                                                                ? 'text-indigo-400 hover:text-indigo-300' 
                                                                                : 'text-indigo-600 hover:text-indigo-800'
                                                                        }`}
                                                                    >
                                                                        Mark read
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className={`p-6 text-center ${
                                                            darkMode ? 'text-gray-400' : 'text-gray-500'
                                                        }`}>
                                                            <Bell className={`w-12 h-12 mx-auto mb-2 ${
                                                                darkMode ? 'text-gray-600' : 'text-gray-300'
                                                            }`} />
                                                            <p className="text-sm">No new notifications</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Footer */}
                                                <div className={`p-2 border-t ${
                                                    darkMode ? 'border-gray-700' : 'border-gray-200'
                                                }`}>
                                                    <button
                                                        onClick={() => {
                                                            navigate('/notifications');
                                                            setShowNotifications(false);
                                                        }}
                                                        className={`w-full text-center text-sm py-2 transition ${
                                                            darkMode 
                                                                ? 'text-indigo-400 hover:text-indigo-300' 
                                                                : 'text-indigo-600 hover:text-indigo-800'
                                                        }`}
                                                    >
                                                        View all notifications
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        )}

                        <button
                            onClick={toggleDarkMode}
                            className="p-2 hover:bg-white/10 rounded-lg text-white transition"
                            title={darkMode ? 'Light Mode' : 'Dark Mode'}
                        >
                            {darkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
                        </button>
                        
                        
                        <div className="relative">
                            <button
                                onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
                                className="flex items-center gap-3 hover:bg-white/10 rounded-lg p-2 transition"
                            >
                                {userProfileImage ? (
                                <img 
                                    key={`nav-avatar-${userProfileImage}`}
                                    src={userProfileImage} 
                                    alt={user?.username}
                                    className="w-10 h-10 rounded-full object-cover border-2 border-white/20"
                                />
                                ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                    {user?.username?.[0]?.toUpperCase()}
                                </div>
                                )}
                                <div className="hidden md:block text-left">
                                <p className="text-sm font-medium text-white">{user?.username}</p>
                                <p className="text-xs text-indigo-200">{user?.role}</p>
                                </div>
                                {showUserMenu ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
                            </button>

                            {showUserMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                                    <div 
                                    className={`absolute right-0 mt-2 w-48 rounded-lg shadow-xl py-2 z-50 border-2 ${
                                        darkMode 
                                        ? 'bg-gray-800 border-gray-600' 
                                        : 'bg-white border-gray-200'
                                    }`}
                                    >
                                    <button
                                        onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition ${
                                        darkMode
                                            ? 'text-gray-200 hover:bg-gray-700'
                                            : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        <User className="w-4 h-4" />
                                        My Profile
                                    </button>
                                    
                                    <button
                                        onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition ${
                                        darkMode
                                            ? 'text-gray-200 hover:bg-gray-700'
                                            : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        <Settings className="w-4 h-4" />
                                        Settings
                                    </button>
                                    
                                    <hr className={`my-2 ${darkMode ? 'border-gray-600' : 'border-gray-200'}`} />
                                    
                                    <button
                                        onClick={() => { handleLogout(); setShowUserMenu(false); }}
                                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition ${
                                        darkMode
                                            ? 'text-red-400 hover:bg-red-900/20'
                                            : 'text-red-600 hover:bg-red-50'
                                        }`}
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Logout
                                    </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar */}
            <div 
                className={`fixed left-0 ${
                    darkMode 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-gradient-to-b from-gray-900 via-indigo-900 to-purple-900 border-indigo-700'
                } border-r w-64 z-30 transition-transform duration-300 ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                } lg:translate-x-0`}
                style={{ 
                    top: topOffset,
                    height: `calc(100vh - ${topOffset})`
                }}
            >
                <nav className="p-4 space-y-2 overflow-y-auto h-full">
                    {filteredMenuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => {
                                    navigate(item.path);
                                    setSidebarOpen(false);
                                }}
                                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-all ${
                                    isActive 
                                    ? darkMode
                                        ? 'bg-indigo-700 text-white shadow-lg'
                                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                                    : darkMode
                                        ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{item.label}</span>
                                </div>
                                {item.badge > 0 && (
                                    <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Main Content Area */}
            <div 
                className={`transition-all duration-300 min-h-screen flex flex-col ${
                    darkMode ? 'bg-gray-900' : 'bg-gray-50'
                }`}
                style={{ 
                    marginLeft: typeof window !== 'undefined' && window.innerWidth >= 1024 ? '16rem' : '0',
                    paddingTop: topOffset,
                    height: `calc(100vh - ${topOffset})`
                }}
            >
                <div className={`p-6 flex-1 ${darkMode ? 'text-gray-100' : ''}`}
                    style={{ paddingBottom: '100px' }}
                >
                    {children || <Outlet />}
                </div>
            </div>
            
            {/* Promotion Modal */}
            {showRefreshPrompt && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 fade-in">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl scale-in">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">🎉 You've Been Promoted!</h3>
                            <p className="text-gray-600">
                                An administrator has created an employee profile for you.
                            </p>
                        </div>

                        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <RefreshCw className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-blue-900 mb-1">Re-Login Required</p>
                                    <p className="text-sm text-blue-800">
                                        Please log in again to apply your new role and access all employee features.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg hover:shadow-lg transition font-semibold flex items-center justify-center gap-2"
                        >
                            <LogOut className="w-5 h-5" />
                            Proceed to Login
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainLayout;