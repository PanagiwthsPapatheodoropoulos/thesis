/**
 * @file UserDashboardPage.jsx
 * @description Landing page for basic users waiting for employee profile assignment.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Clock, UserCircle, CheckCircle, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { employeesAPI, notificationsAPI, usersAPI } from '../utils/api';
import { formatDate } from '../utils/dateUtils';
import { useWebSocket, EVENT_TYPES } from '../contexts/WebSocketProvider';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';

/**
 * UserDashboardPage Component
 * 
 * Displays connection status, notifications, and prompts the user to wait
 * or re-login once their employee profile is prepared by an admin.
 * 
 * @returns {React.ReactElement} The user dashboard UI.
 */
const UserDashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { connected, ready, subscribe } = useWebSocket();
  
  const [hasEmployeeProfile, setHasEmployeeProfile] = useState<boolean>(false);
  const [checkingProfile, setCheckingProfile] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showPromotionModal, setShowPromotionModal] = useState<boolean>(false);
  const [showRejectionModal, setShowRejectionModal] = useState<boolean>(false);
  const [joinCode, setJoinCode] = useState<string>('');
  const [joining, setJoining] = useState<boolean>(false);
  const { showToast } = useToast();
  
  const lastCheckRef = useRef(0);
  const mountedRef = useRef(true);
  const pollingIntervalRef = useRef<any>(null); // Polling backup
  const promotionDetectedRef = useRef(false); // Prevent duplicate modals

  /**
   * Re-checks whether the current user has an associated employee profile.
   * 
   * @async
   * @function checkProfile
   * @param {boolean} [force=false] - Whether to bypass the cache/throttle interval.
   * @returns {Promise<void>}
   */
  const checkProfile = useCallback(async (force = false) => {
    if (!user?.id || !mountedRef.current) return;
    
    const now = Date.now();
    if (!force && now - lastCheckRef.current < 2000) return;
    lastCheckRef.current = now;
    
    try {
      await employeesAPI.getByUserId(user.id);
      
      if (mountedRef.current) {
        const wasUser = !hasEmployeeProfile;
        setHasEmployeeProfile(true);
        
        // If profile was just created, show modal
        if (wasUser && !promotionDetectedRef.current) {
          promotionDetectedRef.current = true;
          setShowPromotionModal(true);
          
          // Stop polling once detected
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      }
    } catch (error: any) {
      if (mountedRef.current) {
        setHasEmployeeProfile(false);
      }
    } finally {
      if (mountedRef.current) {
        setCheckingProfile(false);
      }
    }
  }, [user?.id, hasEmployeeProfile]);

  /**
   * Triggers the promotion modal when an employee profile is assigned.
   * 
   * @function handleUserPromotion
   * @param {Object} data - Promotion event payload.
   */
  const handleUserPromotion = useCallback((data) => {
    if (!mountedRef.current || promotionDetectedRef.current) return;
    
    promotionDetectedRef.current = true;
    
    // Force state updates immediately
    setHasEmployeeProfile(true);
    setShowPromotionModal(true);
    
    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  /**
   * Receives new real-time notifications via WebSocket.
   * 
   * @function handleNewNotification
   * @param {Object} notification - The incoming notification object.
   */
  const handleNewNotification = useCallback((notification) => {
    if (!mountedRef.current) return;
    
    // Check if it's a promotion notification
    if (notification.type === 'ROLE_PROMOTION') {
      handleUserPromotion(notification);
    } else if (notification.type === 'JOIN_REJECTED') {
      setShowRejectionModal(true);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
    
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
  }, [handleUserPromotion]);

  // Initial check on mount
  useEffect(() => {
    mountedRef.current = true;
    
    if (!user?.id) return;
    
    checkProfile();
    
    return () => {
      mountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [user?.id, checkProfile]);

  //WebSocket subscriptions
  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!mountedRef.current) return;
    
    const unsubPromotion = subscribe(EVENT_TYPES.USER_PROMOTED, (data: any) => {
      handleUserPromotion(data);
    });
    
    const unsubNotification = subscribe(EVENT_TYPES.NEW_NOTIFICATION, (data: any) => {
      handleNewNotification(data);
    });

    return () => {
      unsubPromotion();
      unsubNotification();
    };
  }, [ready, subscribe, handleUserPromotion, handleNewNotification]);

  //POLLING FALLBACK - Check every 30 seconds if no profile yet
  useEffect(() => {
    if (!user?.id || hasEmployeeProfile || promotionDetectedRef.current) return;
        
    pollingIntervalRef.current = setInterval(() => {
      if (!mountedRef.current || hasEmployeeProfile || promotionDetectedRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        return;
      }
      
      checkProfile(true); // Force check
    }, 30000); // Check every 30 seconds
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [user?.id, hasEmployeeProfile, checkProfile]);

  // Fetch initial notifications
  useEffect(() => {
    if (!user?.id || !mountedRef.current) return;
    
    notificationsAPI.getByUser(user.id)
      .then(data => {
        if (mountedRef.current) {
          setNotifications(data.slice(0, 5));
          if (data.some((n: any) => n.type === 'JOIN_REJECTED' && !n.read)) {
            setShowRejectionModal(true);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }
        }
      })
      .catch(console.error);
  }, [user?.id]);

  /**
   * Logs out the user and redirects to login, enforcing session refresh after promotion.
   * 
   * @function handleLogoutAndRelogin
   */
  const handleLogoutAndRelogin = () => {
    logout();
    navigate('/login');
  };

  const handleRetryJoin = async () => {
    if (!joinCode.trim() || !user?.id) return;
    setJoining(true);
    try {
      await usersAPI.joinCompany(user.id, joinCode.trim().toUpperCase());
      showToast('Successfully submitted join request!', 'success');
      setShowRejectionModal(false);
      setNotifications(prev => prev.filter(n => n.type !== 'JOIN_REJECTED'));
      if (!pollingIntervalRef.current) {
        checkProfile(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to join company. Check the code.', 'error');
    } finally {
      setJoining(false);
    }
  };

  if (checkingProfile && !hasEmployeeProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-8 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <UserCircle className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user?.username}!</h1>
            <p className="text-indigo-100 mt-1">You're registered as a basic user</p>
            <div className="flex items-center gap-2 mt-2">
              {ready ? (
                <>
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span className="text-sm text-green-200">Live connection active</span>
                </>
              ) : connected ? (
                <>
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                  <span className="text-sm text-yellow-200">Connecting...</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                  <span className="text-sm text-red-200">Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Waiting Status */}
      {!hasEmployeeProfile && !showPromotionModal && !showRejectionModal && (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900/30 rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-xl">
              <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400 flex-shrink-0 animate-pulse" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-yellow-900 dark:text-yellow-200 mb-2">⏳ Waiting for Employee Profile</h2>
              <p className="text-yellow-800 dark:text-yellow-400 mb-2">
                Contact an administrator to create your employee profile.
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-500">
                The system updates instantly when your profile is ready—no refresh needed!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Profile Ready (Static Banner) */}
      {hasEmployeeProfile && !showPromotionModal && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/30 rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-xl">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-green-900 dark:text-green-200 mb-2">✅ Profile Ready!</h2>
              <p className="text-green-800 dark:text-green-400 mb-4">
                Your employee profile has been created. Please re-login to access all features.
              </p>
              <button
                onClick={handleLogoutAndRelogin}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition font-semibold flex items-center gap-2 shadow-lg shadow-green-500/20 hover:shadow-green-500/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                <LogOut className="w-5 h-5" />
                Re-Login Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Table */}
      {notifications.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Notifications</h3>
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div key={notif.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700/30 border border-gray-100/50 dark:border-slate-700/50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{notif.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{notif.message}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    {formatDate(notif.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROMOTION MODAL */}
      {showPromotionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">🎉 You've Been Promoted!</h3>
              <p className="text-gray-600 dark:text-gray-300">
                An administrator created your employee profile!
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Re-Login Required</p>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Log in again to access all employee features.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleLogoutAndRelogin}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg hover:shadow-lg transition font-semibold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              <LogOut className="w-5 h-5" />
              Proceed to Login
            </button>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {showRejectionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Your request to join the company was declined or you were removed.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700/30 border border-gray-200 dark:border-slate-600 rounded-xl p-4 mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Have a new company code?
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter 10-character code"
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase tracking-widest text-center bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                maxLength={10}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleLogoutAndRelogin}
                className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition font-semibold"
              >
                Logout
              </button>
              <button
                onClick={handleRetryJoin}
                disabled={joining || joinCode.length < 5}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                {joining ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Retry Join'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboardPage;