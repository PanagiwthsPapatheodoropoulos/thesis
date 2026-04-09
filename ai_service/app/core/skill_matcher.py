"""
core/skill_matcher.py - Fuzzy Skill Name Matching with Synonym Resolution.

Provides the SkillMatcher utility used during candidate scoring to compare
required task skills against an employee's recorded skills. It handles common
variations such as typos, alternate capitalization, separator differences, and
well-known abbreviations/synonyms, producing a normalized form that enables
fuzzy matching via Python's SequenceMatcher.
"""

import logging
import re
from typing import List, Dict, Tuple
from difflib import SequenceMatcher
from functools import lru_cache

logger = logging.getLogger(__name__)


class SkillMatcher:
    """
    Intelligent skill matching across different naming conventions
    
    Handles:
    - Typos: "Springboot" → "Spring Boot"
    - Case differences: "java" → "Java"
    - Abbreviations: "JS" → "JavaScript"
    - Synonyms: "React.js" → "React"
    - Separators: "spring-boot" → "Spring Boot"
    """
    
    def __init__(self):
        # Skill synonyms (add more as needed)
        self.synonyms = {
            # Programming Languages
            'javascript': ['js', 'ecmascript', 'es6', 'es2015'],
            'typescript': ['ts'],
            'python': ['py', 'python3'],
            'java': ['jdk', 'openjdk'],
            'c++': ['cpp', 'cplusplus', 'c plus plus'],
            'c#': ['csharp', 'c sharp', 'dotnet'],
            
            # Frameworks
            'spring boot': ['springboot', 'spring-boot', 'boot'],
            'react': ['reactjs', 'react.js'],
            'vue': ['vuejs', 'vue.js'],
            'angular': ['angularjs', 'angular.js'],
            'django': ['django rest framework', 'drf'],
            'flask': ['flask api'],
            'express': ['expressjs', 'express.js'],
            
            # DevOps
            'docker': ['containerization', 'docker compose'],
            'kubernetes': ['k8s', 'kube'],
            'aws': ['amazon web services', 'amazon aws'],
            'azure': ['microsoft azure'],
            'gcp': ['google cloud', 'google cloud platform'],
            
            # Databases
            'postgresql': ['postgres', 'psql'],
            'mongodb': ['mongo'],
            'mysql': ['my sql'],
            
            # Testing
            'junit': ['junit5', 'junit4', 'j-unit'],
            'pytest': ['py-test'],
            'jest': ['jestjs'],
            
            # Other
            'machine learning': ['ml', 'machinelearning'],
            'artificial intelligence': ['ai'],
            'deep learning': ['dl', 'deeplearning'],
        }
        
        # Build reverse mapping (synonym → canonical)
        self.synonym_to_canonical = {}
        for canonical, syns in self.synonyms.items():
            for syn in syns:
                self.synonym_to_canonical[syn] = canonical
            
    def normalize_skill_name(self, skill_name: str) -> str:
        """
        Normalizes a skill name to a canonical lowercase, space-separated form
        suitable for string comparison.

        Handles case conversion, separator replacement (hyphens, underscores, slashes),
        dot removal (React.js -> react js), and special-character preservation (C++, C#).

        Args:
            skill_name (str): The raw skill name from a task or employee record.

        Returns:
            str: The normalized skill name, or an empty string if input is falsy.
        """
        if not skill_name:
            return ""
        
        # Convert to lowercase
        normalized = skill_name.lower().strip()
        
        # Replace common separators with spaces
        normalized = re.sub(r'[-_/]', ' ', normalized)
        
        # Remove extra spaces
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Handle special cases like C++, C#
        if normalized in ['c++', 'c#', 'f#']:
            return normalized
        
        # Remove dots (React.js → react js)
        normalized = normalized.replace('.', ' ')
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        
        return normalized
    
    @lru_cache(maxsize=1000)
    def get_canonical_skill(self, skill_name: str) -> str:
        """
        Returns the canonical form of a skill name by resolving synonyms.
        Results are cached via LRU cache to avoid repeated lookups.

        Args:
            skill_name (str): The raw skill name to canonicalize.

        Returns:
            str: The canonical skill name (e.g., 'JS' -> 'javascript').
        """
        normalized = self.normalize_skill_name(skill_name)
        
        # Check if it's a known synonym
        if normalized in self.synonym_to_canonical:
            return self.synonym_to_canonical[normalized]
        
        # Check if it's already a canonical skill
        if normalized in self.synonyms:
            return normalized
        
        # Return normalized form
        return normalized
    
    def skills_match(self, skill1: str, skill2: str, threshold: float = 0.85) -> bool:
        """
        Check if two skills match (with fuzzy matching)
        
        Args:
            skill1: First skill name
            skill2: Second skill name
            threshold: Similarity threshold (0.0-1.0)
        
        Returns:
            True if skills match
        """
        if not skill1 or not skill2:
            return False
        
        # Get canonical forms
        canonical1 = self.get_canonical_skill(skill1)
        canonical2 = self.get_canonical_skill(skill2)
        
        # Exact match after canonicalization
        if canonical1 == canonical2:
            return True
        
        # Fuzzy string matching (for typos)
        similarity = SequenceMatcher(None, canonical1, canonical2).ratio()
        
        if similarity >= threshold:
            return True
        
        return False
    
    def find_matching_skill(
        self, 
        target_skill: str, 
        available_skills: List[str]
    ) -> Tuple[str, float]:
        """
        Find best matching skill from a list
        
        Args:
            target_skill: Skill to match
            available_skills: List of available skill names
        
        Returns:
            (best_match, confidence_score)
        """
        if not available_skills:
            return (None, 0.0)
        
        target_canonical = self.get_canonical_skill(target_skill)
        
        best_match = None
        best_score = 0.0
        
        for available_skill in available_skills:
            available_canonical = self.get_canonical_skill(available_skill)
            
            # Exact match
            if target_canonical == available_canonical:
                return (available_skill, 1.0)
            
            # Fuzzy match
            similarity = SequenceMatcher(None, target_canonical, available_canonical).ratio()
            
            if similarity > best_score:
                best_score = similarity
                best_match = available_skill
        
        # Only return if confidence is high enough
        if best_score >= 0.8:
            return (best_match, best_score)
        
        return (None, 0.0)
    
    def match_skill_sets(
        self,
        required_skills: List[str],
        employee_skills: Dict[str, int]
    ) -> Dict[str, any]:
        """
        Match required skills against employee skills
        
        Args:
            required_skills: List of required skill names/IDs
            employee_skills: {skill_name_or_id: proficiency}
        
        Returns:
            {
                'matched': [skill_names],
                'coverage': 0.0-1.0,
                'avg_proficiency': 0.0-5.0,
                'details': {skill: {match, proficiency}}
            }
        """
        if not required_skills:
            return {
                'matched': [],
                'coverage': 1.0,  # No skills required = 100% coverage
                'avg_proficiency': 5.0,
                'details': {}
            }
        
        if not employee_skills:
            return {
                'matched': [],
                'coverage': 0.0,
                'avg_proficiency': 0.0,
                'details': {}
            }
        
        employee_skill_names = list(employee_skills.keys())
        
        matched_skills = []
        proficiencies = []
        details = {}
        
        for required in required_skills:
            match, confidence = self.find_matching_skill(required, employee_skill_names)
            
            if match:
                matched_skills.append(required)
                proficiency = employee_skills[match]
                proficiencies.append(proficiency)
                
                details[required] = {
                    'matched': True,
                    'employee_skill': match,
                    'confidence': confidence,
                    'proficiency': proficiency
                }
            else:
                details[required] = {
                    'matched': False,
                    'employee_skill': None,
                    'confidence': 0.0,
                    'proficiency': 0
                }
        
        coverage = len(matched_skills) / len(required_skills)
        avg_proficiency = sum(proficiencies) / len(proficiencies) if proficiencies else 0.0
        
        return {
            'matched': matched_skills,
            'coverage': coverage,
            'avg_proficiency': avg_proficiency,
            'details': details
        }


# Global instance
skill_matcher = SkillMatcher()