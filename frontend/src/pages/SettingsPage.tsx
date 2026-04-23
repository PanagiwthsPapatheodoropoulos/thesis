/**
 * @file SettingsPage.jsx
 * @description Page component allowing users to manage account settings, security, and preferences.
 */
import React, { useState, useEffect } from 'react';
import { User, Bell, Lock, Globe, Trash2, Shield, AlertTriangle, Building2, FileText, ExternalLink, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import LegalDocumentContent from '../components/LegalDocumentContent';
import { LEGAL_DOC_ORDER, LEGAL_DOCUMENTS, type LegalDocumentType } from '../utils/legalContent';


/**
 * SettingsPage Component
 * 
 * Provides a tabbed interface for profile management, notification preferences,
 * password updates, and account deletion workflows.
 * 
 * @returns {React.ReactElement} The settings UI.
 */
const SettingsPage = () => {
  const { user, logout, updateUser } = useAuth();
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showLeaveTeamModal, setShowLeaveTeamModal] = useState<boolean>(false);
  const [showLegalModal, setShowLegalModal] = useState<boolean>(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocumentType>('terms');
  const [adminCount, setAdminCount] = useState<number>(0);
  const [managerCount, setManagerCount] = useState<number>(0);
  const [userTeam, setUserTeam] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Profile Settings
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    email: user?.email || ''
  });

  // Notification Settings
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailNotifications: true,
    taskAssignments: true,
    chatMessages: true,
    anomalyAlerts: true
  });

  // Security Settings
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Preferences
  const [preferences, setPreferences] = useState({
    language: localStorage.getItem('language') || 'en',
    timezone: localStorage.getItem('timezone') || 'UTC'
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'preferences', label: 'Preferences', icon: Globe },
    { id: 'legal', label: 'Legal', icon: FileText }
  ];

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
      fetchRoleCounts();
    }
    fetchUserTeam();
    loadPreferences();
  }, [user]);

  const loadPreferences = () => {
    const savedNotifs = localStorage.getItem('notificationPrefs');
    if (savedNotifs) {
      setNotificationPrefs(JSON.parse(savedNotifs));
    }
  };

  /**
   * Fetches counts of admin and manager roles to prevent the last one from
   * accidentally deleting their account.
   * 
   * @async
   * @function fetchRoleCounts
   * @returns {Promise<void>}
   */
  const fetchRoleCounts = async () => {
    try {
      const users = await usersAPI.getAll();
      setAdminCount(users.filter(u => u.role === 'ADMIN').length);
      setManagerCount(users.filter(u => u.role === 'MANAGER').length);
    } catch (error: any) {
      setAdminCount(1);
      setManagerCount(1);
    }
  };

  const fetchUserTeam = async () => {
    if (!user) return;
    try {
      const freshUser = await usersAPI.getById(user.id);
      setUserTeam(freshUser.teamId ? { id: freshUser.teamId, name: freshUser.teamName } : null);
    } catch (error: any) {
      console.error('Error fetching user team:', error);
    }
  };

  /**
   * Processes profile updates and optionally username changes which force logout.
   * 
   * @async
   * @function handleSaveProfile
   * @param {React.FormEvent} e - The form submission event.
   * @returns {Promise<void>}
   */
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const usernameChanged = profileData.username !== user.username;
      
      if (usernameChanged) {
        try {
          const response = await fetch(`http://localhost:8080/api/users/${user.id}/username`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: profileData.username })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to update username');
          }
          
          alert('Username updated! Please log in again with your new username: ' + profileData.username);
          
          logout();
          navigate('/login');
          return;
          
        } catch (error: any) {
          alert('Error updating username: ' + error.message);
          setLoading(false);
          return;
        }
      }
      
      await usersAPI.update(user.id, { email: profileData.email });
      
      if (updateUser) {
        updateUser({ ...user, email: profileData.email });
      }
      
      alert('Profile updated successfully!');
      
    } catch (error: any) {
      alert('Error updating profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles password-change validation and communicates with the backend.
   * 
   * @async
   * @function handleUpdatePassword
   * @param {React.FormEvent} e - The form submission event.
   * @returns {Promise<void>}
   */
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      alert('Password must be at least 8 characters!');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8080/api/users/${user.id}/password`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update password');
      }

      alert('Password updated successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      alert('Error updating password: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
        const prefsString = JSON.stringify(notificationPrefs);
        
        // 1. Save to Local Storage (Backup/Immediate use)
        localStorage.setItem('notificationPrefs', prefsString);
        
        // 2. Save to Backend (Persistence)
        await fetch(`http://localhost:8080/api/users/${user.id}/preferences`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ preferences: prefsString })
        });
        
        alert('Notification preferences saved to profile!');
    } catch (error: any) {
        alert('Saved locally, but failed to sync with server.');
    }
  };

  const handleSavePreferences = (e) => {
    e.preventDefault();
    localStorage.setItem('language', preferences.language);
    localStorage.setItem('timezone', preferences.timezone);
    alert('Preferences saved! Refresh the page to see changes.');
  };

  const openLegalModal = (documentType: LegalDocumentType) => {
    setLegalDocument(documentType);
    setShowLegalModal(true);
  };

  const openLegalPage = (documentType: LegalDocumentType) => {
    navigate(`/legal?doc=${documentType}`);
  };

  const handleLeaveTeam = async () => {
    if (!userTeam) return;
    
    setLoading(true);
    try {
      await fetch(`http://localhost:8080/api/teams/${userTeam.id}/members/${user.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      setUserTeam(null);
      setShowLeaveTeamModal(false);
      alert('You have left the team successfully.');
    } catch (error: any) {
      alert('Error leaving team: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      if (user.role === 'ADMIN' && adminCount <= 1) {
        alert('Cannot delete the last admin account.');
        setLoading(false);
        return;
      }
      if (user.role === 'MANAGER' && managerCount <= 1) {
        alert('Cannot delete the last manager account.');
        setLoading(false);
        return;
      }

      await usersAPI.delete(user.id);
      
      setShowDeleteModal(false);
      
      logout();
      navigate('/');
      
    } catch (error: any) {
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        setShowDeleteModal(false);
        alert('Account deleted successfully');
        logout();
        navigate('/');
      } else {
        alert('Error deleting account: ' + error.message);
        setLoading(false);
        setShowDeleteModal(false);
      }
    }
  };

  const initiateAccountDeletion = () => {
    if (userTeam) {
      setShowLeaveTeamModal(true);
    } else {
      setShowDeleteModal(true);
    }
  };

  const canDeleteAccount = 
    (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') || 
    (user?.role === 'ADMIN' && adminCount > 1) ||
    (user?.role === 'MANAGER' && managerCount > 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          Settings
        </h1>
        <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className={`lg:col-span-1 rounded-lg shadow p-4 self-start ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    activeTab === tab.id
                      ? (darkMode ? 'bg-indigo-600 text-white font-semibold' : 'bg-indigo-50 text-indigo-600 font-semibold')
                      : (darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50')
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className={`lg:col-span-3 rounded-lg shadow p-6 ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className={`pb-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  Profile Information
                </h2>
              </div>
              
              <div>
                <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <User className="w-4 h-4" />
                  Username
                </label>
                {profileData.username !== user.username && (
                  <div className={`mb-2 p-2 border rounded text-xs ${
                    darkMode 
                      ? 'bg-yellow-900/20 border-yellow-700 text-yellow-300'
                      : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  }`}>
                    ⚠️ Changing your username will log you out. You'll need to log in again with your new username.
                  </div>
                )}
                <input
                  type="text"
                  value={profileData.username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setProfileData({ ...profileData, username: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Email
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setProfileData({ ...profileData, email: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Role
                </label>
                <input
                  type="text"
                  value={user?.role || ''}
                  disabled
                  className={`w-full px-4 py-2 border rounded-lg cursor-not-allowed ${
                    darkMode
                      ? 'bg-gray-900 border-gray-700 text-gray-400'
                      : 'bg-gray-50 border-gray-300 text-gray-700'
                  }`}
                />
              </div>

              <div>
                <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <Building2 className="w-4 h-4" />
                  Company
                </label>
                <input
                  type="text"
                  value={user?.companyName || 'No company assigned'}
                  disabled
                  className={`w-full px-4 py-2 border rounded-lg cursor-not-allowed ${
                    darkMode
                      ? 'bg-gray-900 border-gray-700 text-gray-400'
                      : 'bg-gray-50 border-gray-300 text-gray-700'
                  }`}
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Company assignment is managed by administrators
                </p>
              </div>

              {userTeam && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Current Team
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={userTeam.name}
                      disabled
                      className={`flex-1 px-4 py-2 border rounded-lg ${
                        darkMode 
                          ? 'bg-gray-900 border-gray-700 text-gray-400' 
                          : 'bg-gray-50 border-gray-300 text-gray-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLeaveTeamModal(true)}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm"
                    >
                      Leave Team
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className={`pb-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  Notification Preferences
                </h2>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'emailNotifications', label: 'Email Notifications', description: 'Receive notifications via email' },
                  { key: 'taskAssignments', label: 'Task Assignments', description: 'Notify when tasks are assigned' },
                  { key: 'chatMessages', label: 'Chat Messages', description: 'Notify for new chat messages' },
                  { key: 'anomalyAlerts', label: 'Anomaly Alerts', description: 'Alert on detected anomalies' }
                ].map((item) => (
                  <div key={item.key} className={`flex items-center justify-between p-4 rounded-lg ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-50'
                  }`}>
                    <div>
                      <p className={`font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                        {item.label}
                      </p>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {item.description}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={notificationPrefs[item.key]}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotificationPrefs({
                          ...notificationPrefs,
                          [item.key]: e.target.checked
                        })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                ))}
              </div>
              <button
                onClick={handleSaveNotifications}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Save Notification Settings
              </button>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className={`pb-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  Security Settings
                </h2>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>

              <div className={`mt-8 pt-8 border-t ${darkMode ? 'border-gray-700' : 'border-red-200'}`}>
                <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                  Danger Zone
                </h3>
                
                {!canDeleteAccount && (
                  <div className={`mb-4 p-4 border rounded-lg flex items-start gap-3 ${
                    darkMode
                      ? 'bg-yellow-900/20 border-yellow-700'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <Shield className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      darkMode ? 'text-yellow-400' : 'text-yellow-600'
                    }`} />
                    <div>
                      <p className={`font-semibold ${
                        darkMode ? 'text-yellow-300' : 'text-yellow-900'
                      }`}>
                        {user?.role === 'ADMIN' ? 'You are the only administrator' : 'You are the only manager'}
                      </p>
                      <p className={`text-sm mt-1 ${
                        darkMode ? 'text-yellow-400' : 'text-yellow-800'
                      }`}>
                        Promote another user to your role before deleting your account.
                      </p>
                    </div>
                  </div>
                )}
                
                {userTeam && (
                  <div className={`mb-4 p-4 border rounded-lg flex items-start gap-3 ${
                    darkMode
                      ? 'bg-blue-900/20 border-blue-700'
                      : 'bg-blue-50 border-blue-200'
                  }`}>
                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      darkMode ? 'text-blue-400' : 'text-blue-600'
                    }`} />
                    <div>
                      <p className={`font-semibold ${
                        darkMode ? 'text-blue-300' : 'text-blue-900'
                      }`}>
                        You are currently in a team
                      </p>
                      <p className={`text-sm mt-1 ${
                        darkMode ? 'text-blue-400' : 'text-blue-800'
                      }`}>
                        Team: <strong>{userTeam.name}</strong>. You must leave this team before deleting your account.
                      </p>
                    </div>
                  </div>
                )}

                <div className={`border rounded-lg p-4 ${
                  darkMode
                    ? 'bg-red-900/20 border-red-700'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <p className={`text-sm mb-4 ${
                    darkMode ? 'text-red-300' : 'text-red-700'
                  }`}>
                    Once you delete your account, there is no going back. This action cannot be undone.
                  </p>
                  <button
                    onClick={initiateAccountDeletion}
                    disabled={!canDeleteAccount}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                      canDeleteAccount
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : (darkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete My Account</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PREFERENCES TAB */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div className={`pb-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  Preferences
                </h2>
              </div>

              <form onSubmit={handleSavePreferences} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Language
                  </label>
                  <select 
                    value={preferences.language}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setPreferences({...preferences, language: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="en">English</option>
                    <option value="el">Ελληνικά</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Timezone
                  </label>
                  <select 
                    value={preferences.timezone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setPreferences({...preferences, timezone: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="UTC">UTC</option>
                    <option value="Europe/Athens">Europe/Athens (EEST)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Save Preferences
                </button>
              </form>
            </div>
          )}

          {/* LEGAL TAB */}
          {activeTab === 'legal' && (
            <div className="space-y-6">
              <div className={`pb-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  Legal Documents
                </h2>
                <p className={`mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Review the latest Terms of Service and Privacy Policy.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LEGAL_DOC_ORDER.map((docKey) => (
                  <div
                    key={docKey}
                    className={`rounded-xl border p-4 ${
                      darkMode ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                      {LEGAL_DOCUMENTS[docKey].label}
                    </h3>
                    <p className={`mt-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {LEGAL_DOCUMENTS[docKey].summary}
                    </p>
                    <p className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Effective date: {LEGAL_DOCUMENTS[docKey].effectiveDate}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openLegalModal(docKey)}
                        className={`px-3 py-2 rounded-lg text-sm transition ${
                          darkMode
                            ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        Quick View
                      </button>
                      <button
                        type="button"
                        onClick={() => openLegalPage(docKey)}
                        className="px-3 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition inline-flex items-center gap-2"
                      >
                        Open Full Page
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className={`rounded-lg border p-4 text-sm ${
                  darkMode
                    ? 'border-indigo-800 bg-indigo-900/20 text-indigo-200'
                    : 'border-indigo-200 bg-indigo-50 text-indigo-800'
                }`}
              >
                By continuing to use the platform, you acknowledge these documents and your organization policies.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legal Modal */}
      {showLegalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className={`rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden scale-in ${
            darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
          }`}>
            <div className={`flex items-center justify-between p-4 border-b ${
              darkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div>
                <h3 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {LEGAL_DOCUMENTS[legalDocument].label}
                </h3>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Read summary here or open the full legal center.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowLegalModal(false)}
                className={`p-2 rounded-lg transition ${
                  darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <LegalDocumentContent documentType={legalDocument} darkMode={darkMode} compact />
            </div>

            <div className={`p-4 border-t flex justify-between gap-3 ${
              darkMode ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
            }`}>
              <button
                type="button"
                onClick={() => openLegalPage(legalDocument)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition inline-flex items-center gap-2"
              >
                Open Full Page
                <ExternalLink className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowLegalModal(false)}
                className={`px-4 py-2 rounded-lg border transition ${
                  darkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Team Modal */}
      {showLeaveTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className={`rounded-lg p-6 w-full max-w-md scale-in ${
            darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                darkMode ? 'bg-orange-900/30' : 'bg-orange-100'
              }`}>
                <AlertTriangle className={`w-6 h-6 ${
                  darkMode ? 'text-orange-400' : 'text-orange-600'
                }`} />
              </div>
              <h3 className={`text-lg font-bold ${
                darkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                Leave Team
              </h3>
            </div>
            <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              You must leave team <strong>{userTeam?.name}</strong> before you can delete your account. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveTeamModal(false)}
                disabled={loading}
                className={`flex-1 px-4 py-2 border rounded-lg transition disabled:opacity-50 ${
                  darkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveTeam}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition"
              >
                {loading ? 'Leaving...' : 'Leave Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className={`rounded-lg p-6 w-full max-w-md scale-in ${
            darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                darkMode ? 'bg-red-900/30' : 'bg-red-100'
              }`}>
                <AlertTriangle className={`w-6 h-6 ${
                  darkMode ? 'text-red-400' : 'text-red-600'
                }`} />
              </div>
              <h3 className={`text-lg font-bold ${
                darkMode ? 'text-red-400' : 'text-red-600'
              }`}>
                Confirm Account Deletion
              </h3>
            </div>
            <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Are you absolutely sure? This will permanently delete your account and all associated data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={loading}
                className={`flex-1 px-4 py-2 border rounded-lg transition disabled:opacity-50 ${
                  darkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
              >
                {loading ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;