import React, { useState, useEffect, useCallback } from 'react';
import { User, Briefcase, Calendar, Award, X } from 'lucide-react';
import { employeesAPI } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketProvider';
import SkillRadarChart from './SkillRadarChart';
import EmployeeProductivityChart from './EmployeeProductivityChart';
import { parseUTCDate } from '../utils/dateUtils';

interface EmployeeProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({ userId, isOpen, onClose }) => {
  const { darkMode } = useTheme();
  const { user: currentUser } = useAuth();
  const { subscribe } = useWebSocket();
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);

  const fetchEmployee = useCallback(async () => {
    try {
      setLoading(true);
      const data = await employeesAPI.getByUserId(userId);
      
      try {
        const skills = await employeesAPI.getSkills(data.id);
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
  }, [userId]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchEmployee();
      
      const unsubscribe = subscribe('PRESENCE_UPDATED', (data: any) => {
        if (String(data.userId) === String(userId)) {
          setLiveStatus(data.status);
        }
      });
      return () => unsubscribe();
    }
  }, [isOpen, userId, fetchEmployee, subscribe]);

  const getStatusColor = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'ONLINE': return 'bg-green-500';
      case 'BUSY': return 'bg-red-500';
      case 'DO_NOT_DISTURB': return 'bg-red-500';
      case 'AWAY': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  if (!isOpen) return null;

  const currentStatus = liveStatus || employee?.status;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl flex flex-col ${
          darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
        }`}
      >
        <div className={`sticky top-0 z-10 flex justify-between items-center p-4 border-b ${
          darkMode ? 'border-gray-700 bg-gray-800/95' : 'border-gray-200 bg-white/95'
        }`}>
          <h2 className="text-xl font-bold">Employee Profile</h2>
          <button 
            onClick={onClose}
            className={`p-2 rounded-lg transition ${
              darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
          ) : !employee ? (
            <div className="text-center py-12">
              <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Employee not found</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative inline-block">
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
                  {currentStatus && (
                    <span className={`absolute bottom-1 right-1 w-5 h-5 border-4 ${darkMode ? 'border-gray-800' : 'border-white'} rounded-full ${getStatusColor(currentStatus)}`}></span>
                  )}
                </div>
                <div>
                  <h1 className="text-3xl font-bold">
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
                    <p className="font-medium">
                      {employee.department || 'Not assigned'}
                    </p>
                  </div>
                </div>

                {employee.hireDate && (
                  <div className="flex items-center gap-3">
                    <Calendar className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <div>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Hire Date</p>
                      <p className="font-medium">
                        {parseUTCDate(employee.hireDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Skills Section */}
              {employee.skills && Array.isArray(employee.skills) && (
                <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Award className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <h3 className="text-lg font-semibold">
                      Skills ({employee.skills.length})
                    </h3>
                  </div>
                    
                  {employee.skills.length > 0 ? (
                    <>
                      <div className="mb-6">
                        <SkillRadarChart 
                          skills={employee.skills
                            .filter((s: any) => {
                              if (!s || !s.skillName || s.proficiencyLevel === null || s.proficiencyLevel === undefined) return false;
                              const proficiency = Number(s.proficiencyLevel);
                              if (isNaN(proficiency) || proficiency < 0 || proficiency > 5) return false;
                              return true;
                            })
                            .map((s: any) => ({
                              name: s.skillName,
                              proficiencyLevel: Number(s.proficiencyLevel)
                            }))}
                          darkMode={darkMode}
                          title="Employee Skill Proficiency"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {employee.skills.map((skill: any) => (
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
                    <div className="text-center py-8">
                      <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                        This employee hasn't added any skills yet.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Productivity Chart Section */}
              {(currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER' || currentUser?.id === employee.userId) && (
                <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <EmployeeProductivityChart 
                    employeeId={employee.id} 
                    darkMode={darkMode} 
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfileModal;
