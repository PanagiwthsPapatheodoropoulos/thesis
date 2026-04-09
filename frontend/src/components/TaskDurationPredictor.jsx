/**
 * @fileoverview TaskDurationPredictor - AI-powered task duration estimation widget.
 *
 * Sends task metadata (priority, complexity score, required skills) to the AI
 * prediction endpoint and renders the predicted hours, confidence interval,
 * model version, and an auto-generated scheduling tip.
 * Requires a task priority to be set before prediction is available.
 */
// frontend/src/components/TaskDurationPredictor.jsx
import React, { useState } from 'react';
import { Clock, TrendingUp, AlertCircle, Loader, Sparkles } from 'lucide-react';
import { aiAPI } from '../utils/api';

/**
 * Memoized component that predicts the duration of a task using AI.
 *
 * @component
 * @param {Object}   props                        - Component props.
 * @param {Object}   props.taskData               - Current task form data used for prediction.
 * @param {string}   props.taskData.priority      - Task priority (e.g. "LOW", "HIGH").
 * @param {number}   [props.taskData.complexityScore=0.5] - Normalized complexity score (0.0–1.0).
 * @param {string[]} [props.taskData.requiredSkillIds=[]] - IDs of skills required by the task.
 * @param {Function} [props.onPredictionReceived]  - Callback invoked with the predicted hours (number).
 * @param {boolean}  [props.darkMode=false]         - Whether to render in dark mode.
 * @returns {JSX.Element} The prediction widget.
 */
const TaskDurationPredictor = React.memo(({ taskData, onPredictionReceived, darkMode }) => {
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Sends task metadata to the AI prediction endpoint and stores the returned prediction.
   * Uses a temporary composite ID for the AI call so no real task ID is required.
   * Calls {@code onPredictionReceived} with the predicted hours on success.
   */
  const fetchPrediction = async () => {
    if (!taskData?.priority) {
      setError('Please select a priority first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate a temporary UUID for prediction ONLY
      const tempTaskId = `preview-${taskData.priority}-${taskData.complexityScore}-${taskData.requiredSkillIds.length}`;


      const data = await aiAPI.predictDuration({
        taskId: tempTaskId,
        priority: taskData.priority,
        complexityScore: taskData.complexityScore || 0.5,
        requiredSkillIds: taskData.requiredSkillIds || []
      });

      setPrediction(data);
      if (data?.predicted_hours && typeof data.predicted_hours === 'number') {
        onPredictionReceived?.(data.predicted_hours);
      }
    } catch (err) {
      setError(err.message || 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  if (!taskData?.priority) {
    return (
      <div className={`border-2 rounded-lg p-4 ${
        darkMode
          ? 'bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-700'
          : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className={`w-5 h-5 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
          <h3 className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>AI Duration Prediction</h3>
        </div>
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          ℹ️ Select a priority to enable AI duration prediction
        </p>
      </div>
    );
  }

  return (
    <div className={`border-2 rounded-lg p-4 ${
      darkMode
        ? 'bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-700'
        : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h3 className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>AI Duration Prediction</h3>
      </div>

      {!prediction && !loading && (
        <button
          type="button"
          onClick={fetchPrediction}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
        >
          <Sparkles className="w-4 h-4" />
          Get AI Prediction
        </button>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader className={`w-8 h-8 animate-spin ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
          <span className={`text-sm ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
            Analyzing task complexity with AI...
          </span>
        </div>
      )}

      {error && (
        <div className={`flex items-start gap-2 rounded-lg p-3 border ${
          darkMode
            ? 'text-red-400 bg-red-900/20 border-red-800'
            : 'text-red-700 bg-red-50 border-red-200'
        }`}>
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium block mb-1">Prediction Failed</span>
            <span className="text-xs">{error}</span>
          </div>
        </div>
      )}

      {prediction && !loading && (
        <div className="space-y-3">
          {/* Main Prediction */}
          <div className={`rounded-lg p-4 border-2 shadow-sm ${
            darkMode
              ? 'bg-gray-800 border-purple-600'
              : 'bg-white border-purple-300'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Predicted Duration</span>
              <Clock className={`w-5 h-5 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                {prediction.predicted_hours?.toFixed(1) || '0.0'}
              </span>
              <span className={`text-xl ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>hours</span>
            </div>
          </div>

          {/* Confidence Range */}
          <div className={`rounded-lg p-3 border ${
            darkMode
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Confidence Range</span>
              <TrendingUp className={`w-4 h-4 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {prediction.confidence_interval_lower?.toFixed(1) || '0'}h
              </span>
              <div className={`flex-1 rounded-full h-2 relative overflow-hidden ${
                darkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}>
                <div className="absolute bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full w-full" />
                <div
                  className={`absolute w-3 h-3 border-2 rounded-full shadow-md ${
                    darkMode
                      ? 'bg-gray-200 border-purple-400'
                      : 'bg-white border-purple-600'
                  }`}
                  style={{
                    left: `${Math.min(100, Math.max(0, 
                      ((prediction.predicted_hours - prediction.confidence_interval_lower) / 
                       (prediction.confidence_interval_upper - prediction.confidence_interval_lower)) * 100
                    ))}%`,
                    transform: 'translate(-50%, -25%)'
                  }}
                />
              </div>
              <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {prediction.confidence_interval_upper?.toFixed(1) || '0'}h
              </span>
            </div>
          </div>

          {/* Model Info */}
          <div className={`flex items-center justify-between text-xs px-1 ${
            darkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <span>Model: {prediction.model_version || 'Unknown'}</span>
            <span>
              Confidence: {((prediction.confidence_score || 0) * 100).toFixed(0)}%
            </span>
          </div>

          {/* Recommendation Tip */}
          <div className={`rounded-lg p-3 border ${
            darkMode
              ? 'bg-yellow-900/20 border-yellow-800'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <p className={`text-sm ${darkMode ? 'text-yellow-200' : 'text-yellow-900'}`}>
              <strong>💡 Tip:</strong>{' '}
              {prediction.predicted_hours > 8
                ? 'This task may take longer than expected. Consider breaking it into smaller subtasks.'
                : prediction.predicted_hours < 4
                ? 'This appears to be a quick task. Great for filling gaps in schedules.'
                : 'This task has average complexity. Plan accordingly.'}
            </p>
          </div>

          {/* Recalculate Button */}
          <button
            type="button"
            onClick={fetchPrediction}
            className={`w-full py-2 rounded-lg transition text-sm font-semibold border ${
              darkMode
                ? 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50 border-purple-800'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200'
            }`}
          >
            🔄 Recalculate Prediction
          </button>
        </div>
      )}
    </div>
  );
});

TaskDurationPredictor.displayName = 'TaskDurationPredictor';

export default TaskDurationPredictor;