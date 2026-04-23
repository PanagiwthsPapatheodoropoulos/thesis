/**
 * @fileoverview EmployeesPage - Paginated Employee Directory with CRUD Support.
 *
 * Displays a card-based employee listing with server-side pagination, search,
 * and department/position filtering. Admins and managers can add new employees
 * (linking them to existing pending users), edit their roles and departments,
 * and remove them. Subscribes to WebSocket profile-updated events to
 * automatically refresh the directory after changes.
 */
// src/pages/EmployeesPage.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Search, Briefcase, Calendar, Award, X, RefreshCw, Trash2, AlertTriangle, Edit, Shield, User } from 'lucide-react';
import { employeesAPI, usersAPI, departmentsAPI, notificationsAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useWebSocket, EVENT_TYPES } from '../contexts/WebSocketProvider';
import SkillsInput from '../components/SkillsInput';
import Pagination from '../components/Pagination';
import type { Employee, PaginatedResponse, EmployeeFilters } from '../types';

/**
 * Employee directory page with real-time updates via WebSocket.
 * Admins and managers have full CRUD control; other roles have read-only access.
 * @component
 * @returns {JSX.Element} The rendered employee grid with modals and pagination.
 */
const EmployeesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { darkMode } = useTheme();

  // Data State
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Pagination & Filter State
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState(6);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [sortBy, setSortBy] = useState('firstName');
  const [sortDir, setSortDir] = useState('asc');

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [positionFilter, setPositionFilter] = useState('ALL');

  // Modal State
  const [editEmployeeSkills, setEditEmployeeSkills] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [createdUserInfo, setCreatedUserInfo] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [selectedSkills, setSelectedSkills] = useState<any[]>([]);

  // Destructure ready state
  const { ready, subscribe } = useWebSocket();

  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Forms
  const [formData, setFormData] = useState({
    userId: '',
    firstName: '',
    lastName: '',
    position: '',
    department: '',
    hireDate: '',
    hourlyRate: '',
    maxWeeklyHours: 40
  });

  const [editFormData, setEditFormData] = useState({
    username: '',
    firstName: '',
    lastName: '',
    role: '',
    department: '',
    hourlyRate: '',
    maxWeeklyHours: 40
  });

  const canManageEmployees = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Initial Data Load
  useEffect(() => {
    fetchDepartments();
  }, []);

  // Fetch Employees when Pagination/Filters change
  useEffect(() => {
    fetchEmployees();
  }, [currentPage, pageSize, sortBy, sortDir, departmentFilter, positionFilter, refreshTrigger]);


  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 0) fetchEmployees();
      else setCurrentPage(0);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [departmentFilter, positionFilter]);

  // Load Users if Manager
  useEffect(() => {
    if (canManageEmployees) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageEmployees]);

  // Window Event Listeners (Legacy/Local)
  useEffect(() => {
    const handleProfileUpdate = (event) => {
      // Force complete refresh by incrementing trigger
      setRefreshTrigger(prev => prev + 1);

      // Also fetch immediately
      fetchEmployees();
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);

    const handleSkillChange = () => {
      fetchEmployees();
    };
    window.addEventListener('employeeSkillChanged', handleSkillChange);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      window.removeEventListener('employeeSkillChanged', handleSkillChange);
    };
  }, [currentPage, pageSize, sortBy, sortDir, departmentFilter, positionFilter]);

  // WebSocket Listener using ready state
  useEffect(() => {
    if (!ready) return;

    const unsub = subscribe(EVENT_TYPES.PROFILE_UPDATED, (data: any) => {
      // Force a complete refresh of employees data
      setRefreshTrigger(prev => prev + 1);
    });

    return () => unsub();
  }, [ready, subscribe]);

  /**
   * Fetches a paginated employee list and enriches each record with current skill data.
   * Falls back to an empty skills array if the skills endpoint is unavailable.
   */
  const fetchEmployees = async () => {
    try {
      setLoading(true);

      // 1. Fetch Paginated Data
      const response = await employeesAPI.getAllPaginated(
        currentPage,
        pageSize,
        sortBy,
        sortDir,
        {
          ...(departmentFilter !== 'ALL' && { department: departmentFilter }),
          ...(positionFilter !== 'ALL' && { position: positionFilter }),
          ...(searchTerm && { search: searchTerm })
        }
      );

      const pageContent = response.content || [];

      // 2. Fetch Skills for the visible page
      const employeesWithSkills = await Promise.all(
        pageContent.map(async (employee, index) => {
          try {
            const skillsResponse = await fetch(
              `http://localhost:8080/api/employees/${employee.id}/skills?t=${Date.now()}`,
              {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
              }
            );

            if (skillsResponse.ok) {
              const skills = await skillsResponse.json();
              return { ...employee, skills: Array.isArray(skills) ? skills : [] };
            } else {
              return { ...employee, skills: [] };
            }
          } catch (error: any) {
            return { ...employee, skills: [] };
          }
        })
      );

      setEmployees(employeesWithSkills);
      setTotalPages(response.totalPages);
      setTotalElements(response.totalElements);

    } catch (error: any) {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Loads the list of department names for the department filter dropdown.
   */
  const fetchDepartments = async () => {
    try {
      const data = await departmentsAPI.getDepartmentNames();
      setDepartments(data);
    } catch (error: any) {
      setDepartments([]);
    }
  };

  /**
   * Loads all platform users who are assigned to the same company and have the USER role.
   * These are the accounts eligible to become employee profiles.
   */
  const fetchUsers = async () => {
    try {
      const allUsers = await usersAPI.getAll();
      const usersInMyCompany = allUsers.filter(u =>
        u.role === 'USER' &&
        u.companyId === user.companyId
      );
      setUsers(usersInMyCompany);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    }
  };

  /**
   * Handles page and page size changes from the Pagination component.
   * Resets to page 0 when page size changes.
   * @param {number} newPage - The target page index (0-based).
   * @param {number} [newSize] - Optional updated page size.
   */
  const handlePageChange = (newPage, newSize) => {
    if (newSize && newSize !== pageSize) {
      setPageSize(newSize);
      setCurrentPage(0);
    } else {
      setCurrentPage(newPage);
    }
  };

  /**
   * Opens the edit modal pre-populated with the selected employee's current data and skills.
   * @param {Object} employee - The employee record to edit.
   */
  const handleEditEmployee = async (employee) => {
    try {
      const employeeUser = await usersAPI.getById(employee.userId);
      const skillsResponse = await fetch(
        `http://localhost:8080/api/employees/${employee.id}/skills`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );

      let currentSkills = [];
      if (skillsResponse.ok) {
        currentSkills = await skillsResponse.json();
      }

      setSelectedEmployee(employee);
      setEditEmployeeSkills(Array.isArray(currentSkills) ? currentSkills : []);
      setEditFormData({
        username: employeeUser.username,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: employeeUser.role,
        department: employee.department,
        hourlyRate: employee.hourlyRate || '',
        maxWeeklyHours: employee.maxWeeklyHours || 40
      });
      setShowEditModal(true);
    } catch (error: any) {
      alert('Error loading employee data: ' + error.message);
    }
  };

  /**
   * Persists edits to an employee record, including role promotion and optional username change.
   * Sends an in-app notification if the employee's role is changed.
   * @param {React.FormEvent} e - The form submit event.
   */
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const originalUser = await usersAPI.getById(selectedEmployee.userId);

      await fetch(`http://localhost:8080/api/users/${selectedEmployee.userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: editFormData.role })
      });

      if (editFormData.username !== originalUser.username) {
        await fetch(`http://localhost:8080/api/users/${selectedEmployee.userId}/username`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username: editFormData.username })
        });
      }

      await employeesAPI.update(selectedEmployee.id, {
        userId: selectedEmployee.userId,
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        department: editFormData.department,
        position: selectedEmployee.position,
        hireDate: selectedEmployee.hireDate,
        hourlyRate: editFormData.hourlyRate ? parseFloat(editFormData.hourlyRate) : null,
        maxWeeklyHours: Number(editFormData.maxWeeklyHours)
      });

      if (editFormData.role !== originalUser.role) {
        const roleNames = { 'ADMIN': 'Administrator', 'MANAGER': 'Manager', 'EMPLOYEE': 'Employee', 'USER': 'Basic User' };
        alert(` Employee role updated to ${roleNames[editFormData.role]}! User must log in again to see changes.`);
        await notificationsAPI.create({
          userId: selectedEmployee.userId,
          type: 'ROLE_PROMOTION',
          title: '🎉 Your Role Has Been Updated',
          message: `You have been promoted to ${roleNames[editFormData.role]}. Please log out and log back in to access your new features.`,
          severity: 'SUCCESS'
        });
      }

      setShowEditModal(false);
      await fetchEmployees();
    } catch (error: any) {
      alert('Error updating employee: ' + error.message);
    }
  };

  /**
   * Sets the target employee and opens the delete confirmation dialog.
   * @param {Object} employee - The employee record to stage for deletion.
   */
  const confirmDeleteEmployee = (employee) => {
    setUserToDelete(employee);
    setShowDeleteModal(true);
  };

  /**
   * Creates a new employee profile linked to an existing user account.
   * Sequentially resolves and assigns the selected skills after creation.
   * @param {React.FormEvent} e - The form submit event.
   */
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (selectedSkills.length === 0) {
      try {
        await employeesAPI.create({
          ...formData,
          hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
          maxWeeklyHours: Number(formData.maxWeeklyHours)
        });
        const createdUser = users.find(u => u.id === formData.userId);
        setCreatedUserInfo(createdUser);
        setShowCreateModal(false);
        setFormData({ userId: '', firstName: '', lastName: '', position: '', department: '', hireDate: '', hourlyRate: '', maxWeeklyHours: 40 });
        setSelectedSkills([]);
        setShowSuccessModal(true);
        await fetchEmployees();
      } catch (error: any) {
        alert('Error creating employee: ' + error.message);
      }
      return;
    }

    try {
      const createdEmployee = await employeesAPI.create({
        ...formData,
        hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
        maxWeeklyHours: Number(formData.maxWeeklyHours) as any
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      if (selectedSkills && selectedSkills.length > 0) {
        for (const skill of selectedSkills) {
          try {
            let skillData;
            const skillResponse = await fetch('http://localhost:8080/api/skills/name/' + encodeURIComponent(skill.skillName), {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (skillResponse.ok) {
              skillData = await skillResponse.json();
            } else {
              const createResponse = await fetch('http://localhost:8080/api/skills', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: skill.skillName, category: skill.skillCategory || 'Other', description: '' })
              });
              if (!createResponse.ok) throw new Error(`Failed to create skill: ${createResponse.status}`);
              skillData = await createResponse.json();
            }

            await fetch(`http://localhost:8080/api/employees/${createdEmployee.id}/skills`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                skillId: skillData.id,
                proficiencyLevel: skill.proficiencyLevel || 3,
                yearsOfExperience: skill.yearsOfExperience || 0,
                lastUsed: skill.lastUsed || null
              })
            });
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (skillError) {
            console.error(`Failed to add skill "${skill.skillName}":`, skillError);
          }
        }
      }

      const createdUser = users.find(u => u.id === formData.userId);
      setCreatedUserInfo(createdUser);
      setShowCreateModal(false);
      setFormData({ userId: '', firstName: '', lastName: '', position: '', department: '', hireDate: '', hourlyRate: '', maxWeeklyHours: 40 });
      setSelectedSkills([]);
      setShowSuccessModal(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchEmployees();

    } catch (error: any) {
      alert('Error creating employee: ' + error.message);
    }
  };

  /**
   * Deletes the staged employee's user account and removes the employee record.
   * Refreshes the directory after successful deletion.
   */
  const handleDeleteEmployee = async () => {
    if (!userToDelete) return;
    try {
      await usersAPI.delete(userToDelete.userId);
      alert(`${userToDelete.firstName} ${userToDelete.lastName} has been removed`);
      setShowDeleteModal(false);
      setUserToDelete(null);
      await fetchEmployees();
    } catch (error: any) {
      alert('Error deleting employee: ' + error.message);
    }
  };

  // ===== RENDER =====
  return (
    <div className="h-full flex flex-col"> 

      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Employees</h1>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
              {totalElements > 0 ? `Showing ${totalElements} employees` : 'Manage your team members'}
            </p>
          </div>
          {canManageEmployees && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition"
            >
              <Plus className="w-5 h-5" />
              Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Filters & Sorting */}
      <div className={`flex-shrink-0 mb-6 rounded-lg shadow p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'
              }`} />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className={`pl-10 w-full px-4 py-2 rounded-lg outline-none border focus:ring-2 focus:ring-indigo-500 ${darkMode
                  ? 'bg-gray-700 text-gray-100 border-gray-600 placeholder-gray-400'
                  : 'bg-white text-gray-900 border-gray-300 placeholder-gray-500'
                }`}
            />
          </div>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDepartmentFilter(e.target.value)}
            className={`px-4 py-2 rounded-lg outline-none border focus:ring-2 focus:ring-indigo-500 ${darkMode
                ? 'bg-gray-700 text-gray-100 border-gray-600'
                : 'bg-white text-gray-900 border-gray-300'
              }`}
          >
            <option value="ALL">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* Position Filter */}
          <select
            value={positionFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPositionFilter(e.target.value)}
            className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-100'
                : 'bg-white border-gray-300 text-gray-900'
              }`}
          >
            <option value="ALL">All Positions</option>
            <option value="Manager">Manager</option>
            <option value="Developer">Developer</option>
            <option value="Designer">Designer</option>
          </select>

          {/* Sort Control */}
          <select
            value={`${sortBy}-${sortDir}`}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const [field, dir] = e.target.value.split('-');
              setSortBy(field);
              setSortDir(dir);
            }}
            className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-100'
                : 'bg-white border-gray-300 text-gray-900'
              }`}
          >
            <option value="firstName-asc">Name (A-Z)</option>
            <option value="firstName-desc">Name (Z-A)</option>
            <option value="hireDate-desc">Hire Date (Newest)</option>
            <option value="hireDate-asc">Hire Date (Oldest)</option>
            <option value="department-asc">Department (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Employees Grid */}
      <div className='flex-1 overflow-auto mb-6'>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading && employees.length === 0 ? (
            <div className="col-span-3 flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
          ) : employees.length === 0 ? (
            <div className="col-span-3 text-center py-12">
              <p className={darkMode ? 'text-gray-500' : 'text-gray-500'}>No employees found</p>
            </div>
          ) : (
            employees.map((employee, index) => (
              <div
                key={employee.id}
                className={`rounded-lg shadow hover:shadow-lg transition p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'
                  }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center mb-4">
                  {employee.profileImageUrl ? (
                    <img
                      key={`${employee.profileImageUrl}-${refreshTrigger}`}  // Simple key, no Date.now()
                      src={employee.profileImageUrl}
                      alt={`${employee.firstName} ${employee.lastName}`}
                      className="h-16 w-16 rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        ((e.target as HTMLElement).nextSibling as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : (
                    <div
                      className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white"
                      style={{ display: employee.profileImageUrl ? 'none' : 'flex' }}
                    >
                      <User className="w-8 h-8" />
                    </div>

                  )}
                  <div className="ml-4 flex-1">
                    <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                      {employee.firstName} {employee.lastName}
                    </h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {employee.position || 'No position'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {employee.department && (
                    <div className={`flex items-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                      <Briefcase className={`h-4 w-4 mr-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'
                        }`} />
                      <span>{employee.department}</span>
                    </div>
                  )}

                  {employee.hireDate && (
                    <div className={`flex items-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                      <Calendar className={`h-4 w-4 mr-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'
                        }`} />
                      <span>Hired: {new Date(employee.hireDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {employee.skills && Array.isArray(employee.skills) && employee.skills.length > 0 && (
                  <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                    <div className="flex items-center mb-2">
                      <Award className={`h-4 w-4 mr-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'
                        }`} />
                      <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-700'
                        }`}>Skills</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {employee.skills.slice(0, 5).map((skill) => (
                        <span
                          key={skill.id || skill.skillId}
                          className={`px-2 py-1 text-xs rounded-full ${darkMode
                              ? 'bg-blue-900/30 text-blue-300'
                              : 'bg-blue-50 text-blue-700'
                            }`}
                        >
                          {skill.skillName}
                        </span>
                      ))}
                      {employee.skills.length > 5 && (
                        <span className={`px-2 py-1 text-xs rounded-full ${darkMode
                            ? 'bg-gray-700 text-gray-400'
                            : 'bg-gray-100 text-gray-600'
                          }`}>
                          +{employee.skills.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'
                  }`}>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/employees/${employee.id}`)}
                      className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition ${darkMode
                          ? 'text-blue-400 hover:text-blue-300 hover:bg-gray-700'
                          : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                        }`}
                    >
                      View Profile
                    </button>
                    {canManageEmployees && (
                      <>
                        <button
                          onClick={() => handleEditEmployee(employee)}
                          className={`py-2 px-4 text-sm font-medium rounded-md transition flex items-center gap-1 ${darkMode
                              ? 'text-indigo-400 hover:text-indigo-300 hover:bg-gray-700'
                              : 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50'
                            }`}
                          title="Edit employee"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => confirmDeleteEmployee(employee)}
                          className={`py-2 px-4 text-sm font-medium rounded-md transition flex items-center gap-1 ${darkMode
                              ? 'text-red-400 hover:text-red-300 hover:bg-gray-700'
                              : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                            }`}
                          title="Remove employee"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {!loading && totalElements > 0 && (
        <div className='flex-shrink-0'>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalElements={totalElements}
            size={pageSize}
            onPageChange={handlePageChange}
            darkMode={darkMode}
          />
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className={`rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto scale-in ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
            }`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                Edit Employee
              </h2>
              <button onClick={() => setShowEditModal(false)}>
                <X className={`w-6 h-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Username</label>
                <input
                  type="text"
                  value={editFormData.username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFormData({ ...editFormData, username: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900'
                    }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>First Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900'
                      }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Last Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.lastName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900'
                      }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Role</label>
                <select
                  value={editFormData.role}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditFormData({ ...editFormData, role: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100'
                      : 'bg-white border-gray-300 text-gray-900'
                    }`}
                >
                  <option value="USER">USER</option>
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="MANAGER">MANAGER</option>
                  {user?.role === 'ADMIN' && (
                    <option value="ADMIN">ADMIN ⚠️</option>
                  )}
                </select>
              </div>

              {user?.role === 'ADMIN' && editFormData.role === 'ADMIN' && (
                <div className={`p-4 border-2 rounded-lg ${darkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'
                  }`}>
                  <div className="flex items-start gap-3">
                    <Shield className={`w-5 h-5 flex-shrink-0 mt-0.5 ${darkMode ? 'text-red-400' : 'text-red-600'}`} />
                    <div>
                      <p className={`font-semibold mb-2 ${darkMode ? 'text-red-300' : 'text-red-900'}`}>⚠️ Promote to ADMIN?</p>
                      <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-800'}`}>
                        This user will have <strong>full system access</strong>, including:
                      </p>
                      <ul className={`text-sm list-disc list-inside mt-2 space-y-1 ${darkMode ? 'text-red-400' : 'text-red-800'}`}>
                        <li>Manage all users (including other admins)</li>
                        <li>Delete any data or accounts</li>
                        <li>Promote/demote any role</li>
                        <li>Access all teams and departments</li>
                      </ul>
                      <p className={`text-xs mt-2 font-semibold ${darkMode ? 'text-red-300' : 'text-red-700'}`}>
                        Only promote trusted users!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Department</label>
                <select
                  value={editFormData.department}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditFormData({ ...editFormData, department: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100'
                      : 'bg-white border-gray-300 text-gray-900'
                    }`}
                >
                  <option value="">-- Select Department --</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Hourly Rate ($/hour)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editFormData.hourlyRate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFormData({ ...editFormData, hourlyRate: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  placeholder="25.00"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Max Weekly Hours
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={editFormData.maxWeeklyHours}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFormData({ ...editFormData, maxWeeklyHours: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900'
                    }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Skills
                </label>
                <SkillsInput
                  employeeId={selectedEmployee?.id}
                  initialSkills={editEmployeeSkills}
                  onSkillsChange={async (updatedSkills) => {
                    setEditEmployeeSkills(updatedSkills);

                    try {
                      const skillsResponse = await fetch(
                        `http://localhost:8080/api/employees/${selectedEmployee.id}/skills`,
                        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
                      );

                      if (skillsResponse.ok) {
                        const freshSkills = await skillsResponse.json();
                        setEditEmployeeSkills(freshSkills);
                      }
                    } catch (error: any) {
                      console.error('Error refreshing skills:', error);
                    }
                  }}
                  readOnly={false}
                />
                <p className={`text-xs mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Add or remove employee skills
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 rounded-lg hover:shadow-lg transition"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== CREATE EMPLOYEE MODAL ===== */}
      {showCreateModal && canManageEmployees && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className={`rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto scale-in ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
            }`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                Add New Employee
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchUsers}
                  className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    }`}
                  title="Refresh user list"
                >
                  <RefreshCw className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                </button>
                <button onClick={() => setShowCreateModal(false)}>
                  <X className={`w-6 h-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                </button>
              </div>
            </div>

            <div className={`mb-4 p-3 border rounded-lg ${darkMode
                ? 'bg-blue-900/20 border-blue-700 text-blue-300'
                : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
              <p className="text-sm">
                <strong>Note:</strong> Creating an employee profile will automatically promote the user from USER to EMPLOYEE role.
              </p>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4">
              {/* User Selection */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select User *
                </label>
                <select
                  required
                  value={formData.userId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, userId: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100'
                      : 'bg-white border-gray-300 text-gray-900'
                    }`}
                >
                  <option value="">-- Select a User --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.email})
                    </option>
                  ))}
                </select>
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Only users with USER role from your company are shown
                </p>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, firstName: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, lastName: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    placeholder='Doe'
                  />
                </div>
              </div>

              {/* Position */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Position
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, position: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  placeholder="e.g., Software Engineer"
                />
              </div>

              {/* Department */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Department *
                  <span className={`text-xs ml-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    ({departments.length} departments available)
                  </span>
                </label>
                <select
                  required
                  value={formData.department}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, department: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100'
                      : 'bg-white border-gray-300 text-gray-900'
                    }`}
                >
                  <option value="">-- Select Department --</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {departments.length === 0 && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                    <span>⚠️</span>
                    <span>No departments found. Please create departments first in the Departments page.</span>
                  </p>
                )}
              </div>

              {/* Hire Date */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Hire Date
                </label>
                <input
                  type="date"
                  value={formData.hireDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, hireDate: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100'
                      : 'bg-white border-gray-300 text-gray-900'
                    }`}
                />
              </div>

              {/* Hourly Rate */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Hourly Rate (Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.hourlyRate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  placeholder="25.00"
                />
              </div>

              {/* Skills Section */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Skills
                </label>
                <SkillsInput
                  employeeId={null}
                  initialSkills={selectedSkills}
                  onSkillsChange={setSelectedSkills}
                  readOnly={false}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={departments.length === 0}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 rounded-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {departments.length === 0 ? 'Create Departments First' : 'Create Employee Profile'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== SUCCESS MODAL ===== */}
      {showSuccessModal && createdUserInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className={`rounded-lg p-6 w-full max-w-md scale-in ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
            }`}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                Employee Created!
              </h3>
              <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                <strong>{createdUserInfo.username}</strong> has been promoted to EMPLOYEE
              </p>
            </div>

            <div className={`border-2 rounded-lg p-4 mb-6 ${darkMode
                ? 'bg-yellow-900/20 border-yellow-700'
                : 'bg-yellow-50 border-yellow-200'
              }`}>
              <div className="flex items-start gap-3">
                <RefreshCw className={`w-5 h-5 flex-shrink-0 mt-0.5 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'
                  }`} />
                <div>
                  <p className={`font-semibold mb-1 ${darkMode ? 'text-yellow-300' : 'text-yellow-900'
                    }`}>
                    Action Required for {createdUserInfo.username}:
                  </p>
                  <p className={`text-sm ${darkMode ? 'text-yellow-400' : 'text-yellow-800'
                    }`}>
                    To access employee features, they must:
                  </p>
                  <ol className={`text-sm list-decimal list-inside mt-2 space-y-1 ${darkMode ? 'text-yellow-400' : 'text-yellow-800'
                    }`}>
                    <li><strong>Refresh the page</strong> (F5 or Ctrl+R)</li>
                    <li>Or <strong>log out and log back in</strong></li>
                  </ol>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowSuccessModal(false);
                setCreatedUserInfo(null);
              }}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* ===== DELETE MODAL ===== */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className={`rounded-lg p-6 w-full max-w-md scale-in ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
            }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${darkMode ? 'bg-red-900/30' : 'bg-red-100'
                }`}>
                <AlertTriangle className={`w-6 h-6 ${darkMode ? 'text-red-400' : 'text-red-600'
                  }`} />
              </div>
              <h3 className={`text-lg font-bold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                Remove Employee
              </h3>
            </div>

            <div className="mb-6">
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Are you sure you want to remove <strong>{userToDelete.firstName} {userToDelete.lastName}</strong> from the platform?
              </p>

              <div className={`border rounded-lg p-4 ${darkMode
                  ? 'bg-red-900/20 border-red-700'
                  : 'bg-red-50 border-red-200'
                }`}>
                <p className={`text-sm font-semibold mb-2 ${darkMode ? 'text-red-300' : 'text-red-800'
                  }`}>
                  ⚠️ This action will:
                </p>
                <ul className={`text-sm space-y-1 list-disc list-inside ${darkMode ? 'text-red-400' : 'text-red-700'
                  }`}>
                  <li>Delete their user account</li>
                  <li>Remove their employee profile</li>
                  <li>Delete all their task assignments</li>
                  <li>Remove them from any teams</li>
                  <li>Delete all their chat messages</li>
                </ul>
                <p className={`text-sm font-semibold mt-3 ${darkMode ? 'text-red-300' : 'text-red-800'
                  }`}>
                  This action cannot be undone!
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                className={`flex-1 px-4 py-2 border rounded-lg transition ${darkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEmployee}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Yes, Remove Employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesPage;