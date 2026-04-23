/**
 * @file ProfilePage.jsx
 * @description Page component allowing users to view and edit their own profile details.
 */
import React, { useState, useEffect } from 'react';
import { User, Mail, Briefcase, Calendar, Upload, Save, RefreshCw,Building2,Award,TrendingUp } from 'lucide-react';
import { usersAPI, employeesAPI } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import SkillsInput from '../components/SkillsInput';
import SkillRadarChart from '../components/SkillRadarChart';
import { useAuth } from '../contexts/AuthContext';
import EmployeeProductivityChart from '../components/EmployeeProductivityChart';
import { incrementProfileImageVersion } from '../utils/api';
import type { Employee, EmployeeSkill } from '../types';

/**
 * ProfilePage Component
 * 
 * Allows users to update their email, username, name, and profile picture.
 * Shows personal skill charts and productivity trends.
 * 
 * @returns {React.ReactElement} The profile UI.
 */
const ProfilePage = () => {
  const { user, login,logout } = useAuth();
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [employee, setEmployee] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    position: '',
    department: '',
    profileImageUrl: ''
  });
  const [imagePreview, setImagePreview] = useState<any>(null);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  /**
   * Fetches the standard user data and their linked employee profile (if any).
   * 
   * @async
   * @function fetchProfile
   * @returns {Promise<void>}
   */
  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      const freshUserData = await usersAPI.getById(user.id);
      setUserData(freshUserData);

      let employeeData = null;
      try {
        employeeData = await employeesAPI.getByUserId(user.id);
        
        if (employeeData?.id) {
          try {
            const skills = await employeesAPI.getSkills(employeeData.id);
            
            // Ensure skills is an array
            employeeData.skills = Array.isArray(skills) ? skills : [];
            
          } catch (skillError) {
            employeeData.skills = [];
          }
        } else {
          employeeData.skills = [];
        }
        
        setEmployee(employeeData);
      } catch (err: any) {
        setEmployee(null);
      }

      setFormData({
        email: freshUserData.email || '',
        username: freshUserData.username || '',
        firstName: employeeData?.firstName || '',
        lastName: employeeData?.lastName || '',
        position: employeeData?.position || '',
        department: employeeData?.department || '',
        profileImageUrl: employeeData?.profileImageUrl || ''
      });

      setImagePreview(employeeData?.profileImageUrl || null);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles user selection of a new profile image. Generates a base64 preview.
   * 
   * @function handleImageChange
   * @param {React.ChangeEvent<HTMLInputElement>} e - The file input change event.
   */
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview((reader.result as string));
        setFormData({ ...formData, profileImageUrl: (reader.result as string) });
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Submits the updated profile data to the server.
   * Handles specific edge cases like a changed username necessitating logout.
   * 
   * @async
   * @function handleSubmit
   * @param {React.FormEvent} e - The form submission event.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const usernameChanged = formData.username && formData.username !== user.username;
      
      if (usernameChanged) {
        try {
          const response = await fetch(`http://localhost:8080/api/users/${user.id}/username`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: formData.username })
          });
          
          if (!response.ok) {
            throw new Error('Failed to update username');
          }
          
          alert('Username updated successfully! Please log in again with your new username.');
          logout();
          navigate('/login');
          return;
          
        } catch (error: any) {
          alert('Error updating username: ' + error.message);
          setSaving(false);
          return;
        }
      }

      if (formData.email !== user.email) {
        await usersAPI.update(user.id, { email: formData.email });
      }

      if (employee && (formData.firstName || formData.lastName || formData.profileImageUrl)) {
        const employeeData = {
          userId: user.id,
          firstName: formData.firstName || employee.firstName,
          lastName: formData.lastName || employee.lastName,
          position: formData.position || employee.position || '',
          department: formData.department || employee.department || '',
          profileImageUrl: formData.profileImageUrl || employee.profileImageUrl || '',
          hireDate: employee.hireDate || new Date().toISOString().split('T')[0],
          maxWeeklyHours: employee.maxWeeklyHours || 40
        };
        
        await employeesAPI.update(employee.id, employeeData);
      }

      const updatedUser = { 
        ...user, 
        email: formData.email,
        username: formData.username 
      };
      login(updatedUser, localStorage.getItem('token'));
      

      incrementProfileImageVersion();

      window.dispatchEvent(new CustomEvent('profileUpdated', { 
        detail: { 
          profileImageUrl: formData.profileImageUrl,
          userId: user.id,
          employeeId: employee?.id,
          timestamp: Date.now(),
          version: incrementProfileImageVersion() 
        }
      }));

      alert('Profile updated successfully!');

      await fetchProfile();
      
    } catch (error: any) {
      alert('Error updating profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>My Profile</h1>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>Manage your personal information</p>
        </div>
        <button
          onClick={fetchProfile}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            darkMode 
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className={`rounded-lg shadow p-6 ${
        darkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Image Section */}
          <div className="flex items-center gap-6">
            <div className="relative">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Profile"
                  className="w-32 h-32 rounded-full object-cover border-4 border-indigo-100"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full cursor-pointer hover:bg-indigo-700 transition">
                <Upload className="w-5 h-5" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>
            <div>
              <h3 className={`text-xl font-bold ${
                darkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                {userData?.username || user?.username}
              </h3>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                  {userData?.role || user?.role}
                </span>
              </p>
              {userData?.teamName && (
                <p className={`text-sm mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Team: <span className="font-medium">{userData.teamName}</span>
                </p>
              )}
              <p className={`text-xs mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Click the upload icon to change your profile picture
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email */}
            <div>
              <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                <Mail className="w-4 h-4" />
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e: React.ChangeEvent<any>) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                required
              />
            </div>

            {/* Username */}
            <div>
              <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                <User className="w-4 h-4" />
                Username
              </label>
              {formData.username !== user.username && (
                <div className={`mb-2 p-2 border rounded text-xs ${
                  darkMode
                    ? 'bg-yellow-900/20 border-yellow-700 text-yellow-300'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                }`}>
                  ⚠️ Changing your username will log you out.
                </div>
              )}
              <input
                type="text"
                value={formData.username}
                onChange={(e: React.ChangeEvent<any>) => setFormData({ ...formData, username: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            {/* First Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                First Name
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e: React.ChangeEvent<any>) => setFormData({ ...formData, firstName: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="John"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e: React.ChangeEvent<any>) => setFormData({ ...formData, lastName: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="Doe"
              />
            </div>

            {/* Position */}
            <div>
              <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                <Briefcase className="w-4 h-4" />
                Position
              </label>
              <input
                type="text"
                value={formData.position}
                disabled
                onChange={(e: React.ChangeEvent<any>) => setFormData({ ...formData, position: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                  darkMode
                    ? 'bg-gray-900 border-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-50 border-gray-300 text-gray-600 cursor-not-allowed'
                }`}
                placeholder="Software Developer"
              />
            </div>

            {/* Department */}
            <div>
              <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                <Calendar className="w-4 h-4" />
                Department
              </label>
              <input
                type="text"
                value={formData.department}
                disabled
                onChange={(e: React.ChangeEvent<any>) => setFormData({ ...formData, department: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                  darkMode
                    ? 'bg-gray-900 border-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-50 border-gray-300 text-gray-600 cursor-not-allowed'
                }`}
                placeholder="Engineering"
              />
            </div>
          </div>

          {/* Skills Section */}
          {employee && (
            <div className="col-span-2">
              <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                <Award className="w-4 h-4" />
                My Skills
              </label>
              <SkillsInput
                employeeId={employee.id}
                initialSkills={Array.isArray(employee.skills) ? employee.skills : []}
                onSkillsChange={async (updatedSkills) => {                  
                  // Update local employee state immediately
                  setEmployee(prev => ({
                    ...prev,
                    skills: updatedSkills
                  }));
                  
                  // Then fetch complete fresh profile
                  await fetchProfile();
                }}
                readOnly={false}
              />
              <p className={`text-xs mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Add or remove your skills to help with task assignments
              </p>
            </div>
          )}

          {/* Role (Read-only) */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Role (Cannot be changed)
            </label>
            <input
              type="text"
              value={userData?.role || user?.role || ''}
              disabled
              className={`w-full px-4 py-2 border rounded-lg cursor-not-allowed ${
                darkMode
                  ? 'bg-gray-900 border-gray-700 text-gray-400'
                  : 'bg-gray-100 border-gray-300 text-gray-600'
              }`}
            />
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Contact an administrator to change your role
            </p>
          </div>

          {/* Company (Read-only) */}
          <div>
            <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              <Building2 className="w-4 h-4" />
              Company
            </label>
            <input
              type="text"
              value={userData?.companyName || user?.companyName || 'No company assigned'}
              disabled
              className={`w-full px-4 py-2 border rounded-lg cursor-not-allowed ${
                darkMode
                  ? 'bg-gray-900 border-gray-700 text-gray-400'
                  : 'bg-gray-100 border-gray-300 text-gray-600'
              }`}
            />
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Contact an administrator to change company
            </p>
          </div>

          {/* Skill Overview Preview */}
          {employee?.skills && Array.isArray(employee.skills) && employee.skills.length > 0 && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${
                darkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                <Award className="w-5 h-5 text-purple-500" />
                My Skill Overview ({employee.skills.length} Skills)
              </h3>

              <div className="max-w-lg mx-auto">
                <SkillRadarChart
                  skills={employee.skills
                    .filter(s => {
                      if (!s) {
                        return false;
                      }
                      if (!s.skillName) {
                        return false;
                      }
                      if (s.proficiencyLevel === null || s.proficiencyLevel === undefined) {
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
                  title="Current Skill Levels"
                />
              </div>
              
            </div>
          )}

          {/* Productivity Chart Section  */}
          {employee && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                darkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                <TrendingUp className="w-5 h-5 text-purple-500" />
                My Productivity Trends
              </h3>
              <EmployeeProductivityChart 
                employeeId={employee.id} 
                darkMode={darkMode} 
              />
            </div>
          )}

          {/* Employee Status */}
          <div className={`p-4 rounded-lg ${
            darkMode ? 'bg-gray-700' : 'bg-gray-50'
          }`}>
            <h3 className={`font-semibold mb-2 ${
              darkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
              Employee Profile Status
            </h3>
            {employee ? (
              <div className={`flex items-center gap-2 ${
                darkMode ? 'text-green-400' : 'text-green-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  darkMode ? 'bg-green-400' : 'bg-green-600'
                }`}></div>
                <p className="text-sm">You have an active employee profile</p>
              </div>
            ) : (
              <div className={`flex items-center gap-2 ${
                darkMode ? 'text-orange-400' : 'text-orange-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  darkMode ? 'bg-orange-400' : 'bg-orange-600'
                }`}></div>
                <p className="text-sm">No employee profile. Contact an administrator.</p>
              </div>
            )}
          </div>

          <div className={`flex justify-end gap-4 pt-4 border-t ${
            darkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className={`px-6 py-2 border rounded-lg transition ${
                darkMode
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;