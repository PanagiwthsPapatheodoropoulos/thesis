/**
 * @file DepartmentsPage.jsx
 * @description Page component for managing company departments and viewing associated employees.
 */
//src/pages/DepartmentsPage.jsx
import React, { useState, useEffect } from 'react';
import { Building2, Users, Search, ChevronDown, ChevronUp, Plus, X, Trash2, User } from 'lucide-react';
import { departmentsAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

/**
 * DepartmentsPage Component
 * 
 * Lists departments, allowing authorized roles to create or delete them.
 * Shows employees belonging to a selected department.
 * 
 * @returns {React.ReactElement} The departments UI.
 */
const DepartmentsPage = () => {
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDept, setExpandedDept] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchDepartments();
  }, []);

  //Listen for profile updates
  useEffect(() => {
    const handleProfileUpdate = () => {
      fetchDepartments();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  /**
   * Fetches all departments from the API.
   * 
   * @async
   * @function fetchDepartments
   * @returns {Promise<void>}
   */
  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const data = await departmentsAPI.getAll();
      setDepartments(data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Creates a new department using current form data.
   * 
   * @async
   * @function handleCreateDepartment
   * @param {React.FormEvent} e - The form submission event.
   * @returns {Promise<void>}
   */
  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    try {
      await departmentsAPI.create(formData);
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
      fetchDepartments();
    } catch (error) {
      alert('Error creating department: ' + error.message);
    }
  };

  /**
   * Prompts the user and attempts to delete a designated department.
   * 
   * @async
   * @function handleDeleteDepartment
   * @param {string} name - The name of the department to delete.
   * @returns {Promise<void>}
   */
  const handleDeleteDepartment = async (name) => {
    if (window.confirm(`Delete department "${name}"? This will fail if there are employees assigned.`)) {
      try {
        await departmentsAPI.delete(name);
        fetchDepartments();
      } catch (error) {
        alert('Error deleting department: ' + error.message);
      }
    }
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Departments</h1>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>Overview of all departments and their employees</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchDepartments}
            className={`px-4 py-2 rounded-lg transition ${
              darkMode 
                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Refresh
          </button>

          {/*Only Admin/Manager can create departments */}
          {canManage && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition"
            >
              <Plus className="w-5 h-5" />
              New Department
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className={`rounded-lg shadow p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-10 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
              darkMode 
                ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
      </div>

      {/* Department Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Departments</p>
              <p className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{departments.length}</p>
            </div>
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Employees</p>
              <p className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                {departments.reduce((sum, dept) => sum + dept.employeeCount, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Avg per Department</p>
              <p className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                {departments.length > 0 
                  ? Math.round(departments.reduce((sum, dept) => sum + dept.employeeCount, 0) / departments.length)
                  : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Departments List */}
      <div className="space-y-4">
        {filteredDepartments.map((dept) => (
          <div key={dept.name} className={`rounded-lg shadow card-hover ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="px-6 py-4 flex items-center justify-between">
              <button
                onClick={() => setExpandedDept(expandedDept === dept.name ? null : dept.name)}
                className="flex items-center gap-4 flex-1 text-left"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{dept.name}</h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {dept.employeeCount} employee{dept.employeeCount !== 1 ? 's' : ''}
                  </p>
                  {dept.description && (
                    <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{dept.description}</p>
                  )}
                </div>
                {expandedDept === dept.name ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {canManage && (
                <button
                  onClick={() => handleDeleteDepartment(dept.name)}
                  className={`ml-4 p-2 rounded-lg transition ${
                    darkMode 
                      ? 'text-red-400 hover:bg-red-900/20' 
                      : 'text-red-600 hover:bg-red-50'
                  }`}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            {expandedDept === dept.name && (
              <div className={`px-6 pb-4 border-t slide-up ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="pt-4 space-y-2">
                  {dept.employees && dept.employees.length > 0 ? (
                    dept.employees.map((employee) => (
                      <div
                        key={employee.id}
                        className={`flex items-center gap-3 p-3 rounded-lg transition ${
                          darkMode 
                            ? 'bg-gray-700 hover:bg-gray-600' 
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        {employee.profileImageUrl ? (
                          <img 
                            key={employee.profileImageUrl} // Force re-render
                            src={employee.profileImageUrl} 
                            alt={`${employee.firstName} ${employee.lastName}`}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                            <User className="w-5 h-5" />
                          </div>
                        )}

                        <div className="flex-1">
                          <p className={`font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                            {employee.firstName} {employee.lastName}
                          </p>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{employee.position || 'No position'}</p>
                        </div>
                        {employee.skills && employee.skills.length > 0 && (
                          <div className="flex gap-1">
                            {employee.skills.slice(0, 3).map((skill) => (
                              <span
                                key={skill.id}
                                className={`px-2 py-1 text-xs rounded-full ${
                                  darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-50 text-blue-700'
                                }`}
                              >
                                {skill.skillName}
                              </span>
                            ))}
                            {employee.skills.length > 3 && (
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                              }`}>
                                +{employee.skills.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No employees in this department</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredDepartments.length === 0 && (
        <div className={`text-center py-12 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <Building2 className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No departments found</p>
        </div>
      )}

      {/* Create Modal */}
      {canManage && showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className={`rounded-lg p-6 w-full max-w-md slide-up scale-in ${
            darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                Create New Department
              </h2>
              <button onClick={() => setShowCreateModal(false)}>
                <X className={`w-6 h-6 ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'}`} />
              </button>
            </div>
            <form onSubmit={handleCreateDepartment} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                    darkMode 
                      ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder="e.g., Engineering, Marketing"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                    darkMode 
                      ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  rows="3"
                  placeholder="Brief description of the department"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 rounded-lg hover:shadow-lg transition"
              >
                Create Department
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentsPage;