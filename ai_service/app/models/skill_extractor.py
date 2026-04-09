"""
models/skill_extractor.py - NLP-Based Skill Extraction from Task Text.

Provides the SkillExtractor class which combines keyword-based pattern matching
with optional semantic similarity (via sentence-transformers) to identify relevant
technical and soft skills from a task's title and description. Results are ranked
by confidence, de-duplicated, and categorized using a predefined skill taxonomy.
"""

import logging
from typing import List, Dict
import numpy as np
from dataclasses import dataclass
from enum import Enum
import re

logger = logging.getLogger(__name__)
try:
    from sentence_transformers import SentenceTransformer, util
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False


class SkillCategory(str, Enum):
    """
    Predefined taxonomy of skill domains used to categorize extracted skills.
    Each value is both the enum member and the human-readable category label.
    """
    PROGRAMMING = "Programming"
    FRONTEND = "Frontend"
    BACKEND = "Backend"
    DEVOPS = "DevOps"
    DATA_SCIENCE = "Data Science"
    SOFT_SKILLS = "Soft Skills"
    FINANCE = "Finance"
    MARKETING = "Marketing"
    HR = "HR"
    DESIGN = "Design"
    MANAGEMENT = "Management"
    TESTING = "Testing"
    SECURITY = "Security"
    OTHER = "Other"


@dataclass
class ExtractedSkill:
    """
    Represents a single skill identified by the extraction pipeline.

    Attributes:
        name (str): The canonical skill name (e.g., 'React', 'Docker').
        category (SkillCategory): The domain category the skill belongs to.
        confidence (float): Extraction confidence in [0.0, 1.0].
        source (str): How the skill was found ('title', 'description', 'semantic').
        suggested_proficiency (int): Estimated required proficiency level (1 to 5).
    """
    name: str
    category: SkillCategory
    confidence: float  # 0.0 to 1.0
    source: str  # "title", "description", "keywords"
    suggested_proficiency: int = 3  # 1-5, default middle


class SkillExtractor:
    """
    Extracts skills from task titles and descriptions using a two-stage pipeline.

    Stage 1: Keyword-based matching using a curated skill vocabulary with support
    for exact terms, fuzzy category terms, and single-letter boundary matching.
    Stage 2: Semantic matching using the all-MiniLM-L6-v2 sentence transformer
    model (loaded lazily), which identifies skills based on contextual similarity.
    """

    def __init__(self):
        self._model = None
        self._init_skill_vocabularies()
    
    @property
    def model(self):
        """
        Lazy-loads the sentence-transformer model on first access.
        Returns None if the transformers library is not installed.

        Returns:
            SentenceTransformer or None: The NLP embedding model, or None on failure.
        """
        if self._model is None:
            if not TRANSFORMERS_AVAILABLE:
                return None
            
            try:
                self._model = SentenceTransformer('all-MiniLM-L6-v2')
            except Exception:
                return None
        return self._model

    def _init_skill_vocabularies(self):
        """Initialize comprehensive skill vocabularies"""
        
        self.skill_db = {
            SkillCategory.PROGRAMMING: {
                'exact': [
                    'Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'C#',
                    'Go', 'Rust', 'Kotlin', 'Swift', 'PHP', 'Ruby',
                    'Scala', 'Clojure', 'Haskell', 'Lua', 'Perl', 'VB.NET',
                    'MATLAB'
                ],
                'fuzzy': ['coding', 'programming', 'development', 'scripting'],
                # Single-letter skills need special handling
                'word_boundary_required': ['R']  # Only match as standalone word
            },
            SkillCategory.FRONTEND: {
                'exact': ['React', 'Vue', 'Angular', 'Next.js', 'Nuxt', 'Svelte',
                         'HTML', 'CSS', 'Tailwind', 'Bootstrap', 'Material-UI',
                         'Redux', 'Vuex', 'Pinia', 'Electron', 'React Native'],
                'fuzzy': ['frontend', 'ui', 'ux', 'interface', 'browser', 'responsive']
            },
            SkillCategory.BACKEND: {
                'exact': ['Spring Boot', 'Django', 'Flask', 'FastAPI', 'Node.js',
                         'Express', 'NestJS', 'ASP.NET', 'Laravel', 'Ruby on Rails',
                         'GraphQL', 'REST', 'gRPC', 'Microservices'],
                'fuzzy': ['backend', 'server', 'api', 'endpoint', 'database', 'query']
            },
            SkillCategory.DEVOPS: {
                'exact': ['Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Terraform',
                         'Ansible', 'Jenkins', 'GitLab CI', 'GitHub Actions', 'CircleCI',
                         'Prometheus', 'Grafana', 'ELK Stack', 'Nginx', 'Apache'],
                'fuzzy': ['devops', 'deployment', 'ci/cd', 'infrastructure', 'container', 'cloud']
            },
            SkillCategory.DATA_SCIENCE: {
                'exact': ['Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch',
                         'Scikit-learn', 'Pandas', 'NumPy', 'Matplotlib', 'Seaborn',
                         'SQL', 'Spark', 'Hadoop', 'Statistics', 'Linear Algebra'],
                'fuzzy': ['data', 'analysis', 'ml', 'ai', 'model', 'prediction', 'algorithm']
            },
            SkillCategory.TESTING: {
                'exact': ['JUnit', 'PyTest', 'Jest', 'Mocha', 'Selenium', 'Cypress',
                         'Postman', 'LoadRunner', 'JMeter', 'BDD', 'TDD', 'QA'],
                'fuzzy': ['testing', 'test', 'quality', 'qa', 'automation', 'coverage']
            },
            SkillCategory.SOFT_SKILLS: {
                'exact': ['Communication', 'Leadership', 'Problem Solving', 'Critical Thinking',
                         'Time Management', 'Teamwork', 'Collaboration', 'Adaptability',
                         'Creativity', 'Project Management', 'Negotiation'],
                'fuzzy': ['team', 'manage', 'lead', 'communicate', 'coordinate', 'organize']
            },
            SkillCategory.MANAGEMENT: {
                'exact': ['Agile', 'Scrum', 'Kanban', 'Jira', 'Confluence', 'Risk Management',
                         'Budget Management', 'Stakeholder Management', 'Strategic Planning'],
                'fuzzy': ['management', 'planning', 'coordination', 'oversight', 'schedule']
            },
            SkillCategory.SECURITY: {
                'exact': ['Cybersecurity', 'Encryption', 'OAuth', 'JWT', 'SSL/TLS',
                         'Penetration Testing', 'Network Security', 'OWASP', 'Firewalls'],
                'fuzzy': ['security', 'secure', 'vulnerability', 'authentication', 'authorization']
            }
        }

    def extract_skills(
        self,
        title: str,
        description: str = "",
        required_skills: List[str] = None,
        min_confidence: float = 0.4
    ) -> List[ExtractedSkill]:
        """
        Runs the full extraction pipeline and returns a ranked list of skills.
        Combines keyword-based and (if available) semantic extraction, then
        filters by confidence, de-duplicates, and sorts by score descending.

        Args:
            title (str): The task title used as the primary extraction source.
            description (str): The task description for supplementary extraction.
            required_skills (List[str], optional): Pre-defined skills to force-include.
            min_confidence (float): Minimum confidence threshold; skills below this are dropped.

        Returns:
            List[ExtractedSkill]: Deduplicated, confidence-ranked list of detected skills.
        """
                
        extracted = []
        
        # 1. Keyword-based extraction (fixed for word boundaries)
        keyword_skills = self._extract_by_keywords(title, description)
        extracted.extend(keyword_skills)
        
        # 2. Semantic extraction (if model available)
        if self.model is not None:
            try:
                semantic_skills = self._extract_by_semantics(title, description)
                existing_names = {s.name.lower() for s in extracted}
                for skill in semantic_skills:
                    if skill.name.lower() not in existing_names:
                        extracted.append(skill)
                        existing_names.add(skill.name.lower())
            except Exception as e:
                logger.warning(f"Semantic extraction failed: {e}")
        
        # 3. Filter by confidence
        filtered = [s for s in extracted if s.confidence >= min_confidence]
        
        # 4. Deduplicate and sort by confidence
        unique_skills = {}
        for skill in filtered:
            key = skill.name.lower()
            if key not in unique_skills or skill.confidence > unique_skills[key].confidence:
                unique_skills[key] = skill
        
        result = sorted(unique_skills.values(), key=lambda x: x.confidence, reverse=True)
        
        for skill in result[:5]:
            logger.info(f"  - {skill.name}: {skill.confidence:.1%} ({skill.category})")
        
        return result

    def _extract_by_keywords(self, title: str, description: str) -> List[ExtractedSkill]:
        """
        Matches skills from the vocabulary against combined task text.
        Uses word-boundary regex for single-letter skills (e.g., 'R') to prevent
        false positives, and substring matching for all multi-character skills.
        Fuzzy terms trigger category-representative skills with adjusted confidence.

        Args:
            title (str): The task title.
            description (str): The task description.

        Returns:
            List[ExtractedSkill]: Skills found via keyword matching.
        """
        
        combined_text = f"{title} {description}".lower()
        extracted = []
        
        for category, skills in self.skill_db.items():
            # Check exact matches with proper word boundaries
            for skill in skills['exact']:
                # For single-letter skills, require word boundaries
                if len(skill) == 1 or skill in skills.get('word_boundary_required', []):
                    # Use regex word boundary for single letters
                    pattern = r'\b' + re.escape(skill.lower()) + r'\b'
                    if not re.search(pattern, combined_text):
                        continue
                else:
                    # Normal substring search for multi-character skills
                    if skill.lower() not in combined_text:
                        continue
                
                confidence = 0.95
                source = "title" if skill.lower() in title.lower() else "description"
                
                extracted.append(ExtractedSkill(
                    name=skill,
                    category=category,
                    confidence=confidence,
                    source=source,
                    suggested_proficiency=self._estimate_proficiency(skill, combined_text)
                ))
            
            # Check fuzzy matches
            for fuzzy_term in skills['fuzzy']:
                if fuzzy_term.lower() in combined_text:
                    related_count = sum(
                        1 for term in skills['fuzzy'] 
                        if term.lower() in combined_text
                    )
                    confidence = min(0.5 + (related_count * 0.1), 0.8)
                    
                    representative = skills['exact'][0] if skills['exact'] else fuzzy_term.title()
                    
                    extracted.append(ExtractedSkill(
                        name=representative,
                        category=category,
                        confidence=confidence,
                        source="description"
                    ))
                    break
        
        return extracted

    def _extract_by_semantics(self, title: str, description: str) -> List[ExtractedSkill]:
        """
        Uses sentence embeddings to identify skills via cosine similarity.
        For each taxonomy category, the top-2 most similar skills above the
        0.5 similarity threshold are returned as detected skills.

        Args:
            title (str): The task title.
            description (str): The task description.

        Returns:
            List[ExtractedSkill]: Skills identified through semantic similarity.
        """
        
        if self.model is None:
            return []
        
        try:
            task_text = f"{title} {description}"
            task_embedding = self.model.encode(task_text, convert_to_tensor=True)
            
            extracted = []
            
            for category, skills in self.skill_db.items():
                skill_names = skills['exact']
                if not skill_names:
                    continue
                
                skill_embeddings = self.model.encode(skill_names, convert_to_tensor=True)
                similarities = util.pytorch_cos_sim(task_embedding, skill_embeddings)[0]
                
                top_idx = np.argsort(similarities.cpu().numpy())[-2:][::-1]
                
                for idx in top_idx:
                    similarity = float(similarities[idx])
                    
                    if similarity > 0.5:
                        extracted.append(ExtractedSkill(
                            name=skill_names[idx],
                            category=category,
                            confidence=min(similarity, 0.95),
                            source="semantic"
                        ))
            
            return extracted
            
        except Exception as e:
            logger.error(f"Semantic extraction error: {e}")
            return []

    def _estimate_proficiency(self, skill: str, context: str) -> int:
        """
        Estimates the required proficiency level for a skill based on contextual keywords.
        Scans the surrounding text for expert, intermediate, or basic level indicators.

        Args:
            skill (str): The skill name (not used directly, kept for API signature).
            context (str): The full task text to scan for proficiency indicators.

        Returns:
            int: An estimated proficiency level from 1 (beginner) to 5 (expert), defaulting to 3.
        """
        
        expert_keywords = ['advanced', 'expert', 'master', 'architect', 'lead']
        intermediate_keywords = ['proficient', 'experienced', 'strong', 'solid']
        basic_keywords = ['basic', 'familiar', 'beginner', 'learn', 'understand']
        
        context_lower = context.lower()
        
        if any(kw in context_lower for kw in expert_keywords):
            return 5
        elif any(kw in context_lower for kw in intermediate_keywords):
            return 4
        elif any(kw in context_lower for kw in basic_keywords):
            return 2
        
        return 3

    def suggest_skills_for_team(
        self,
        team_tasks: List[Dict],
        existing_skills: List[str]
    ) -> List[Dict]:
        """
        Identifies skill gaps by analyzing a team's task backlog against their existing skills.
        Aggregates extraction results across all tasks and ranks missing skills by how
        frequently and confidently they appear. Returns the top 10 recommendations.

        Args:
            team_tasks (List[Dict]): Task dicts containing 'title' and 'description' keys.
            existing_skills (List[str]): Skills the team already possesses.

        Returns:
            List[Dict]: Up to 10 skill gap suggestions sorted by priority score (frequency x confidence).
        """
                
        skill_frequency = {}
        existing_lower = {s.lower() for s in existing_skills}
        
        for task in team_tasks:
            extracted = self.extract_skills(
                task.get('title', ''),
                task.get('description', ''),
                min_confidence=0.6
            )
            
            for skill in extracted:
                if skill.name.lower() not in existing_lower:
                    if skill.name not in skill_frequency:
                        skill_frequency[skill.name] = {
                            'category': skill.category,
                            'count': 0,
                            'avg_confidence': 0
                        }
                    
                    skill_frequency[skill.name]['count'] += 1
                    skill_frequency[skill.name]['avg_confidence'] += skill.confidence
        
        suggestions = []
        for skill_name, data in skill_frequency.items():
            avg_conf = data['avg_confidence'] / data['count']
            priority_score = data['count'] * avg_conf
            
            suggestions.append({
                'skill_name': skill_name,
                'category': data['category'],
                'frequency': data['count'],
                'avg_confidence': avg_conf,
                'priority_score': priority_score
            })
        
        suggestions.sort(key=lambda x: x['priority_score'], reverse=True)
        
        return suggestions[:10]