/**
 * @fileoverview AIAssignmentModal - AI-Powered Employee Suggestion Dialog.
 *
 * Renders a modal dialog that calls the AI assignment API when opened and
 * displays a ranked list of candidate employees for a selected task.
 * Each candidate card shows fit score, confidence score, current workload,
 * available capacity, and the AI-generated reasoning. Managers can directly
 * assign an employee by clicking the Assign button on any suggestion card.
 */
import React, { useState, useEffect } from 'react';
import { X, Brain, TrendingUp, Award, AlertCircle, Loader } from 'lucide-react';
import { aiAPI, assignmentsAPI } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';
import type { AIAssignmentModalProps, Task, Employee, AISuggestion } from '../types';

/**
 * Modal that fetches and displays AI-generated employee assignment suggestions.
 *
 * @component
 * @param {Object}   props          - Component props.
 * @param {Object}   props.task     - The task object for which to find candidates.
 * @param {boolean}  props.isOpen   - Controls whether the modal is visible.
 * @param {Function} props.onClose  - Callback invoked when the modal is dismissed.
 * @param {Function} props.onAssign - Callback invoked after a successful assignment.
 * @returns {JSX.Element|null} The modal dialog, or null when closed.
 */
const AIAssignmentModal: React.FC<AIAssignmentModalProps> = ({ task, isOpen, onClose, onAssign }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [error, setError] = useState<any>(null);
  const { darkMode } = useTheme();

  /**
   * Calls the AI assignment API with the task's details and stores the ranked suggestions.
   * Sets a user-facing error if the API returns no candidates.
   */
  const fetchAISuggestions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await aiAPI.getAssignmentSuggestions({
        taskId: task.id,
        taskTitle: task.title,
        description: task.description,
        priority: task.priority,
        estimatedHours: task.estimatedHours,
        requiredSkillIds: task.requiredSkillIds || [],
        complexityScore: task.complexityScore || 0.5,
        topN: 5
      });

      setSuggestions(data.suggestions || []);
      
      if (data.suggestions.length === 0) {
        setError('No suitable employees found for this task');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (isOpen && task) {
      fetchAISuggestions();
    }
  }, [isOpen, task]);

  /**
   * Submits the assignment decision to the backend with the AI fit and confidence scores.
   * Closes the modal and notifies the parent via onAssign on success.
   *
   * @param {string} employeeId     - The ID of the selected employee.
   * @param {number} fitScore       - The AI-computed fit score (0.0 to 1.0).
   * @param {number} confidenceScore - The AI confidence in the suggestion (0.0 to 1.0).
   */
  const handleAssign = async (employeeId, fitScore, confidenceScore) => {
    try {
      await assignmentsAPI.create({
        taskId: task.id,
        employeeId: employeeId,
        assignedBy: 'AI',
        fitScore: fitScore,
        confidenceScore: confidenceScore
      });

      onAssign?.();
      onClose();
    } catch (err: any) {
      alert('Failed to assign task: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto ${
        darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 px-6 py-4 flex items-center justify-between border-b ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>AI Assignment Suggestions</h2>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Powered by machine learning & skill matching
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Task Info */}
        <div className={`px-6 py-4 border-b ${
          darkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-100'
        }`}>
          <h3 className={`font-semibold mb-1 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Task: {task?.title}</h3>
          <div className={`flex gap-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <span>Priority: <strong className={darkMode ? 'text-gray-200' : 'text-gray-900'}>{task?.priority}</strong></span>
            {task?.estimatedHours && (
              <span>Estimated: <strong className={darkMode ? 'text-gray-200' : 'text-gray-900'}>{task.estimatedHours}h</strong></span>
            )}
            {task?.complexityScore && (
              <span>Complexity: <strong className={darkMode ? 'text-gray-200' : 'text-gray-900'}>{(task.complexityScore * 100).toFixed(0)}%</strong></span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-12 h-12 text-purple-600 animate-spin mb-4" />
              <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Analyzing employees and calculating fit scores...</p>
            </div>
          )}

          {error && (
            <div className={`border-2 rounded-lg p-4 flex items-start gap-3 ${
              darkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'
            }`}>
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className={`font-semibold ${darkMode ? 'text-red-300' : 'text-red-900'}`}>Error</p>
                <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-700'}`}>{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && suggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Award className={`w-5 h-5 ${darkMode ? 'text-yellow-500' : 'text-yellow-600'}`} />
                <h3 className={`font-semibold ${
                  darkMode ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  Top {suggestions.length} Candidates (Ranked by AI)
                </h3>
              </div>

              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion.employeeId}
                  className={`p-5 rounded-lg border-2 transition hover:shadow-lg ${
                    index === 0
                      ? darkMode ? 'border-yellow-600 bg-yellow-900/30' : 'border-yellow-300 bg-yellow-50'
                      : darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {index === 0 && <span className="text-2xl">🥇</span>}
                      {index === 1 && <span className="text-2xl">🥈</span>}
                      {index === 2 && <span className="text-2xl">🥉</span>}
                      <div>
                        <h4 className={`font-bold text-lg ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {suggestion.employeeName}
                        </h4>
                        {suggestion.position && (
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{suggestion.position}</p>
                        )}
                        {/* Workload Status */}
                        {suggestion.workloadPercentage !== null && (
                          <div className={`mt-3 flex items-center gap-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            <span>Current workload:</span>
                            <span className={`font-semibold ${
                              suggestion.workloadPercentage < 50 ? 'text-green-600' :
                              suggestion.workloadPercentage < 85 ? 'text-yellow-600' :
                              suggestion.workloadPercentage <= 100 ? 'text-orange-600' :
                              'text-red-600'
                            }`}>
                              {suggestion.workloadPercentage.toFixed(0)}% busy
                            </span>
                            <span className="text-gray-500">
                              ({(100 - Math.min(100, suggestion.workloadPercentage)).toFixed(0)}% available)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleAssign(
                        suggestion.employeeId,
                        suggestion.fitScore,
                        suggestion.confidenceScore
                      )}
                      className={`px-6 py-2 rounded-lg font-semibold transition ${
                        index === 0
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
                          : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Assign
                    </button>
                  </div>

                  {/* Scores */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className={`p-3 rounded-lg border ${
                      darkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Fit Score</span>
                        <TrendingUp className={`w-4 h-4 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`flex-1 rounded-full h-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                          <div
                            className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full"
                            style={{ width: `${suggestion.fitScore * 100}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {(suggestion.fitScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className={`p-3 rounded-lg border ${
                      darkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Confidence</span>
                        <Award className={`w-4 h-4 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`flex-1 rounded-full h-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                          <div
                            className="bg-gradient-to-r from-green-600 to-emerald-600 h-2 rounded-full"
                            style={{ width: `${suggestion.confidenceScore * 100}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {(suggestion.confidenceScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className={`rounded-lg p-3 border ${
                    darkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'
                  }`}>
                    <p className={`text-sm ${darkMode ? 'text-blue-200' : 'text-blue-900'}`}>
                      <strong>Why this match:</strong> {suggestion.reasoning}
                    </p>
                  </div>

                  {/* Availability */}
                  {suggestion.availableHours !== null && (
                    <div className={`mt-3 flex items-center gap-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      <span>Available capacity:</span>
                      <span className={`font-semibold ${
                        suggestion.availableHours > 20 ? 'text-green-600' :
                        suggestion.availableHours > 10 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {suggestion.availableHours}h/week remaining
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 border-t px-6 py-4 flex justify-end ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}>
          <button
            onClick={onClose}
            className={`px-6 py-2 rounded-lg transition font-semibold ${
              darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssignmentModal;