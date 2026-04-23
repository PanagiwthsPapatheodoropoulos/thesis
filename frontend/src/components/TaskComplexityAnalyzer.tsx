/**
 * @fileoverview TaskComplexityAnalyzer - On-demand AI task complexity assessment.
 *
 * Renders a trigger button that, when clicked, sends the task title and
 * description to the AI service and displays the resulting complexity score,
 * risk level, effort estimate, AI reasoning, and any identified blocking factors.
 * Requires a task title of at least 3 characters before the analysis can begin.
 */
import React, { useState, useEffect } from 'react';
import { Brain, Loader, TrendingUp, AlertCircle } from 'lucide-react';
import { aiAPI } from '../utils/api';
import type { TaskComplexityAnalyzerProps } from '../types';

/**
 * Component that analyses task complexity using the AI service.
 *
 * @component
 * @param {Object}   props                       - Component props.
 * @param {string}   props.title                 - The task title to analyse (minimum 3 characters).
 * @param {string}   [props.description]         - Optional task description for richer analysis.
 * @param {Function} [props.onComplexityDetected] - Callback invoked with the complexity score (0.0–1.0) after analysis.
 * @param {boolean}  [props.darkMode=false]       - Whether to render in dark mode.
 * @returns {JSX.Element} An analysis trigger button or the results panel.
 */
const TaskComplexityAnalyzer: React.FC<TaskComplexityAnalyzerProps> = ({ title, description, onComplexityDetected, darkMode = false }) => {
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);


  /**
   * Calls the AI complexity analysis endpoint and stores the results.
   * Validates the title length and clears any previous errors before the request.
   */
  const analyzeComplexity = async () => {

    if (!title || title.length < 3) {
      setError('Please enter a task title first');
      return;
    }
    setAnalyzing(true);
    setError(null);
    setHasAnalyzed(true);

    try {
      const response = await aiAPI.analyzeTaskComplexity({
        title,
        description: description || ''
      });

      // Validate response before using
      if (!response || typeof response.complexity_score === 'undefined') {
        throw new Error('Invalid response from AI service');
      }

      setAnalysis(response);
      
      if (onComplexityDetected) {
        onComplexityDetected(response.complexity_score);
      }
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
      setAnalysis(null); //Clear invalid analysis
    } finally {
      setAnalyzing(false);
    }
  };

  if (!title || title.length < 3) {
    return (
      <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        💡 Enter a task title to enable AI complexity analysis
      </div>
    );
  }

  if (!hasAnalyzed && !analyzing) {
    return (
      <button
        type="button"
        onClick={analyzeComplexity}
        className={`w-full py-2 px-4 rounded-lg border-2 border-dashed transition ${
          darkMode
            ? 'border-purple-700 bg-purple-900/20 text-purple-300 hover:bg-purple-900/40'
            : 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
        }`}
      >
        <Brain className="w-5 h-5 inline mr-2" />
        Analyze Task Complexity with AI
      </button>
    );
  }

  return (
    <div className={`p-4 rounded-lg border-2 transition-all ${
      darkMode 
        ? 'bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-700' 
        : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <h4 className={`font-bold ${darkMode ? 'text-purple-300' : 'text-purple-900'}`}>
          AI Complexity Analysis
        </h4>
        {analyzing && <Loader className={`w-4 h-4 animate-spin ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />}
      </div>

      {/* Error State */}
      {error && (
        <div className={`flex items-start gap-2 rounded-lg p-3 border ${
          darkMode
            ? 'bg-red-900/20 border-red-700 text-red-300'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Analysis Failed</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !analyzing && !error && (
        <div className="space-y-3">
          {/* Complexity Score */}
          <div className={`rounded-lg p-3 border ${
            darkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Complexity Score
              </span>
              <div className="flex items-center gap-2">
                <TrendingUp className={`w-4 h-4 ${
                  analysis.complexity_score > 0.7 ? 'text-red-500' :
                  analysis.complexity_score > 0.5 ? 'text-orange-500' :
                  'text-green-500'
                }`} />
                <span className={`font-bold text-lg ${
                  analysis.complexity_score > 0.7 ? 'text-red-500' :
                  analysis.complexity_score > 0.5 ? 'text-orange-500' :
                  'text-green-500'
                }`}>
                  {(analysis.complexity_score ?? 0).toFixed(0) || '0'}%
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className={`w-full rounded-full h-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  analysis.complexity_score > 0.7 ? 'bg-red-500' :
                  analysis.complexity_score > 0.5 ? 'bg-orange-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${(analysis.complexity_score ?? 0) * 100}%` }}
              />
            </div>
          </div>

          {/* Metadata */}
          <div className={`grid grid-cols-2 gap-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <div className={`p-2 rounded ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Category</span>
              <p className="font-semibold">{analysis.category || 'Unknown'}</p>
            </div>
            <div className={`p-2 rounded ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Risk Level</span>
              <p className={`font-semibold ${
                analysis.risk_level === 'HIGH' ? 'text-red-500' :
                analysis.risk_level === 'MEDIUM' ? 'text-orange-500' :
                'text-green-500'
              }`}>
                {analysis.risk_level || 'UNKNOWN'}
              </p>
            </div>
          </div>

          {/* Effort Estimate */}
          <div className={`rounded-lg p-3 border ${
            darkMode 
              ? 'bg-blue-900/20 border-blue-700' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                Estimated Effort
              </span>
              <span className={`font-bold ${darkMode ? 'text-blue-200' : 'text-blue-800'}`}>
                {(analysis.effort_hours_estimate ?? 0).toFixed(1) || '0.0'}h
              </span>
            </div>
            <p className={`text-xs mt-1 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
              ({((analysis.effort_hours_estimate ?? 0) / 8).toFixed(1) || '0.0'} days)
            </p>
          </div>

          {/* Reasoning */}
          <div className={`text-xs italic p-3 rounded border ${
            darkMode
              ? 'bg-gray-800 border-gray-700 text-gray-400'
              : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}>
            <p className="font-semibold mb-1">AI Reasoning:</p>
            <p>{analysis.reasoning || 'No reasoning provided'}</p>
          </div>

          {/* Blocking Factors */}
          {analysis.blocking_factors && analysis.blocking_factors.length > 0 && (
            <div className={`text-xs p-3 rounded border ${
              darkMode
                ? 'bg-yellow-900/20 border-yellow-700 text-yellow-300'
                : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}>
              <p className="font-semibold mb-1">⚠️ Risk Factors:</p>
              <ul className="list-disc list-inside space-y-1">
                {analysis.blocking_factors.map((factor, idx) => (
                  <li key={idx}>{factor}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Required Expertise */}
          {analysis.required_expertise && analysis.required_expertise.length > 0 && (
            <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <span className="font-semibold">Required Skills: </span>
              {analysis.required_expertise.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {analyzing && !analysis && (
        <div className="flex flex-col items-center justify-center py-6">
          <Loader className={`w-8 h-8 animate-spin mb-2 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
          <span className={`text-sm ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
            Analyzing task complexity...
          </span>
        </div>
      )}
    </div>
  );
};

export default TaskComplexityAnalyzer;