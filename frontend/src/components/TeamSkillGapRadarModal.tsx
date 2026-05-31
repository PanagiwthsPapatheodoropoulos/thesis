import React, { useState, useEffect } from 'react';
import { X, Radar, Sparkles, AlertTriangle, CheckCircle, BookOpen } from 'lucide-react';
import { aiAPI, employeesAPI } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';
import { Radar as RechartsRadar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { Task } from '../types';

interface TeamSkillGapRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[]; // Usually the selected tasks representing upcoming work
}

/**
 * TeamSkillGapRadarModal Component
 * 
 * Analyzes upcoming tasks against existing team skills to identify skill gaps.
 * Provides a heatmap/radar chart of missing skills and suggests a training plan.
 */
interface SkillGapSuggestion {
  skill_name: string;
  frequency: number;
  priority_score: number;
  category: string;
}

const TeamSkillGapRadarModal: React.FC<TeamSkillGapRadarModalProps> = ({ isOpen, onClose, tasks }) => {
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SkillGapSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tasks.length > 0) {
      analyzeSkillGaps();
    } else if (!isOpen) {
      setSuggestions([]);
      setError(null);
    }
  }, [isOpen, tasks]);

  const analyzeSkillGaps = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all employees to aggregate existing skills
      const employees = await employeesAPI.getAll();
      const existingSkillsSet = new Set<string>();
      employees.forEach(emp => {
        emp.skills?.forEach(s => {
          const name = s.skillName || s.name;
          if (name) {
            existingSkillsSet.add(name);
          }
        });
      });
      const existingSkills = Array.from(existingSkillsSet);

      // Prepare tasks payload
      const teamTasks = tasks.map(t => ({
        title: t.title,
        description: t.description || ''
      }));

      // Call AI endpoint
      const response = await aiAPI.suggestTeamSkills({
        team_tasks: teamTasks,
        existing_skills: existingSkills
      });

      setSuggestions(response.suggestions || []);
    } catch (err: unknown) {
      console.error('Failed to analyze skill gaps:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || 'Failed to analyze skill gaps.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Prepare radar chart data
  const radarData = suggestions.slice(0, 8).map(s => ({
    subject: s.skill_name,
    priority: Number(s.priority_score ?? 0) * 100,
    frequency: Number(s.frequency ?? 0),
    fullMark: 100
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl flex flex-col ${
        darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
      }`}>
        <div className={`p-6 border-b sticky top-0 z-10 flex justify-between items-center ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
              <Radar className={`w-6 h-6 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Team Skill Gap Radar</h2>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Analyzing {tasks.length} selected task(s) against current team capabilities
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${darkMode ? 'border-purple-400' : 'border-purple-600'}`} />
              <div className="flex items-center gap-2 text-lg font-medium animate-pulse">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <span className={darkMode ? 'text-purple-300' : 'text-purple-700'}>
                  AI is analyzing task requirements and matching with team skills...
                </span>
              </div>
            </div>
          ) : error ? (
            <div className={`p-6 rounded-lg flex flex-col items-center justify-center gap-3 text-center ${
              darkMode ? 'bg-red-900/20 text-red-200' : 'bg-red-50 text-red-800'
            }`}>
              <AlertTriangle className="w-10 h-10 text-red-500 mb-2" />
              <p className="text-lg font-medium">Analysis Failed</p>
              <p>{error}</p>
              <button 
                onClick={analyzeSkillGaps}
                className={`mt-4 px-4 py-2 rounded transition ${darkMode ? 'bg-red-800 hover:bg-red-700' : 'bg-red-200 hover:bg-red-300'}`}
              >
                Try Again
              </button>
            </div>
          ) : suggestions.length === 0 ? (
            <div className={`p-12 text-center rounded-xl border-2 border-dashed ${
              darkMode ? 'border-green-800 bg-green-900/10' : 'border-green-200 bg-green-50'
            }`}>
              <CheckCircle className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-green-500' : 'text-green-600'}`} />
              <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-green-400' : 'text-green-700'}`}>No Skill Gaps Detected!</h3>
              <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                Your team already possesses all the skills required for the selected tasks.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Radar Chart */}
              <div className={`p-6 rounded-xl border ${darkMode ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-gray-50'}`}>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Radar className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  Skill Gap Heatmap
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke={darkMode ? '#374151' : '#e5e7eb'} />
                      <PolarAngleAxis 
                        dataKey="subject" 
                        tick={{ fill: darkMode ? '#9ca3af' : '#4b5563', fontSize: 12 }} 
                      />
                      <PolarRadiusAxis 
                        angle={30} 
                        domain={[0, 100]} 
                        tick={{ fill: darkMode ? '#6b7280' : '#9ca3af' }} 
                      />
                      <RechartsRadar
                        name="Priority"
                        dataKey="priority"
                        stroke={darkMode ? '#8b5cf6' : '#6d28d9'}
                        fill={darkMode ? '#8b5cf6' : '#6d28d9'}
                        fillOpacity={0.5}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                          borderColor: darkMode ? '#374151' : '#e5e7eb',
                          color: darkMode ? '#f3f4f6' : '#111827'
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Training Plan List */}
              <div className={`p-6 rounded-xl border flex flex-col ${darkMode ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-gray-50'}`}>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <BookOpen className={`w-5 h-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                  Suggested Training Plan
                </h3>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[300px]">
                  {suggestions.map((skill, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border-l-4 flex items-center justify-between ${
                      idx < 3 
                        ? darkMode ? 'border-red-500 bg-gray-800' : 'border-red-500 bg-white shadow-sm'
                        : darkMode ? 'border-yellow-500 bg-gray-800' : 'border-yellow-500 bg-white shadow-sm'
                    }`}>
                      <div>
                        <h4 className="font-bold flex items-center gap-2">
                          {skill.skill_name}
                          {idx < 3 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200">Critical</span>}
                        </h4>
                        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Required in {skill.frequency} task(s) • Priority: {(skill.priority_score * 10).toFixed(1)}/10
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {skill.category}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className={`p-6 border-t mt-auto flex justify-end ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50 rounded-b-xl'}`}>
          <button
            onClick={onClose}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamSkillGapRadarModal;
