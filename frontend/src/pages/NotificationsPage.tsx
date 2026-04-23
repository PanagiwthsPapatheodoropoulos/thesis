/**
 * @file NotificationsPage.jsx
 * @description Page component for viewing and managing user notifications.
 */
// src/pages/NotificationsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCircle, AlertTriangle, Info, XCircle, RefreshCw } from 'lucide-react';
import { notificationsAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket, EVENT_TYPES } from '../contexts/WebSocketProvider';
import { useTheme } from '../contexts/ThemeContext';
import type { Notification } from '../types';

/**
 * NotificationsPage Component
 * 
 * Subscribes to real-time notification events via WebSockets.
 * Allows users to filter, view, and mark notifications as read.
 * 
 * @returns {React.ReactElement} The notifications UI.
 */
const NotificationsPage = () => {
  const { user } = useAuth();
  // Destructure ready state
  const { connected, ready, subscribe } = useWebSocket();
  const { darkMode } = useTheme();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState('ALL');

  const unreadCount = notifications.filter(n => !n.isRead).length;

  /**
   * Fetches the user's initial notification history.
   * 
   * @async
   * @function fetchNotifications
   * @returns {Promise<void>}
   */
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const data = await notificationsAPI.getByUser(user.id);
      setNotifications(data);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Fetch only when WebSocket is Ready (removes render-based polling)
  useEffect(() => {
    if (!ready || !user?.id) return;
    
    fetchNotifications(); 
    //logic relies on WebSocket events below
  }, [ready, user?.id, fetchNotifications]);

  // Unified WebSocket Event Listeners
  useEffect(() => {
    if (!ready) return;
    
    const unsubs = [
      // 1. New Notification
      subscribe(EVENT_TYPES.NEW_NOTIFICATION, (notification) => {
        setNotifications(prev => [notification, ...prev]);
      }),
      
      // 2. Read Receipt (from other devices/tabs)
      subscribe(EVENT_TYPES.NOTIFICATION_READ, (data: any) => {        
        if (data.action === 'mark_read' && data.notificationId) {
          setNotifications(prev => 
            prev.map(n => 
              n.id.toString() === data.notificationId.toString()
                ? { ...n, isRead: true, readAt: new Date().toISOString() }
                : n
            )
          );
        } else if (data.action === 'mark_all_read') {
          const now = new Date().toISOString();
          setNotifications(prev => 
            prev.map(n => ({ ...n, isRead: true, readAt: now }))
          );
        }
      })
    ];
    
    return () => unsubs.forEach(fn => fn());
  }, [ready, subscribe]);

  /**
   * Marks a single notification as read both locally and on the server.
   * 
   * @async
   * @function handleMarkAsRead
   * @param {string|number} id - The notification ID.
   * @returns {Promise<void>}
   */
  const handleMarkAsRead = async (id) => {
    try {      
      // Optimistic update
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
      );
      
      await notificationsAPI.markAsRead(id);
      
    } catch (error: any) {
      fetchNotifications();
    }
  };

  /**
   * Marks all of the user's unread notifications as read.
   * 
   * @async
   * @function handleMarkAllAsRead
   * @returns {Promise<void>}
   */
  const handleMarkAllAsRead = async () => {
    try {      
      // Optimistic update
      const now = new Date().toISOString();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: now })));
      
      await notificationsAPI.markAllAsRead(user.id);
      
    } catch (error: any) {
      fetchNotifications();
    }
  };

  const filteredNotifications = filter === 'ALL' 
    ? notifications 
    : filter === 'UNREAD' 
    ? notifications.filter(n => !n.isRead)
    : notifications.filter(n => n.isRead);

  /**
   * Gets the semantic icon for a notification's severity.
   * 
   * @function getSeverityIcon
   * @param {string} severity - The severity level.
   * @returns {React.ReactElement} The lucide-react icon component.
   */
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'SUCCESS': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'WARNING': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'ERROR': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  /**
   * Retrieves the CSS styling classes based on severity and read status.
   * 
   * @function getSeverityStyles
   * @param {string} severity - The severity level.
   * @param {boolean} isRead - Whether the notification has been read.
   * @returns {string} The CSS class string.
   */
  const getSeverityStyles = (severity, isRead) => {
    // Styles logic remains unchanged
    if (darkMode) {
      if (isRead) {
        return 'bg-gray-800/50 border-gray-700 opacity-60';
      }
      switch (severity) {
        case 'SUCCESS': return 'bg-green-900/30 border-green-600/50';
        case 'WARNING': return 'bg-orange-900/30 border-orange-600/50';
        case 'ERROR': return 'bg-red-900/30 border-red-600/50';
        default: return 'bg-blue-900/30 border-blue-600/50';
      }
    } else {
      if (isRead) {
        return 'bg-gray-50 border-gray-300 opacity-60';
      }
      switch (severity) {
        case 'SUCCESS': return 'bg-green-50 border-green-300';
        case 'WARNING': return 'bg-orange-50 border-orange-300';
        case 'ERROR': return 'bg-red-50 border-red-300';
        default: return 'bg-blue-50 border-blue-300';
      }
    }
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-3xl font-bold flex items-center gap-3 ${
            darkMode ? 'text-gray-100' : 'text-gray-900'
          }`}>
            Notifications
            {/*UI Update Using ready state */}
            <span className={`flex items-center gap-1 text-sm ${ready ? 'text-green-600' : 'text-yellow-500'}`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${ready ? 'bg-green-600' : 'bg-yellow-500'}`} /> 
              {ready ? 'Live' : 'Connecting...'}
            </span>
          </h1>
          <p className={`mt-1 ${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchNotifications}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              darkMode
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Mark All Read ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        {['ALL', 'UNREAD', 'READ'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2.5 rounded-lg font-semibold transition shadow-sm ${
              filter === f 
                ? 'bg-indigo-600 text-white border-2 border-indigo-600 scale-105'
                : darkMode
                  ? 'bg-gray-700 text-gray-200 border-2 border-gray-600 hover:bg-gray-600'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {f}
            {f === 'UNREAD' && unreadCount > 0 && ` (${unreadCount})`}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.map((notification, index) => {
          const isRead = notification.isRead;
          const severity = notification.severity;
          
          return (
            <div
              key={notification.id}
              style={{ animationDelay: `${index * 50}ms` }}
              className={`rounded-lg p-5 transition notification-slide hover:shadow-lg border-2 ${
                getSeverityStyles(severity, isRead)
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getSeverityIcon(notification.severity)}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className={`font-bold text-lg mb-1 ${
                        darkMode ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        {notification.title}
                      </h3>
                      <p className={`text-sm mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {notification.message}
                      </p>
                      <p className={`text-xs ${
                        darkMode ? 'text-gray-500' : 'text-gray-600'
                      }`}>
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className={`ml-4 px-4 py-2 rounded-lg transition text-xs font-semibold whitespace-nowrap border-2 ${
                          darkMode
                            ? 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredNotifications.length === 0 && (
        <div className={`text-center py-12 ${
          darkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          <Bell className={`w-16 h-16 mx-auto mb-4 ${
            darkMode ? 'text-gray-600' : 'text-gray-400'
          }`} />
          <p>No notifications</p>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;