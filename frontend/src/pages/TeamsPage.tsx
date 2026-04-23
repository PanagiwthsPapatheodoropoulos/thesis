/**
 * @file TeamsPage.jsx
 * @description Page component for team management and composition.
 */
import React, { useState, useEffect } from 'react';
import { Plus, Users, X, UserPlus, UserMinus, AlertTriangle, ShieldAlert, Trash2, Search, User } from 'lucide-react';
import { teamsAPI, usersAPI, employeesAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useWebSocket, EVENT_TYPES } from '../contexts/WebSocketProvider';
import { getProfileImageUrl } from '../utils/api';
import Pagination from '../components/Pagination';
import type { Team, Employee, PaginatedResponse, TeamFilters } from '../types';

/**
 * TeamsPage Component
 * 
 * Allows users to view teams and administrators to create, update, or delete teams.
 * Subscribes to profile update events via WebSockets to keep member avatars fresh.
 * 
 * @returns {React.ReactElement} The teams management UI.
 */
const TeamsPage = () => {
  const { user } = useAuth();
  const { darkMode } = useTheme();
  
  // Data State
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasEmployeeProfile, setHasEmployeeProfile] = useState<boolean>(false);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  // Pagination & Search State
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState(6);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Destructure 'ready' from useWebSocket
  const { connected, ready, subscribe } = useWebSocket();

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const canManageTeams = isAdmin || isManager;

  // --- INITIALIZATION ---

  useEffect(() => {
    checkEmployeeProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // --- WEBSOCKETS & DATA SYNC ---

  // Initial Fetch when Profile is Verified AND WebSocket is Ready
  useEffect(() => {
    if (!hasEmployeeProfile || !ready) return; // Wait for both logic and connection
    
    fetchData(); 
    // NO POLLING - rely on WebSocket events defined below
  }, [hasEmployeeProfile, ready]);

  // Handle Pagination/Filter changes separately
  useEffect(() => {
    if (!hasEmployeeProfile || !ready) return;
    // Only fetch if we are already connected, otherwise the effect above handles the initial load
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, sortBy, sortDir, searchTerm]);

  // WebSocket Event Listeners to ensure image refresh
  useEffect(() => {
    if (!ready) return;

    const unsub = subscribe(EVENT_TYPES.PROFILE_UPDATED, (data: any) => {
      fetchData(); // Always refresh main list
      if (selectedTeam) {
        handleViewDetails(selectedTeam.id); // Refresh modal if open
      }
    });

    return () => unsub();
  }, [ready, subscribe, selectedTeam]);

  // Local window event listener
  useEffect(() => {
    const handleProfileUpdate = (event) => {
      fetchData(); // Always refresh main list
      if (selectedTeam) {
        handleViewDetails(selectedTeam.id); // Refresh modal if open
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [selectedTeam]);

  // Reset page on new search
  useEffect(() => {
    if (currentPage !== 0) {
      setCurrentPage(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const checkEmployeeProfile = async () => {
    try {
      setLoading(true);

      if (isAdmin || isManager) {
        setHasEmployeeProfile(true);
        // Note: We don't call fetchData here anymore, we let the useEffect([hasEmployeeProfile, ready]) handle it
        setLoading(false);
        return;
      }

      await employeesAPI.getByUserId(user.id);
      setHasEmployeeProfile(true);
      // Note: We don't call fetchData here anymore, we let the useEffect([hasEmployeeProfile, ready]) handle it
    } catch (error: any) {
      console.log('No employee profile found');
      setHasEmployeeProfile(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetches paginated teams data alongside necessary user/employee maps.
   * 
   * @async
   * @function fetchData
   * @returns {Promise<void>}
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      let allUsers = [];

      // 1. Fetch Users (if admin) and Employees
      if (canManageTeams) {
        try {
          allUsers = await usersAPI.getAll();
          setUsers(allUsers);
        } catch (error: any) {
          console.error('Error fetching users:', error);
          setUsers([]);
        }
      } else {
        setUsers([]);
      }

      const allEmployees = canManageTeams
        ? await employeesAPI.getAll().catch(() => [])
        : [];
      setEmployees(allEmployees);

      // 2. Fetch Teams (Paginated for Admin/Manager, Normal for User)
      let rawTeamsData = [];

      if (canManageTeams) {
        // Use Paginated API
        const response = await teamsAPI.getAllPaginated(
          currentPage,
          pageSize,
          sortBy,
          sortDir,
          {
            ...(searchTerm && { search: searchTerm })
          }
        );
        
        rawTeamsData = response.content;
        setTotalPages(response.totalPages);
        setTotalElements(response.totalElements);
      } else {
        // Use My Teams API (No pagination usually for "My Teams")
        rawTeamsData = await teamsAPI.getMyTeams();
        // Since getMyTeams isn't paginated here, we simulate total counts
        setTotalElements(rawTeamsData.length);
        setTotalPages(1);
      }

      // 3. Process Member Counts
      const teamsWithCounts = rawTeamsData.map(team => {
        if (canManageTeams) {
          return {
            ...team,
            memberCount: allUsers.filter(u => u.teamId === team.id).length
          };
        } else {
          return {
            ...team,
            memberCount: team.members?.length || 0
          };
        }
      });

      setTeams(teamsWithCounts);
    } catch (error: any) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage, newSize) => {
    if (newSize && newSize !== pageSize) {
      setPageSize(newSize);
      setCurrentPage(0);
    } else {
      setCurrentPage(newPage);
    }
  };

  // --- ACTIONS ---

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await teamsAPI.create(formData);
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
      await fetchData();
    } catch (error: any) {
      alert('Error creating team: ' + error.message);
    }
  };

  /**
   * Opens the detail modal for a team, refreshing member profiles and counts.
   * 
   * @async
   * @function handleViewDetails
   * @param {string|number} teamId - The team ID.
   * @returns {Promise<void>}
   */
  const handleViewDetails = async (teamId) => {
    try {
      // Force fresh fetch of team details
      const teamDetails = await teamsAPI.getById(teamId);
      
      // Force fresh fetch of all users to get updated profile images
      const freshUsers = await usersAPI.getAll();
      setUsers(freshUsers);
      
      const actualMembers = freshUsers.filter(u => u.teamId === teamId);
      teamDetails.memberCount = actualMembers.length;
      
      // Fetch employee profiles to get latest profile images
      const allEmployees = await employeesAPI.getAll().catch(() => []);
      
      // Manually add profile images to members from employee profiles
      teamDetails.members = teamDetails.members.map(member => {
        const freshUser = freshUsers.find(u => u.id === member.userId);
        const employeeProfile = allEmployees.find(emp => emp.userId === member.userId);
        
        return {
          ...member,
          // Priority: Employee profile image > User profile image > existing
          profileImageUrl: employeeProfile?.profileImageUrl || freshUser?.profileImageUrl || member.profileImageUrl
        };
      });
      
      setSelectedTeam(teamDetails);
      setShowDetailsModal(true);
      await fetchData();
    } catch (error: any) {
      console.error('Error fetching team details:', error);
    }
  };

  const confirmAddMember = (userId) => {
    const userToAdd = users.find(u => u.id === userId);
    setConfirmAction({
      type: 'add',
      title: 'Add Member',
      message: `Add ${userToAdd.username} to ${selectedTeam.name}?`,
      onConfirm: () => handleAddMember(userId)
    });
    setShowAddMemberModal(false);
    setShowConfirmModal(true);
  };

  const confirmRemoveMember = (userId, username) => {
    setConfirmAction({
      type: 'remove',
      title: 'Remove Member',
      message: `Remove ${username} from ${selectedTeam.name}?`,
      onConfirm: () => handleRemoveMember(userId)
    });
    setShowConfirmModal(true);
  };

  const handleAddMember = async (userId) => {
    try {
      await fetch(`http://localhost:8080/api/teams/${selectedTeam.id}/members/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      // Instead of manual updates, re-fetch
      handleViewDetails(selectedTeam.id);
      setShowConfirmModal(false);
    } catch (error: any) {
      alert('Error adding member: ' + error.message);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await fetch(`http://localhost:8080/api/teams/${selectedTeam.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      // Instead of manual updates, re-fetch
      handleViewDetails(selectedTeam.id);
      setShowConfirmModal(false);
    } catch (error: any) {
      alert('Error removing member: ' + error.message);
    }
  };

  const confirmDeleteTeam = (teamId, teamName) => {
    setConfirmAction({
      type: 'remove',
      title: 'Delete Team',
      message: `Are you sure you want to delete the team "${teamName}"? This action cannot be undone.`,
      onConfirm: () => handleDeleteTeam(teamId),
    });
    setShowConfirmModal(true);
  };

  const handleDeleteTeam = async (teamId) => {
    try {
      await teamsAPI.delete(teamId);
      setShowConfirmModal(false);
      await fetchData();
    } catch (error: any) {
      alert('Error deleting team: ' + error.message);
      setShowConfirmModal(false);
    }
  };

  const availableUsersForTeam = users.filter(u => {
    const hasEmployeeProfile = employees.some(emp => emp.userId === u.id);
    const notInTeam = !selectedTeam?.members?.some(m => m.userId === u.id);
    const notCurrentUser = u.id !== user.id;
    return hasEmployeeProfile && notInTeam && notCurrentUser;
  });

  // --- RENDERING ---

  if (loading && !teams.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!hasEmployeeProfile && !isAdmin && !isManager) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <ShieldAlert className="w-12 h-12 text-yellow-600 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-yellow-900 mb-2">Employee Profile Required</h2>
              <p className="text-yellow-800 mb-4">
                You need an employee profile to access teams. Please contact an administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
  <div className="h-full flex flex-col">
    
    {/* Header */}
    <div className="flex-shrink-0 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Teams</h1>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
            {canManageTeams 
              ? `Showing ${totalElements} team${totalElements !== 1 ? 's' : ''}` 
              : `You are in ${teams.length} team(s)`}
          </p>
        </div>
        
        {canManageTeams && (
          <div className="flex gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search teams..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className={`pl-10 pr-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-64 transition ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
              <Search className={`w-5 h-5 absolute left-3 top-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2.5 rounded-lg hover:shadow-lg transition whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              New Team
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Teams Grid */}
    <div className='flex-1 overflow-auto mb-6'>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <div
            key={team.id}
            className={`rounded-lg shadow hover:shadow-lg transition p-6 ${
              darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
            }`}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold">{team.name}</h3>
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
                  {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {team.description && (
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm mb-4 line-clamp-2`}>
                {team.description}
              </p>
            )}

            <div className={`flex items-center justify-between mt-4 pt-4 ${
              darkMode ? 'border-t border-gray-700' : 'border-t border-gray-200'
            }`}>
              <button
                onClick={() => handleViewDetails(team.id)}
                className={`py-2.5 text-sm font-medium rounded-lg transition ${
                  darkMode ? 'text-indigo-400 hover:bg-indigo-900/30' : 'text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                View Details
              </button>

              {canManageTeams && (
                <button
                  onClick={() => confirmDeleteTeam(team.id, team.name)}
                  title="Delete Team"
                  className={`flex items-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition ${
                    darkMode 
                      ? 'text-red-400 hover:bg-red-900/30' 
                      : 'text-red-600 hover:bg-red-50'
                  }`}
                >
                  <Trash2 className="w-4 h-4" /> 
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {teams.length === 0 && !loading && (
        <div className={`text-center py-12 rounded-lg ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
          <Users className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
          <p>{canManageTeams ? 'No teams found' : 'You are not assigned to any teams yet'}</p>
        </div>
      )}
    </div>

    {/* Pagination */}
    {canManageTeams && !loading && totalElements > 0 && (
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalElements={totalElements}
        size={pageSize}
        onPageChange={handlePageChange}
        darkMode={darkMode}
      />
    )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className={`rounded-lg p-6 w-full max-w-md scale-in ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Create New Team</h2>
              <button onClick={() => setShowCreateModal(false)}>
                <X className={`w-6 h-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  rows={3}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 rounded-lg hover:shadow-lg transition"
              >
                Create Team
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className={`rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto scale-in ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedTeam.name}</h2>
                {selectedTeam.description && (
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>{selectedTeam.description}</p>
                )}
              </div>
              <button onClick={() => setShowDetailsModal(false)}>
                <X className={`w-6 h-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
              </button>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">Team Members ({selectedTeam.members?.length || 0})</h3>
                {canManageTeams && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Member
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {selectedTeam.members && selectedTeam.members.length > 0 ? (
                  selectedTeam.members.map(member => {
                    // Use the image URL from our enriched object, plus cache busting just in case
                    const profileImage = member.profileImageUrl ? getProfileImageUrl(member.profileImageUrl) : null;
                    
                    return (
                      <div
                        key={member.userId}
                        className={`flex items-center justify-between p-3 rounded-lg transition ${
                          darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {profileImage ? (
                            <img
                              src={profileImage}
                              alt={member.username}
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                                (((e.target as HTMLElement).nextSibling) as HTMLElement).style.display = 'flex';
                              }}
                            />
                          ) : null}
                          
                          <div 
                            className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold"
                            style={{ display: profileImage ? 'none' : 'flex' }}
                          >
                            <User className="w-5 h-5" />
                          </div>

                          <div>
                            <p className={`font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                              {member.username}
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {member.email}
                            </p>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              darkMode ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {member.role}
                            </span>
                          </div>
                        </div>
                        {canManageTeams && (
                          <button
                            onClick={() => confirmRemoveMember(member.userId, member.username)}
                            className={`p-2 rounded-lg transition ${
                              darkMode ? 'text-red-400 hover:bg-red-900/30' : 'text-red-600 hover:bg-red-50'
                            }`}
                          >
                            <UserMinus className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No members yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className={`rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto scale-in ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Add Employee to Team</h3>
              <button onClick={() => setShowAddMemberModal(false)}>
                <X className={`w-6 h-6 ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'}`} />
              </button>
            </div>

            <div className="space-y-2">
              {availableUsersForTeam.length > 0 ? (
                availableUsersForTeam.map(availUser => {
                    const availProfileImage = availUser.profileImageUrl ? getProfileImageUrl(availUser.profileImageUrl) : null;
                    return (
                  <button
                    key={availUser.id}
                    onClick={() => confirmAddMember(availUser.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition text-left ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'}`}
                  >
                    {availProfileImage ? (
                      <img
                        src={availProfileImage}
                        alt={availUser.username}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                            (((e.target as HTMLElement).nextSibling) as HTMLElement).style.display = 'flex';
                        }}
                      />
                    ) : null}
                    
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold"
                        style={{ display: availProfileImage ? 'none' : 'flex' }}>
                      <User className="w-5 h-5" />
                    </div>

                    <div className="flex-1">
                      <p className={`font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{availUser.username}</p>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{availUser.email}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-700'}`}>
                        Has Employee Profile
                      </span>
                    </div>
                  </button>
                )})
              ) : (
                <div className="text-center py-8">
                  <ShieldAlert className={`w-12 h-12 mx-auto mb-2 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No available employees to add. Users must have an employee profile to join teams.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className={`rounded-lg p-6 w-full max-w-md scale-in ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                confirmAction.type === 'remove'
                  ? darkMode ? 'bg-red-900' : 'bg-red-100'
                  : darkMode ? 'bg-indigo-900' : 'bg-indigo-100'
              }`}>
                <AlertTriangle className={`w-6 h-6 ${
                  confirmAction.type === 'remove'
                    ? darkMode ? 'text-red-400' : 'text-red-600'
                    : darkMode ? 'text-indigo-400' : 'text-indigo-600'
                }`} />
              </div>
              <h3 className="text-lg font-bold">{confirmAction.title}</h3>
            </div>
            <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{confirmAction.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className={`flex-1 px-4 py-2 border rounded-lg transition ${
                  darkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className={`flex-1 px-4 py-2 rounded-lg transition ${
                  confirmAction.type === 'remove'
                    ? darkMode ? 'bg-red-700 hover:bg-red-800 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                    : darkMode ? 'bg-indigo-700 hover:bg-indigo-800 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsPage;