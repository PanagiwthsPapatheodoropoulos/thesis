/**
 * @file EmployeeProfilePage.jsx
 * @description Page component displaying detailed profile, skills, and productivity for a specific employee.
 */
// src/pages/EmployeeProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Briefcase, Calendar, Award, ArrowLeft, RefreshCw} from 'lucide-react';
import { employeesAPI } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';
import SkillRadarChart from '../components/SkillRadarChart';
import EmployeeProductivityChart from '../components/EmployeeProductivityChart';
import type { Employee, EmployeeSkill, Task, TaskAssignment } from '../types';


/**
 * EmployeeProfilePage Component
 * 
 * Retrieves and visualizes employee details based on the URL parameter ID.
 * Shows personal info, skills radar chart, and productivity history.
 * 
 * @returns {React.ReactElement} The employee profile UI.
 */
const EmployeeProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchEmployee();
    
    // Listen for profile updates
    const handleProfileUpdate = (event) => {
      const { profileImageUrl, userId } = event.detail;
      if (employee && employee.userId === userId) {
        fetchEmployee();
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [id, employee?.userId]);

  /**
   * Fetches the employee's main profile and their assigned skills.
   * 
   * @async
   * @function fetchEmployee
   * @returns {Promise<void>}
   */
  const fetchEmployee = async () => {
    try {
      setLoading(true);
      const data = await employeesAPI.getById(id);
      
      // Always fetch skills separately
      try {
        const skills = await employeesAPI.getSkills(id);
        
        // Ensure skills is always an array
        data.skills = Array.isArray(skills) ? skills : [];
        
      } catch (skillError) {
        data.skills = [];
      }
      
      setEmployee(data);
    } catch (error: any) {
      console.error('Error fetching employee:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Employee not found</p>
        <button
          onClick={() => navigate('/employees')}
          className={`mt-4 ${darkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
        >
          ← Back to Employees
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate('/employees')}
          className={`flex items-center gap-2 font-medium ${
            darkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Employees
        </button>
        
        <button
          onClick={fetchEmployee}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            darkMode 
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex items-center gap-6 mb-6">
          {employee.profileImageUrl ? (
            <img
              key={employee.profileImageUrl}
              src={employee.profileImageUrl}
              alt={`${employee.firstName} ${employee.lastName}`}
              className="w-24 h-24 rounded-full object-cover border-4 border-indigo-100"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
              <User className="w-12 h-12" />
            </div>
          )}
          <div>
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              {employee.firstName} {employee.lastName}
            </h1>
            <p className={`mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {employee.position || 'No position specified'}
            </p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center gap-3">
            <Briefcase className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <div>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Department</p>
              <p className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                {employee.department || 'Not assigned'}
              </p>
            </div>
          </div>

          {employee.hireDate && (
            <div className="flex items-center gap-3">
              <Calendar className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <div>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Hire Date</p>
                <p className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                  {new Date(employee.hireDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {employee.hourlyRate && (
            <div className="flex items-center gap-3">
              <span className={`text-lg font-bold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                ${employee.hourlyRate}/hr
              </span>
            </div>
          )}

          {employee.maxWeeklyHours && (
            <div>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Max Weekly Hours</p>
              <p className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                {employee.maxWeeklyHours}h/week
              </p>
            </div>
          )}
        </div>

        {/* Skills Section */}
        {/* Skills Section */}
        {employee.skills && Array.isArray(employee.skills) && (
        <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <Award className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              Skills ({employee.skills.length})
            </h3>
          </div>
            
            {employee.skills.length > 0 ? (
              <>
                {/* Skill Radar Chart */}
                <div className="mb-6">
                  <SkillRadarChart 
                    skills={employee.skills
                      .filter(s => {
                        if (!s || !s.skillName || s.proficiencyLevel === null || s.proficiencyLevel === undefined) {
                          return false;
                        }
                        const proficiency = Number(s.proficiencyLevel);
                        if (isNaN(proficiency) || proficiency < 0 || proficiency > 5) {
                          return false;
                        }
                        return true;
                      })
                      .map(s => ({
                        name: s.skillName,
                        proficiencyLevel: Number(s.proficiencyLevel)
                      }))}
                    darkMode={darkMode}
                    title="Employee Skill Proficiency"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {employee.skills.map((skill) => (
                    <div 
                      key={skill.id} 
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        darkMode ? 'bg-blue-900/30' : 'bg-blue-50'
                      }`}
                    >
                      <span className={`font-medium ${darkMode ? 'text-blue-200' : 'text-blue-900'}`}>
                        {skill.skillName}
                      </span>
                      <span className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                        Level {skill.proficiencyLevel}/5
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="text-center py-8">
                  <Award className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    No Skills Recorded
                  </p>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-2`}>
                    This employee hasn't added any skills yet
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Productivity Chart Section */}
        <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <EmployeeProductivityChart 
            employeeId={employee.id} 
            darkMode={darkMode} 
          />
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfilePage;