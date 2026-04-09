/**
 * @fileoverview TaskSkillsExtractor - AI-driven required-skills detector for task descriptions.
 *
 * Provides a collapsible panel where users can paste or edit task description
 * text and trigger an AI analysis that identifies the technical skills mentioned.
 * Extracted skills are displayed with confidence scores and can be selectively
 * added to the parent form via the {@code onSkillsExtracted} callback.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader, Check, X, Brain, AlertCircle } from 'lucide-react';
import { aiAPI } from '../utils/api';

/**
 * Component that uses AI to extract required skills from a task description.
 *
 * @component
 * @param {Object}   props                   - Component props.
 * @param {string}   [props.taskTitle]        - Task title pre-populated into the extraction text area.
 * @param {string}   [props.taskDescription]  - Task description pre-populated into the extraction text area.
 * @param {Function} [props.onSkillsExtracted] - Callback invoked with an array of skill names when the user confirms selection.
 * @param {boolean}  [props.darkMode=false]   - Whether to render in dark mode.
 * @returns {JSX.Element} A toggleable AI skills extraction panel.
 */
const TaskSkillsExtractor = ({ 
  taskTitle, 
  taskDescription, 
  onSkillsExtracted, 
  darkMode = false 
}) => {
  const [showExtractor, setShowExtractor] = useState(false);
  const [extractionText, setExtractionText] = useState('');
  const [extractedSkills, setExtractedSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState(new Set());
  const [error, setError] = useState(null);
  
  // Track if we've already initialized to prevent loops
  const hasInitialized = useRef(false);

  // Populate ONLY ONCE when panel opens
  /**
   * Opens the extractor panel and pre-fills the text area with the task's
   * title and description (combined). Skips pre-fill if the text area already
   * has content or if the component has already been initialized.
   */
  const handleOpenExtractor = () => {
    setShowExtractor(true);
    setError(null);
    setExtractedSkills([]);
    setSelectedSkills(new Set());
    
    // Only populate if empty AND we haven't initialized
    if (!extractionText && !hasInitialized.current) {
      const combined = `${taskTitle}${taskDescription ? '\n\n' + taskDescription : ''}`;
      setExtractionText(combined);
      hasInitialized.current = true;
    }
  };

  // Reset initialization flag when modal closes
  useEffect(() => {
    if (!showExtractor) {
      hasInitialized.current = false;
    }
  }, [showExtractor]);

  /**
   * Sends the text area content to the AI skills extraction endpoint.
   * Updates the extracted skills list and clears any previous errors.
   */
  const handleExtractSkills = async () => {
    if (!extractionText.trim()) {
      setError('Please enter text to analyze');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {      
      const response = await aiAPI.extractSkillsFromText({
        task_title: extractionText.substring(0, 100),
        task_description: extractionText,
        min_confidence: 0.4
      });

      const skills = response.extracted_skills || [];
      
      
      if (skills.length === 0) {
        setError('No skills detected. Click "Extract Skills" again or add more technical terms.');
        setExtractedSkills([]);
        setSelectedSkills(new Set());
        return;
      }
      
      setExtractedSkills(skills);
      setSelectedSkills(new Set());
      setError(null);
      
    } catch (error) {
      setError('Failed to extract skills: ' + error.message);
      setExtractedSkills([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Passes the selected skills' names to the parent via {@code onSkillsExtracted},
   * then resets and hides the panel.
   */
  const handleAddSelected = () => {
    if (selectedSkills.size === 0) {
      setError('Please select at least one skill');
      return;
    }

    const skillsToAdd = extractedSkills
      .filter((_, idx) => selectedSkills.has(idx))
      .map(skill => skill.name);

    onSkillsExtracted?.(skillsToAdd);
    
    // Reset and close
    setShowExtractor(false);
    setExtractionText('');
    setExtractedSkills([]);
    setSelectedSkills(new Set());
    setError(null);
    hasInitialized.current = false;
  };

  /**
   * Toggles the selection state of a skill in the extraction results.
   * @param {number} index - The index of the skill within {@code extractedSkills}.
   */
  const toggleSkillSelection = (index) => {
    const updated = new Set(selectedSkills);
    if (updated.has(index)) {
      updated.delete(index);
    } else {
      updated.add(index);
    }
    setSelectedSkills(updated);
  };

  return (
    <div className="space-y-3">
      {/* Trigger Button */}
      {!showExtractor && (
        <button
          type="button"
          onClick={handleOpenExtractor}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition border-2 border-dashed ${
            darkMode
              ? 'border-purple-700 bg-purple-900/20 text-purple-300 hover:bg-purple-900/40'
              : 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="font-medium">Extract Required Skills from Description</span>
        </button>
      )}

      {/* Extractor Panel */}
      {showExtractor && (
        <div className={`border-2 rounded-lg p-4 space-y-3 ${
          darkMode
            ? 'bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-700'
            : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <h4 className={`font-bold ${darkMode ? 'text-purple-300' : 'text-purple-900'}`}>
                AI Skills Extractor
              </h4>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowExtractor(false);
                setExtractionText('');
                setExtractedSkills([]);
                setError(null);
                hasInitialized.current = false;
              }}
              className={`p-1 rounded ${
                darkMode ? 'hover:bg-purple-800/50' : 'hover:bg-purple-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Info Box */}
          <div className={`text-xs p-2 rounded border ${
            darkMode
              ? 'bg-blue-900/30 border-blue-700 text-blue-300'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            💡 <strong>Tip:</strong> Include technical terms like "Java", "Spring Boot", "React", "Docker", etc. for better detection.
          </div>

          {/* Editable Text Input */}
          <textarea
            value={extractionText}
            onChange={(e) => {
              setExtractionText(e.target.value);
              setError(null);
            }}
            placeholder="Paste task description or job requirements here..."
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none ${
              darkMode
                ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400'
                : 'bg-white border-purple-300 text-gray-900 placeholder-gray-500'
            }`}
            rows={5}
            disabled={loading}
          />

          {/* Extract Button */}
          <button
            type="button"
            onClick={handleExtractSkills}
            disabled={loading || !extractionText.trim()}
            className={`w-full py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              darkMode
                ? 'bg-gradient-to-r from-purple-700 to-pink-700 hover:from-purple-600 hover:to-pink-600 text-white'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
            }`}
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Analyzing with AI...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Extract Skills
              </>
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className={`p-3 rounded-lg border flex items-start gap-2 ${
              darkMode
                ? 'bg-yellow-900/20 border-yellow-700 text-yellow-300'
                : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}>
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold mb-1">{error.includes('Failed') ? 'Extraction Failed' : 'No Skills Detected'}</p>
                <p className="text-xs">{error}</p>
              </div>
            </div>
          )}

          {/* Extracted Skills */}
          {extractedSkills.length > 0 && !loading && !error && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className={`text-sm font-semibold ${
                  darkMode ? 'text-purple-300' : 'text-purple-900'
                }`}>
                  ✨ Found {extractedSkills.length} skill{extractedSkills.length !== 1 ? 's' : ''}
                </p>
                <span className={`text-xs ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {selectedSkills.size} selected
                </span>
              </div>

              {/* Skills List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {extractedSkills.map((skill, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition ${
                      selectedSkills.has(idx)
                        ? darkMode
                          ? 'bg-purple-800/50 border-purple-600'
                          : 'bg-purple-100 border-purple-400'
                        : darkMode
                          ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSkills.has(idx)}
                      onChange={() => toggleSkillSelection(idx)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold ${
                          darkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          {skill.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className={`w-16 rounded-full h-1.5 ${
                            darkMode ? 'bg-gray-700' : 'bg-gray-200'
                          }`}>
                            <div
                              className={`h-1.5 rounded-full ${
                                skill.confidence > 0.8 ? 'bg-green-500' :
                                skill.confidence > 0.6 ? 'bg-yellow-500' :
                                'bg-orange-500'
                              }`}
                              style={{ width: `${skill.confidence * 100}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold ${
                            skill.confidence > 0.8 ? 'text-green-600' :
                            skill.confidence > 0.6 ? 'text-yellow-600' :
                            'text-orange-600'
                          }`}>
                            {(skill.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className={`text-xs mt-1 ${
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Category: {skill.category} • Level: {skill.suggested_proficiency}/5
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={selectedSkills.size === 0}
                  className={`flex-1 py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    darkMode
                      ? 'bg-green-700 hover:bg-green-600 text-white'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  Add Selected ({selectedSkills.size})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExtractor(false);
                    setExtractionText('');
                    setExtractedSkills([]);
                    setSelectedSkills(new Set());
                    setError(null);
                    hasInitialized.current = false;
                  }}
                  className={`px-4 py-2 rounded-lg transition font-semibold ${
                    darkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskSkillsExtractor;