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
import { Plus, Briefcase, Calendar, Award, X, RefreshCw, Trash2, AlertTriangle, Edit, Shield, User as UserIcon, Ban } from 'lucide-react';
import { employeesAPI, usersAPI, departmentsAPI, notificationsAPI, blocklistAPI, getAuthHeaders } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useWebSocket, EVENT_TYPES } from '../contexts/WebSocketProvider';
import SkillsInput from '../components/SkillsInput';
import Pagination from '../components/Pagination';
import { PageHeader, SearchBar, LoadingSpinner, EmptyState } from '../components/ui';
import PromotionModal from '../components/PromotionModal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { parseUTCDate } from '../utils/dateUtils';
import { CustomDatePicker } from '../components/CustomDatePicker';
import type { Employee, User, EmployeeSkill } from '../types';

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
  const { showToast } = useToast();
  const confirm = useConfirm();

  // Data State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  const [activeTab, setActiveTab] = useState<'EMPLOYEE' | 'MANAGER'>('EMPLOYEE');


  // Modal State
  const [editEmployeeSkills, setEditEmployeeSkills] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [createdUserInfo, setCreatedUserInfo] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [userToDelete, setUserToDelete] = useState<Employee | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<EmployeeSkill[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState<boolean>(false);
  const userDropdownRef = React.useRef<HTMLDivElement>(null);

  // Destructure ready state
  const { ready, subscribe } = useWebSocket();

  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Promotion Modal State
  const [showPromotionModal, setShowPromotionModal] = useState<boolean>(false);
  const [promotionRole, setPromotionRole] = useState<string>('Employee');


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
  }, [currentPage, pageSize, sortBy, sortDir, departmentFilter, positionFilter, refreshTrigger, activeTab]);



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
    const handleProfileUpdate = (event: any) => {
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

  // Close user dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Fetches a paginated employee list and enriches each record with current skill data.
   * Falls back to an empty skills array if the skills endpoint is unavailable.
   */
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // 1. Fetch Paginated Data
      const response = await employeesAPI.getAllPaginated(
        currentPage,
        pageSize,
        sortBy,
        sortDir,
        {
          ...(departmentFilter !== 'ALL' && { department: departmentFilter }),
          ...(positionFilter !== 'ALL' && { position: positionFilter }),
          ...(searchTerm && { search: searchTerm }),
          role: activeTab
        }
      );

      const pageContent = response.content || [];

      // 2. Fetch Skills for the visible page
      const employeesWithSkills = await Promise.all(
        pageContent.map(async (employee: Employee) => {
          try {
            const skills = await employeesAPI.getSkills(employee.id);
            return { ...employee, skills: Array.isArray(skills) ? skills : [] };
          } catch (error: any) {
            return { ...employee, skills: [] };
          }
        })
      );

      setEmployees(employeesWithSkills);
      setTotalPages(response.totalPages);
      setTotalElements(response.totalElements);

    } catch (error: any) {
      setErrorMessage('Unable to load employee directory.');
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
      // Handled silently
    }
  };




  /**
   * Dismisses a pending user from the company without blocking them.
   * The user's company is set to null and they can re-register with a new join code.
   * @param {Object} pendingUser - The user object to dismiss.
   */
  const handleDismissUser = async (pendingUser: User) => {
    const isConfirmed = await confirm({
      title: 'Dismiss Pending User',
      message: `Dismiss ${pendingUser.username}? They will be removed from the company but can re-join later with a new code.`,
      confirmText: 'Dismiss',
      variant: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await usersAPI.removeFromCompany(pendingUser.id, 'DISMISSED');
      showToast(`${pendingUser.username} has been dismissed from the company.`, 'success');
      await fetchUsers();
    } catch (e: any) {
      showToast('Failed to dismiss user: ' + e.message, 'error');
    }
  };

  /**
   * Blocks a pending user's email and removes them from the company.
   * The user cannot re-register with this company.
   * @param {Object} pendingUser - The user object to block.
   */
  const handleBlockUserFromDropdown = async (pendingUser: User) => {
    const isConfirmed = await confirm({
      title: 'Block User Email',
      message: `Block ${pendingUser.email} from joining this company? This action will permanently prevent them from re-joining.`,
      confirmText: 'Block Email',
      variant: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await blocklistAPI.block(pendingUser.email);
      await usersAPI.removeFromCompany(pendingUser.id, 'BLOCKED');
      showToast(`${pendingUser.email} has been blocked and removed from the company.`, 'success');
      await fetchUsers();
    } catch (e: any) {
      showToast('Failed to block: ' + e.message, 'error');
    }
  };


  /**
   * Handles page and page size changes from the Pagination component.
   * Resets to page 0 when page size changes.
   * @param {number} newPage - The target page index (0-based).
   * @param {number} [newSize] - Optional updated page size.
   */
  const handlePageChange = (newPage: number, newSize?: number) => {
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
  const handleEditEmployee = async (employee: Employee) => {
    try {
      const employeeUser = await usersAPI.getById(employee.userId);
      let currentSkills = [];
      try {
        currentSkills = await employeesAPI.getSkills(employee.id);
      } catch (e) {
        showToast('Error loading skills for edit', 'error');
      }

      setSelectedEmployee(employee);
      setEditEmployeeSkills(Array.isArray(currentSkills) ? currentSkills : []);
      setEditFormData({
        username: employeeUser.username,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: employeeUser.role,
        department: employee.department,
        hourlyRate: employee.hourlyRate?.toString() || '',
        maxWeeklyHours: employee.maxWeeklyHours || 40
      });
      setShowEditModal(true);
    } catch (error: any) {
      showToast('Error loading employee data: ' + error.message, 'error');
    }
  };

  /**
   * Persists edits to an employee record, including role promotion and optional username change.
   * Sends an in-app notification if the employee's role is changed.
   * @param {React.FormEvent} e - The form submit event.
   */
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const originalUser = await usersAPI.getById(selectedEmployee.userId);

      await usersAPI.update(selectedEmployee.userId!, { role: editFormData.role });

      if (editFormData.username !== originalUser.username) {
        await usersAPI.updateUsername(selectedEmployee.userId!, editFormData.username);
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
        if (selectedEmployee.userId === user?.id) {
          setPromotionRole(editFormData.role);
          setShowPromotionModal(true);
        }

        const roleNames: Record<string, string> = { 'ADMIN': 'Administrator', 'MANAGER': 'Manager', 'EMPLOYEE': 'Employee', 'USER': 'Basic User' };
        showToast(`Employee role updated to ${roleNames[editFormData.role]}! User must log in again to see changes.`, 'success');
        await notificationsAPI.create({
          userId: selectedEmployee.userId,
          type: 'ROLE_PROMOTION',
          title: '🎉 Your Role Has Been Updated',
          message: `You have been promoted to ${roleNames[editFormData.role]}. Please log out and log back in to access your new features.`,
          severity: 'SUCCESS'
        });

        // Auto-switch to the tab matching the new role so the admin sees the result
        if (editFormData.role === 'MANAGER') {
          setActiveTab('MANAGER');
        } else if (editFormData.role === 'EMPLOYEE') {
          setActiveTab('EMPLOYEE');
        }
      }

      setShowEditModal(false);
      await fetchEmployees();
    } catch (error: any) {
      showToast('Error updating employee: ' + error.message, 'error');
    }
  };

  /**
   * Sets the target employee and opens the delete confirmation dialog.
   * @param {Object} employee - The employee record to stage for deletion.
   */
  const confirmDeleteEmployee = (employee: Employee) => {
    setUserToDelete(employee);
    setShowDeleteModal(true);
  };

  /**
   * Creates a new employee profile linked to an existing user account.
   * Sequentially resolves and assigns the selected skills after creation.
   * @param {React.FormEvent} e - The form submit event.
   */
  const handleCreateEmployee = async (e: React.FormEvent) => {
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
        await fetchUsers();
      } catch (error: any) {
        showToast('Error creating employee: ' + error.message, 'error');
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
            const skillResponse = await fetch('/api/skills/name/' + encodeURIComponent(skill.skillName), {
              headers: getAuthHeaders()
            });

            if (skillResponse.ok) {
              skillData = await skillResponse.json();
            } else {
              const createResponse = await fetch('/api/skills', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name: skill.skillName, category: skill.skillCategory || 'Other', description: '' })
              });
              if (!createResponse.ok) throw new Error(`Failed to create skill: ${createResponse.status}`);
              skillData = await createResponse.json();
            }

            await fetch(`/api/employees/${createdEmployee.id}/skills`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                skillId: skillData.id,
                proficiencyLevel: skill.proficiencyLevel || 3,
                yearsOfExperience: skill.yearsOfExperience || 0,
                lastUsed: skill.lastUsed || null
              })
            });
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (skillError) {
            // Skill failed to add, handled silently
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
      await fetchUsers();

    } catch (error: any) {
      showToast('Error creating employee: ' + error.message, 'error');
    }
  };

  /**
   * Deletes the staged employee's user account and removes the employee record.
   * Refreshes the directory after successful deletion.
   */
  const handleDeleteEmployee = async () => {
    if (!userToDelete) return;
    try {
      await usersAPI.delete(userToDelete.userId!);
      showToast(`${userToDelete.firstName} ${userToDelete.lastName} has been removed`, 'success');
      setShowDeleteModal(false);
      setUserToDelete(null);
      await fetchEmployees();
    } catch (error: any) {
      showToast('Error deleting employee: ' + error.message, 'error');
    }
  };

  // ===== RENDER =====
  return (
    <div className="h-full flex flex-col"> 

      {/* Header */}
      <PageHeader
        title="Employee Management"
        description={totalElements > 0 ? `Total: ${totalElements} ${activeTab.toLowerCase()}s` : 'Manage your team members and roles'}
        darkMode={darkMode}
        action={
          canManageEmployees && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition shadow-md"
            >
              <Plus className="w-5 h-5" />
              Add Employee
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className={`flex-shrink-0 flex border-b mb-6 ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
        <button
          onClick={() => {
            setActiveTab('EMPLOYEE');
            setCurrentPage(0);
          }}
          className={`px-8 py-3 font-medium transition-all relative ${
            activeTab === 'EMPLOYEE'
              ? 'text-indigo-500'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4" />
            Employees
          </div>
          {activeTab === 'EMPLOYEE' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('MANAGER');
            setCurrentPage(0);
          }}
          className={`px-8 py-3 font-medium transition-all relative ${
            activeTab === 'MANAGER'
              ? 'text-purple-500'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Managers
          </div>
          {activeTab === 'MANAGER' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500 rounded-t-full" />
          )}
        </button>
      </div>

        {errorMessage && (
          <div className={`mb-4 border-2 rounded-lg p-4 flex items-start gap-3 ${
            darkMode ? 'bg-red-900/20 border-red-700 text-red-200' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <AlertTriangle className={`w-5 h-5 mt-0.5 ${darkMode ? 'text-red-300' : 'text-red-600'}`} />
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}
      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search employees..."
        darkMode={darkMode}
        filters={
          <>
            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDepartmentFilter(e.target.value)}
              className={`px-4 py-2 rounded-lg outline-none border transition duration-200 cursor-pointer ${
                darkMode
                  ? 'bg-gray-700 text-gray-100 border-gray-600 focus:border-indigo-500'
                  : 'bg-white text-gray-900 border-gray-300 hover:border-gray-400 focus:border-indigo-500'
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
              className={`px-4 py-2 rounded-lg outline-none border transition duration-200 cursor-pointer ${
                darkMode
                  ? 'bg-gray-700 text-gray-100 border-gray-600 focus:border-indigo-500'
                  : 'bg-white text-gray-900 border-gray-300 hover:border-gray-400 focus:border-indigo-500'
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
              className={`px-4 py-2 rounded-lg outline-none border transition duration-200 cursor-pointer ${
                darkMode
                  ? 'bg-gray-700 text-gray-100 border-gray-600 focus:border-indigo-500'
                  : 'bg-white text-gray-900 border-gray-300 hover:border-gray-400 focus:border-indigo-500'
              }`}
            >
              <option value="firstName-asc">Name (A-Z)</option>
              <option value="firstName-desc">Name (Z-A)</option>
              <option value="hireDate-desc">Hire Date (Newest)</option>
              <option value="hireDate-asc">Hire Date (Oldest)</option>
              <option value="department-asc">Department (A-Z)</option>
            </select>
          </>
        }
      />

      {/* Employees Grid */}
      <div className='flex-1 overflow-auto mb-6'>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading && employees.length === 0 ? (
            <div className="col-span-3 flex items-center justify-center h-64">
              <LoadingSpinner size="lg" darkMode={darkMode} />
            </div>
          ) : employees.length === 0 ? (
            <div className="col-span-3">
              <EmptyState
                title={`No ${activeTab.toLowerCase()}s found`}
                description="Try adjusting your filters or search term to locate the records."
                darkMode={darkMode}
              />
            </div>
          ) : (
            employees.map((employee, index) => (
              <div
                key={employee.id}
                className={`rounded-lg shadow hover:shadow-lg transition p-6 border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
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
                      <UserIcon className="w-8 h-8" />
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
                      <span>Hired: {parseUTCDate(employee.hireDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {employee.skills && Array.isArray(employee.skills) && employee.skills.length > 0 && (
                  <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-300'
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
                          className={`px-2 py-0.5 text-xs rounded-md border ${
                            darkMode
                              ? 'bg-blue-900/40 text-blue-300 border-blue-800/60'
                              : 'bg-blue-50/60 text-blue-700 border-blue-300'
                          }`}
                        >
                          {skill.skillName}
                        </span>
                      ))}
                      {employee.skills.length > 5 && (
                        <span className={`px-2 py-0.5 text-xs rounded-md border ${
                          darkMode
                            ? 'bg-gray-900/30 text-gray-400 border-gray-800'
                            : 'bg-gray-50 text-gray-600 border-gray-300'
                        }`}>
                          +{employee.skills.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-300'
                  }`}>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/employees/${employee.id}`)}
                      className={`flex-1 py-2 px-4 text-sm font-medium rounded-md border transition ${darkMode
                          ? 'text-blue-400 border-blue-950 hover:text-blue-300 hover:bg-gray-700'
                          : 'text-blue-600 border-blue-200 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-400'
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFormData({ ...editFormData, maxWeeklyHours: e.target.value as any })}
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
                      const freshSkills = await employeesAPI.getSkills(selectedEmployee.id);
                      setEditEmployeeSkills(freshSkills);
                    } catch (error) {
                      // Handled silently
                    }
                  }}
                  readOnly={false}
                />
                <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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
              {/* Custom User Selection Dropdown with inline actions */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select User *
                </label>
                {/* Hidden required input for form validation */}
                <input type="hidden" required value={formData.userId} />
                <div className="relative" ref={userDropdownRef}>
                  {/* Dropdown trigger */}
                  <button
                    type="button"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className={`w-full px-3 py-2.5 border rounded-lg text-left flex items-center justify-between transition ${
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-100 hover:border-gray-500'
                        : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                    } ${showUserDropdown ? `ring-2 ${darkMode ? 'ring-indigo-400 border-indigo-400' : 'ring-indigo-500 border-indigo-500'}` : ''}`}
                  >
                    {formData.userId ? (
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          darkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-600'
                        }`}>
                          {users.find(u => u.id === formData.userId)?.username?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="text-sm font-medium truncate">
                          {users.find(u => u.id === formData.userId)?.username || 'Unknown'}
                        </span>
                        <span className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          ({users.find(u => u.id === formData.userId)?.email || ''})
                        </span>
                      </div>
                    ) : (
                      <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        -- Select a User ({users.length} pending) --
                      </span>
                    )}
                    <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${showUserDropdown ? 'rotate-180' : ''} ${
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown panel */}
                  {showUserDropdown && (
                    <div className={`absolute z-50 w-full mt-1 rounded-xl border shadow-xl overflow-hidden ${
                      darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                    }`}>
                      {users.length === 0 ? (
                        <div className={`px-4 py-6 text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          <UserIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm font-medium">No pending users</p>
                          <p className="text-xs mt-1">All users have been assigned employee profiles.</p>
                        </div>
                      ) : (
                        <div className="max-h-56 overflow-y-auto">
                          {users.map(u => (
                            <div
                              key={u.id}
                              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition ${
                                formData.userId === u.id
                                  ? (darkMode ? 'bg-indigo-900/40 border-l-2 border-indigo-400' : 'bg-indigo-50 border-l-2 border-indigo-500')
                                  : (darkMode ? 'hover:bg-gray-700/70 border-l-2 border-transparent' : 'hover:bg-gray-50 border-l-2 border-transparent')
                              }`}
                            >
                              {/* Clickable user row for selection */}
                              <div
                                className="flex items-center gap-3 flex-1 min-w-0"
                                onClick={() => {
                                  setFormData({ ...formData, userId: u.id });
                                  setShowUserDropdown(false);
                                }}
                              >
                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                  darkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-600'
                                }`}>
                                  {u.username?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                {/* User info */}
                                <div className="min-w-0">
                                  <p className={`text-sm font-medium truncate ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                                    {u.username}
                                  </p>
                                  <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {u.email}
                                  </p>
                                </div>
                              </div>

                              {/* Inline action buttons */}
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDismissUser(u); }}
                                  className={`p-1.5 rounded-lg transition ${
                                    darkMode
                                      ? 'text-gray-500 hover:text-amber-400 hover:bg-amber-900/30'
                                      : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                  }`}
                                  title={`Dismiss — can re-join later`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleBlockUserFromDropdown(u); }}
                                  className={`p-1.5 rounded-lg transition ${
                                    darkMode
                                      ? 'text-gray-500 hover:text-red-400 hover:bg-red-900/30'
                                      : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                  }`}
                                  title={`Block — permanently prevent from joining`}
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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
                  <span className={`text-xs ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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
                <CustomDatePicker
                  mode="date"
                  value={formData.hireDate}
                  onChange={(val) => setFormData({ ...formData, hireDate: val })}
                  placeholder="Select hire date"
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
      {/* Promotion Modal for session refresh */}
      <PromotionModal 
        isOpen={showPromotionModal} 
        onClose={() => setShowPromotionModal(false)}
        roleName={promotionRole}
        message={`Your account role has been updated to ${promotionRole}.`}
      />
    </div>
  );
};

export default EmployeesPage;