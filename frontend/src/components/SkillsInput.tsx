/**
 * @fileoverview SkillsInput - Interactive skill management component.
 * 
 * Allows users to add, remove, and view skills for an employee. Supports
 * skill category selection and proficiency level (1-5) rating. Handles both
 * persistent backend skill updates and temporary state for forms.
 */
import React, { useState, useEffect } from 'react';
import { X, Plus, Award, Loader } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { SkillsInputProps, Skill } from '../types';

/**
 * Component for managing an employee's skills list and proficiency levels.
 *
 * @component
 * @param {Object}   props               - Component props.
 * @param {string}   [props.employeeId]  - If provided, skills are persisted to the backend.
 * @param {Object[]} [props.initialSkills=[]] - Initial list of skills to display.
 * @param {Function} [props.onSkillsChange] - Callback invoked whenever the skill list changes.
 * @param {boolean}  [props.readOnly=false] - Whether to disable editing capabilities.
 * @returns {JSX.Element} The skill management UI.
 */
const SkillsInput: React.FC<SkillsInputProps> = ({ employeeId, initialSkills = [], onSkillsChange, readOnly = false }) => {
  const { darkMode } = useTheme();
  // Internal state for the current skills list
  const [skills, setSkills] = useState<any[]>([]);
  // Input field for new skill name
  const [inputValue, setInputValue] = useState<string>('');
  // Selected proficiency level (1-5)
  const [proficiency, setProficiency] = useState(3);
  // Selected skill category
  const [category, setCategory] = useState('Programming');
  // Controls visibility of the add-skill form
  const [showInput, setShowInput] = useState<boolean>(false);
  // Loading state for API requests
  const [loading, setLoading] = useState<boolean>(false);

  // Skill categories available for selection
  const categories = [
    'Programming',
    'Soft Skills',
    'Finance',
    'HR',
    'Marketing',
    'Design',
    'Management',
    'DevOps',
    'Data Science',
    'Other'
  ];

  // Sync internal state with initialSkills prop on change
  useEffect(() => {
    setSkills(initialSkills);
  }, [JSON.stringify(initialSkills)]);

  /**
   * Refetches the latest skill list for the current employee from the backend.
   * @returns {Promise<Object[]|null>} Array of skill objects or null on failure.
   */
  const fetchFreshSkills = async () => {
    if (!employeeId) return null;
    
    try {
      const response = await fetch(
        `http://localhost:8080/api/employees/${employeeId}/skills`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (response.ok) {
        const freshSkills = await response.json();
        return freshSkills;
      } else {
        return null;
      }
    } catch (error: any) {
      return null;
    }
  };

  /**
   * Validates and submits a new skill.
   * Creates the skill in the global registry if it doesn't exist,
   * links it to the employee with the chosen proficiency level.
   */
  const handleAddSkill = async () => {
    if (!inputValue.trim()) {
        alert('Please enter a skill name');
        return;
    }

    setLoading(true);
    const newSkill = {
        skillName: inputValue.trim(),
        skillCategory: category,
        proficiencyLevel: proficiency
    };

    try {
        if (employeeId) {
            // Step 1: Create or get the skill
            let skillData;
            try {                
                const skillResponse = await fetch('http://localhost:8080/api/skills', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newSkill.skillName,
                    category: newSkill.skillCategory
                })
                });

                if (skillResponse.ok) {
                    skillData = await skillResponse.json();
                } else if (skillResponse.status === 409 || skillResponse.status === 400) {
                    const existingSkillResponse = await fetch(
                        `http://localhost:8080/api/skills/name/${encodeURIComponent(newSkill.skillName)}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        }
                    );
                    
                    if (!existingSkillResponse.ok) {
                        throw new Error(`Failed to fetch existing skill: ${existingSkillResponse.status}`);
                    }
                    
                    skillData = await existingSkillResponse.json();
                } else {
                    const errorText = await skillResponse.text();
                    throw new Error(`Failed to create skill (${skillResponse.status}): ${errorText}`);
                }
            } catch (error: any) {
                throw new Error(`Skill operation failed: ${error.message}`);
            }

            // Check if skill already added
            const currentSkillIds = skills.map(s => s.skillId || s.id);
            if (currentSkillIds.includes(skillData.id)) {
                alert('This skill is already added!');
                setLoading(false);
                return;
            }

            // Step 2: Add skill to employee
            const addSkillResponse = await fetch(`http://localhost:8080/api/employees/${employeeId}/skills`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    skillId: skillData.id,
                    proficiencyLevel: newSkill.proficiencyLevel
                })
            });

            if (!addSkillResponse.ok) {
                const errorText = await addSkillResponse.text();
                if (addSkillResponse.status === 403) {
                    throw new Error('You do not have permission to add skills. Please contact an administrator.');
                }
                throw new Error(`Failed to add skill to employee (${addSkillResponse.status}): ${errorText}`);
            }

            const addedSkill = await addSkillResponse.json();
            
            // Wait for DB commit to ensure consistency
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Step 3: Fetch fresh skills to update UI state
            const freshSkills = await fetchFreshSkills();
            
            if (freshSkills) {
                setSkills(freshSkills);
                
                // Notify parent component of the change
                if (onSkillsChange) {
                    onSkillsChange(freshSkills);
                }
            } else {
                // Fallback: Optimistically update state if refetch fails
                const updatedSkills = [...skills, addedSkill];
                setSkills(updatedSkills);
                if (onSkillsChange) {
                    onSkillsChange(updatedSkills);
                }
            }

            // Broadcast global event for other components (e.g., Radar Chart)
            window.dispatchEvent(new CustomEvent('employeeSkillChanged', {
                detail: { employeeId, action: 'added', skill: addedSkill }
            }));
            
        } else {
            // Unsaved/Temporary skill (e.g., in a "Create Employee" modal)
            const skillWithId = { 
                ...newSkill, 
                id: `temp-${Date.now()}`,
                skillId: `temp-${Date.now()}` 
            };
            const updatedSkills = [...skills, skillWithId];
            setSkills(updatedSkills);
            if (onSkillsChange) onSkillsChange(updatedSkills);
        }

        // Reset the form fields
        setInputValue('');
        setProficiency(3);
        setCategory('Programming');
        setShowInput(false);
    } catch (error: any) {
        alert(`Error adding skill: ${error.message}`);
    } finally {
        setLoading(false);
    }
  };

  /**
   * Removes a skill from the employee.
   * If persistent, sends a DELETE request to the backend.
   * @param {Object} skillToRemove - The skill object to delete.
   */
  const handleRemoveSkill = async (skillToRemove) => {
    setLoading(true);
    try {
        if (employeeId && skillToRemove.id && !skillToRemove.id.toString().startsWith('temp-')) {            
            const deleteResponse = await fetch(
                `http://localhost:8080/api/employees/${employeeId}/skills/${skillToRemove.skillId || skillToRemove.id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }
            );

            if (!deleteResponse.ok) {
                throw new Error('Failed to remove skill from employee');
            }
                        
            // Wait for DB commit
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Fetch fresh state
            const freshSkills = await fetchFreshSkills();
            
            if (freshSkills) {
                setSkills(freshSkills);
                
                if (onSkillsChange) {
                    onSkillsChange(freshSkills);
                }
            } else {
                const updatedSkills = skills.filter(s => s.id !== skillToRemove.id);
                setSkills(updatedSkills);
                if (onSkillsChange) {
                    onSkillsChange(updatedSkills);
                }
            }
        } else {
            // Remove from local temporary state
            const updatedSkills = skills.filter(s => s.id !== skillToRemove.id);
            setSkills(updatedSkills);
            if (onSkillsChange) {
                onSkillsChange(updatedSkills);
            }
        }
        
        // Broadcast global event
        window.dispatchEvent(new CustomEvent('employeeSkillChanged', {
            detail: { employeeId, action: 'removed', skill: skillToRemove }
        }));
    } catch (error: any) {
        alert('Error removing skill: ' + error.message);
    } finally {
        setLoading(false);
    }
  };

  /**
   * Submits the form on Enter key press.
   * @param {React.KeyboardEvent} e - Keyboard event.
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  /**
   * Returns Tailwind CSS classes for the proficiency badge based on level and theme.
   * @param {number} level - Proficiency level (1-5).
   * @returns {string} CSS classes.
   */
  const getProficiencyColor = (level) => {
    if (darkMode) {
      const colors = {
        1: 'bg-red-900/30 text-red-300 border-red-700',
        2: 'bg-orange-900/30 text-orange-300 border-orange-700',
        3: 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
        4: 'bg-blue-900/30 text-blue-300 border-blue-700',
        5: 'bg-green-900/30 text-green-300 border-green-700'
      };
      return colors[level] || colors[3];
    } else {
      const colors = {
        1: 'bg-red-100 text-red-700 border-red-200',
        2: 'bg-orange-100 text-orange-700 border-orange-200',
        3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        4: 'bg-blue-100 text-blue-700 border-blue-200',
        5: 'bg-green-100 text-green-700 border-green-200'
      };
      return colors[level] || colors[3];
    }
  };

  return (
    <div className="space-y-3">
      {/* Display existing skills */}
      <div className="flex flex-wrap gap-2">
        {skills.length === 0 && !showInput && (
          <p className={`text-sm italic ${
            darkMode ? 'text-gray-500' : 'text-gray-500'
          }`}>
            No skills added yet
          </p>
        )}
        {skills.map((skill) => (
          <div
            key={skill.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border-2 ${getProficiencyColor(skill.proficiencyLevel)}`}
          >
            <Award className="w-3 h-3" />
            <span className="font-medium">{skill.skillName}</span>
            <span className="text-xs opacity-75">
              ({skill.skillCategory || 'Other'}) • Lvl {skill.proficiencyLevel}
            </span>
            {!readOnly && (
              <button
                onClick={() => handleRemoveSkill(skill)}
                disabled={loading}
                className="ml-1 hover:bg-black hover:bg-opacity-10 rounded-full p-0.5 transition disabled:opacity-50"
                type="button"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add skill button/form */}
      {!readOnly && (
        <div>
          {!showInput ? (
            <button
              onClick={() => setShowInput(true)}
              disabled={loading}
              type="button"
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition disabled:opacity-50 ${
                darkMode
                  ? 'text-indigo-400 hover:text-indigo-300 hover:bg-gray-700'
                  : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50'
              }`}
            >
              <Plus className="w-4 h-4" />
              Add Skill
            </button>
          ) : (
            <div className={`space-y-3 p-4 rounded-lg border ${
              darkMode
                ? 'bg-gray-700 border-gray-600'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Skill Name *
                  </label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g., Java, Leadership"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                      darkMode
                        ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                    autoFocus
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setCategory(e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                      darkMode
                        ? 'bg-gray-800 border-gray-600 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    disabled={loading}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Proficiency Level: {proficiency}
                </label>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${
                    darkMode ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    Beginner
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={proficiency}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setProficiency(parseInt(e.target.value))}
                    className={`flex-1 ${
                      darkMode ? 'accent-indigo-500' : ''
                    }`}
                    disabled={loading}
                  />
                  <span className={`text-xs ${
                    darkMode ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    Expert
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddSkill}
                  disabled={loading}
                  className={`flex-1 px-4 py-2 text-sm rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                    darkMode
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {loading && <Loader className="w-4 h-4 animate-spin" />}
                  {loading ? 'Adding...' : 'Add Skill'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInput(false);
                    setInputValue('');
                    setProficiency(3);
                    setCategory('Programming');
                  }}
                  disabled={loading}
                  className={`px-4 py-2 text-sm rounded-lg transition disabled:opacity-50 ${
                    darkMode
                      ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
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

      {loading && (
        <div className={`flex items-center gap-2 text-sm ${
          darkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>
          <Loader className="w-4 h-4 animate-spin" />
          <span>Processing...</span>
        </div>
      )}
    </div>
  );
};

export default SkillsInput;