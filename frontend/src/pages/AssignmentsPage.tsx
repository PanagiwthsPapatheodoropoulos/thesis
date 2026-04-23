/**
 * @file AssignmentsPage.jsx
 * @description Page component displaying and managing task assignments for the current user.
 */
// src/pages/AssignmentsPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Target, CheckCircle, Clock, Users, Filter, RefreshCw } from 'lucide-react';
import { assignmentsAPI, employeesAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket, EVENT_TYPES } from '../contexts/WebSocketProvider';
import { useTheme } from '../contexts/ThemeContext';
import type { TaskAssignment, Task, Employee } from '../types';

/**
 * AssignmentsPage Component
 * 
 * Displays the current logged-in employee's task assignments.
 * Listens for real-time assignment updates via WebSockets.
 * 
 * @returns {React.ReactElement} The assignments page UI.
 */
const AssignmentsPage = () => {
  const { user } = useAuth();
  const { connected, ready, subscribe } = useWebSocket();
  const { darkMode } = useTheme();

  const dataRef = useRef({
    assignments: [],
    myEmployeeId: null,
    lastFetch: 0
  });

  const [state, setState] = useState({
    assignments: [],
    myEmployeeId: null,
    loading: true
  });
  
  const [filterStatus, setFilterStatus] = useState('ALL');

  const isEmployee = user?.role === 'EMPLOYEE';
  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  /**
   * Fetches latest assignments for the employee silently in the background.
   * Caches the responses using `dataRef` to reduce unnecessary updates.
   * 
   * @async
   * @function fetchDataSilently
   * @returns {Promise<void>}
   */
  const fetchDataSilently = useCallback(async () => {
    const now = Date.now();
    if (now - dataRef.current.lastFetch < 2000) return;
    dataRef.current.lastFetch = now;

    try {
      let empProfile = dataRef.current.myEmployeeId;
      
      if (!empProfile) {
        try {
          const profile = await employeesAPI.getByUserId(user.id);
          empProfile = profile.id;
          dataRef.current.myEmployeeId = empProfile;
        } catch (error: any) {
          return;
        }
      }

      const assignmentsData = await assignmentsAPI.getByEmployee(empProfile);
      
      const hasChanged = JSON.stringify(dataRef.current.assignments) !== JSON.stringify(assignmentsData);
      
      if (hasChanged) {
        dataRef.current.assignments = assignmentsData;
        setState(prev => ({
          ...prev,
          assignments: assignmentsData,
          myEmployeeId: empProfile,
          loading: false
        }));
      }
    } catch (error: any) {
      console.error('Background fetch error:', error);
    }
  }, [user.id]);

  /**
   * Performs the initial data load, displaying a loading state.
   * Retrieves the employee profile and their respective task assignments.
   * 
   * @async
   * @function initialLoad
   * @returns {Promise<void>}
   */
  const initialLoad = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const empProfile = await employeesAPI.getByUserId(user.id);
      const assignmentsData = await assignmentsAPI.getByEmployee(empProfile.id);
      
      dataRef.current = {
        myEmployeeId: empProfile.id,
        assignments: assignmentsData,
        lastFetch: Date.now()
      };
      
      setState({
        assignments: assignmentsData,
        myEmployeeId: empProfile.id,
        loading: false
      });
    } catch (error: any) {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [user.id]);

  useEffect(() => {
    if (!ready || !user?.id) return;
    
    initialLoad();
  }, [ready, user?.id, initialLoad]);

  useEffect(() => {
    if (!ready) return;
    
    const unsub = subscribe(EVENT_TYPES.ASSIGNMENT_CREATED, (assignment) => {      
      const { assignments } = dataRef.current;
      
      if (assignments.some(a => a.id === assignment.id)) return;
      
      const updated = [assignment, ...assignments];
      dataRef.current.assignments = updated;
      setState(prev => ({ ...prev, assignments: updated }));
    });
    
    return () => unsub();
  }, [ready, subscribe]);

  /**
   * Accepts a pending assignment.
   * 
   * @async
   * @function handleAccept
   * @param {string|number} id - The ID of the assignment to accept.
   * @returns {Promise<void>}
   */
  const handleAccept = async (id) => {
    try {
      await assignmentsAPI.accept(id);
      await fetchDataSilently();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  /**
   * Determines the appropriate styling classes for a given assignment status.
   * 
   * @function getStatusBadge
   * @param {string} status - The assignment status (e.g., 'PENDING', 'ACCEPTED').
   * @returns {string} The CSS classes for the status badge.
   */
  const getStatusBadge = (status) => {
    const badges = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      ACCEPTED: 'bg-green-100 text-green-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-purple-100 text-purple-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const incomingAssignments = state.assignments.filter(a => a.status === 'PENDING');
  const acceptedAssignments = state.assignments.filter(a => 
    a.status === 'ACCEPTED' || a.status === 'IN_PROGRESS'
  );
  const completedAssignments = state.assignments.filter(a => a.status === 'COMPLETED');

  let filteredAssignments = state.assignments;

  if (filterStatus === 'PENDING') {
    filteredAssignments = filteredAssignments.filter(a => a.status === 'PENDING');
  } else if (filterStatus === 'ACCEPTED') {
    filteredAssignments = filteredAssignments.filter(a => 
      a.status === 'ACCEPTED' || a.status === 'IN_PROGRESS'
    );
  } else if (filterStatus === 'COMPLETED') {
    filteredAssignments = filteredAssignments.filter(a => a.status === 'COMPLETED');
  }

  const sortedAssignments = [...filteredAssignments].sort((a, b) => 
    new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime()
  );

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!state.myEmployeeId) {
    return (
      <div className={`text-center py-12 rounded-lg border-2 ${
        darkMode
          ? 'bg-yellow-900/20 border-yellow-700'
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <Users className={`w-16 h-16 mx-auto mb-4 ${
          darkMode ? 'text-yellow-400' : 'text-yellow-600'
        }`} />
        <h2 className={`text-xl font-bold mb-2 ${
          darkMode ? 'text-yellow-300' : 'text-yellow-900'
        }`}>
          Employee Profile Required
        </h2>
        <p className={darkMode ? 'text-yellow-400' : 'text-yellow-800'}>
          Contact an administrator to create your employee profile.
        </p>
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
            My Task Assignments
            <span className={`flex items-center gap-1 text-sm ${ready ? 'text-green-600' : 'text-yellow-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${ready ? 'bg-green-600' : 'bg-yellow-500'}`} /> 
              {ready ? 'Live' : 'Connecting...'}
            </span>
          </h1>
          <p className={`mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            View and manage your assigned tasks
          </p>
        </div>
        
        <button
          onClick={initialLoad}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
            darkMode
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`border-2 rounded-lg p-4 ${
          darkMode
            ? 'bg-yellow-900/20 border-yellow-700'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Clock className={`w-5 h-5 ${
              darkMode ? 'text-yellow-400' : 'text-yellow-600'
            }`} />
            <p className={`text-sm font-medium ${
              darkMode ? 'text-yellow-300' : 'text-yellow-900'
            }`}>
              Pending
            </p>
          </div>
          <p className={`text-3xl font-bold ${
            darkMode ? 'text-yellow-300' : 'text-yellow-900'
          }`}>
            {incomingAssignments.length}
          </p>
        </div>
        
        <div className={`border-2 rounded-lg p-4 ${
          darkMode
            ? 'bg-green-900/20 border-green-700'
            : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className={`w-5 h-5 ${
              darkMode ? 'text-green-400' : 'text-green-600'
            }`} />
            <p className={`text-sm font-medium ${
              darkMode ? 'text-green-300' : 'text-green-900'
            }`}>
              Active
            </p>
          </div>
          <p className={`text-3xl font-bold ${
            darkMode ? 'text-green-300' : 'text-green-900'
          }`}>
            {acceptedAssignments.length}
          </p>
        </div>
        
        <div className={`border-2 rounded-lg p-4 ${
          darkMode
            ? 'bg-purple-900/20 border-purple-700'
            : 'bg-purple-50 border-purple-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Target className={`w-5 h-5 ${
              darkMode ? 'text-purple-400' : 'text-purple-600'
            }`} />
            <p className={`text-sm font-medium ${
              darkMode ? 'text-purple-300' : 'text-purple-900'
            }`}>
              Completed
            </p>
          </div>
          <p className={`text-3xl font-bold ${
            darkMode ? 'text-purple-300' : 'text-purple-900'
          }`}>
            {completedAssignments.length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-lg shadow p-4 ${
        darkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <Filter className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
          <h3 className={`font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            Filter Assignments
          </h3>
        </div>
        
        <div className="flex gap-3 flex-wrap">
          {['ALL', 'PENDING', 'ACCEPTED', 'COMPLETED'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filterStatus === status
                  ? 'bg-indigo-600 text-white'
                  : darkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status}
              {status === 'ALL' && ` (${state.assignments.length})`}
              {status === 'PENDING' && ` (${incomingAssignments.length})`}
              {status === 'ACCEPTED' && ` (${acceptedAssignments.length})`}
              {status === 'COMPLETED' && ` (${completedAssignments.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Assignments Grid */}
      <div className="grid grid-cols-1 gap-6">
        {sortedAssignments.map((assignment) => (
          <div 
            key={assignment.id} 
            className={`rounded-lg shadow hover:shadow-lg transition p-6 ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <h3 className={`text-xl font-bold ${
                    darkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    {assignment.taskTitle}
                  </h3>
                  
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(assignment.status)}`}>
                    {assignment.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Users className={`w-4 h-4 ${
                      darkMode ? 'text-gray-500' : 'text-gray-500'
                    }`} />
                    <span className={`text-sm ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {assignment.employeeName}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${
                      darkMode ? 'text-gray-500' : 'text-gray-500'
                    }`} />
                    <span className={`text-sm ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {new Date(assignment.assignedDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {assignment.notes && (
                  <div className={`mt-4 p-3 rounded-lg ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-50'
                  }`}>
                    <p className={`text-sm ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {assignment.notes}
                    </p>
                  </div>
                )}
              </div>

              {assignment.status === 'PENDING' && (
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleAccept(assignment.id)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition whitespace-nowrap"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Accept
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredAssignments.length === 0 && (
        <div className={`text-center py-12 rounded-lg ${
          darkMode ? 'bg-gray-800' : 'bg-gray-50'
        }`}>
          <Target className={`w-16 h-16 mx-auto mb-4 ${
            darkMode ? 'text-gray-600' : 'text-gray-300'
          }`} />
          <p className={darkMode ? 'text-gray-500' : 'text-gray-500'}>
            {filterStatus === 'ALL'
              ? 'No task assignments yet' 
              : `No ${filterStatus.toLowerCase()} assignments`}
          </p>
        </div>
      )}
    </div>
  );
};

export default AssignmentsPage;