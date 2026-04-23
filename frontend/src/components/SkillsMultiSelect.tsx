/**
 * @fileoverview SkillsMultiSelect - Searchable multi-select widget for managing required skills.
 *
 * Fetches the global skill list once on mount, then lets users search existing
 * skills or create new ones on the fly. Selected skill IDs are reported to the
 * parent via the {@code onChange} callback. Supports both UUID-based and
 * name-based skill identifiers (e.g. from AI extraction results).
 */
import React, { useState, useEffect, useRef } from 'react';
import { skillsAPI } from '../utils/api';
import { X, Loader, Plus } from 'lucide-react';
import type { SkillsMultiSelectProps, Skill } from '../types';

/**
 * Multi-select component for choosing required skills from a searchable list.
 *
 * @component
 * @param {Object}   props                  - Component props.
 * @param {string[]} [props.selectedSkills=[]] - Array of currently selected skill IDs.
 * @param {Function} props.onChange          - Callback invoked with the updated array of skill IDs.
 * @param {boolean}  [props.darkMode=false]  - Whether to render in dark mode.
 * @param {Object[]} [props.availableSkills=[]] - Optional pre-loaded skill list (skips initial fetch if non-empty).
 * @returns {JSX.Element} The rendered skill selector.
 */
const SkillsMultiSelect: React.FC<SkillsMultiSelectProps> = ({ selectedSkills = [], onChange, darkMode, availableSkills = [] }) => {
  const [allSkills, setAllSkills] = useState(availableSkills);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [deletedCustomSkills, setDeletedCustomSkills] = useState<any[]>([]);
  
  // Prevent infinite fetching with ref
  const hasFetchedSkills = useRef(false);

  // Only fetch ONCE when component mounts
  useEffect(() => {
    if (availableSkills.length > 0) {
      setAllSkills(availableSkills);
      hasFetchedSkills.current = true;
    } else if (!hasFetchedSkills.current) {
      fetchSkills();
    }
  }, []); // only run on mount

  /**
   * Fetches the complete list of skills from the backend exactly once per mount.
   * Guarded by a ref flag to prevent duplicate requests on StrictMode double-invocations.
   */
  const fetchSkills = async () => {
    if (hasFetchedSkills.current) return; //  Prevent duplicate fetches
    
    setLoading(true);
    hasFetchedSkills.current = true; // Mark as fetched BEFORE the request
    
    try {
      const skills = await skillsAPI.getAll();
      setAllSkills(skills || []);
    } catch (error: any) {
      setAllSkills([]);
      hasFetchedSkills.current = false; //Allow retry on error
    } finally {
      setLoading(false);
    }
  };

  const filteredSkills = allSkills.filter(skill =>
    skill.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedSkills.includes(skill.id) &&
    !deletedCustomSkills.includes(skill.id)
  );

  const exactMatch = allSkills.find(
    s => s.name.toLowerCase() === searchTerm.toLowerCase()
  );

  /**
   * Adds an existing skill (by ID) to the selected list.
   * @param {string} skillId - The UUID of the skill to add.
   */
  const handleAdd = async (skillId) => {
    // Ensure we're using the actual skill ID, not the name
    const validatedSkillId = getSkillId(skillId);
    
    if (!selectedSkills.includes(validatedSkillId)) {
      onChange([...selectedSkills, validatedSkillId]);
    }
    
    setSearchTerm('');
    setShowDropdown(false);
  };

  /**
   * Creates a new skill with the current search term as its name, then selects it.
   * If the skill already exists (409 conflict), falls back to fetching and selecting the existing one.
   */
  const handleCreateAndAdd = async () => {
    if (!searchTerm.trim() || creating) return;

    const cleanSkillName = searchTerm.trim();
    if (cleanSkillName.length < 2) {
      alert('Skill name must be at least 2 characters');
      return;
    }

    setCreating(true);
    try {      
      const newSkill = await skillsAPI.create({
        name: cleanSkillName,
        category: 'Custom',
        description: `Custom skill: ${cleanSkillName}`
      });


      // Add to local list with proper ID tracking
      setAllSkills(prev => [...prev, newSkill]);
      
      // Add to selected using the skill ID
      const validatedSkillId = getSkillId(newSkill.id);
      if (!selectedSkills.includes(validatedSkillId)) {
        onChange([...selectedSkills, validatedSkillId]);
      }
      
      setSearchTerm('');
      setShowDropdown(false);
    } catch (error: any) {
      if (error.message.includes('409') || error.message.includes('already exists')) {
        try {
          const existingSkill = await skillsAPI.getByName(cleanSkillName);
          
          // Add to local list if not already there
          setAllSkills(prev => {
            const exists = prev.find(s => s.id === existingSkill.id);
            return exists ? prev : [...prev, existingSkill];
          });
          
          // Add to selected using the skill ID
          const validatedSkillId = getSkillId(existingSkill.id);
          if (!selectedSkills.includes(validatedSkillId)) {
            onChange([...selectedSkills, validatedSkillId]);
          }
          
          setSearchTerm('');
          setShowDropdown(false);
        } catch (fetchError) {
          alert('Failed to add skill. Please try again.');
        }
      } else {
        alert('Failed to create skill: ' + error.message);
      }
    } finally {
      setCreating(false);
    }
  };

  /**
   * Handles keyboard interaction: pressing Enter adds an existing match or creates a new skill.
   * @param {React.KeyboardEvent} e - The keyboard event.
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (!searchTerm.trim()) return;

      const match = allSkills.find(
        s => s.name.toLowerCase() === searchTerm.toLowerCase()
      );

      if (match) {
        handleAdd(match.id);
      } else {
        handleCreateAndAdd();
      }
    }
  };

  /**
   * Removes a skill from the selected list and tracks deleted custom skills to
   * hide them from the dropdown.
   * @param {string} skillId - The UUID (or name) of the skill to remove.
   */
  const handleRemove = (skillId) => {
    // Ensure we're removing by the actual skill ID
    const validatedSkillId = getSkillId(skillId);
    
    // Remove from selected using validated ID
    onChange(selectedSkills.filter(id => getSkillId(id) !== validatedSkillId));
    
    // Track deleted custom skills by ID
    const skill = allSkills.find(s => s.id === validatedSkillId);
    if (skill && skill.category === 'Custom') {
      setDeletedCustomSkills(prev => {
        if (!prev.includes(validatedSkillId)) {
          return [...prev, validatedSkillId];
        }
        return prev;
      });
    }
  };

  // Map skill IDs to names properly
  /**
   * Resolves a skill ID or name to the skill's display name.
   * Handles both UUID-based and name-based identifiers (e.g. from AI extraction).
   * @param {string} skillId - The skill ID or raw name string.
   * @returns {string} The human-readable skill name.
   */
  const getSkillName = (skillId) => {
    // Try to find by ID first
    const skill = allSkills.find(s => s.id === skillId);
    if (skill) return skill.name;
    
    // If not found, skillId might BE the name (from AI extraction)
    const skillByName = allSkills.find(s => s.name === skillId);
    if (skillByName) return skillByName.name;
    
    // Assume it's a name if no match found
    return skillId;
  };

  /**
   * Resolves a skill ID or name to the canonical skill UUID.
   * Falls back to the raw input if no match is found in the loaded list.
   * @param {string} skillIdOrName - A skill UUID or name string.
   * @returns {string} The resolved UUID, or the original value if unresolvable.
   */
  const getSkillId = (skillIdOrName) => {
    // Try to find by ID first
    const skillById = allSkills.find(s => s.id === skillIdOrName);
    if (skillById) return skillById.id;
    
    // If not found, try by name
    const skillByName = allSkills.find(s => s.name === skillIdOrName);
    if (skillByName) return skillByName.id;
    
    // Return as-is (might be a newly created skill)
    return skillIdOrName;
  };

  if (loading && allSkills.length === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader className="w-4 h-4 animate-spin" />
        Loading skills...
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Selected Skills */}
      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedSkills.map(skillId => (
            <span
              key={skillId}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                darkMode
                  ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-700'
                  : 'bg-indigo-100 text-indigo-700 border border-indigo-300'
              }`}
            >
              {getSkillName(skillId)}
              <button
                type="button"
                onClick={() => handleRemove(skillId)}
                className={`hover:bg-indigo-700 rounded-full p-0.5 transition ${
                  darkMode ? 'hover:bg-indigo-800' : 'hover:bg-indigo-200'
                }`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Type to search or create skills... (Press Enter to add)"
          value={searchTerm}
          onChange={(e: React.ChangeEvent<any>) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
            darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          }`}
        />

        {/* Dropdown */}
        {showDropdown && searchTerm && (
          <div className={`absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg border shadow-xl ${
            darkMode
              ? 'bg-gray-700 border-gray-600'
              : 'bg-white border-gray-300'
          }`}>
            {/* Existing Skills */}
            {filteredSkills.length > 0 && (
              <>
                {filteredSkills.map(skill => (
                  <button
                    key={skill.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAdd(skill.id);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-indigo-500 hover:text-white transition ${
                      darkMode ? 'text-gray-200' : 'text-gray-700'
                    }`}
                  >
                    <div className="font-medium">{skill.name}</div>
                    {skill.category && (
                      <div className="text-xs opacity-75">{skill.category}</div>
                    )}
                  </button>
                ))}
              </>
            )}

            {/* Create New Skill Option */}
            {searchTerm.trim() && !exactMatch && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCreateAndAdd();
                }}
                disabled={creating}
                className={`w-full text-left px-4 py-3 border-t hover:bg-green-500 hover:text-white transition ${
                  darkMode 
                    ? 'border-gray-600 bg-gray-600 text-gray-200' 
                    : 'border-gray-200 bg-gray-50 text-gray-700'
                } ${creating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {creating ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <div>
                    <div className="font-medium">
                      {creating ? 'Creating...' : `Create "${searchTerm}"`}
                    </div>
                    <div className="text-xs opacity-75">
                      {creating ? 'Please wait...' : 'Press Enter or click to add'}
                    </div>
                  </div>
                </div>
              </button>
            )}

            {/* No Results */}
            {filteredSkills.length === 0 && exactMatch && (
              <div className={`px-4 py-3 text-center text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Skill already selected
              </div>
            )}
          </div>
        )}
      </div>

      <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
        💡 Type to search existing skills or create new one.
      </p>
    </div>
  );
};

export default SkillsMultiSelect;