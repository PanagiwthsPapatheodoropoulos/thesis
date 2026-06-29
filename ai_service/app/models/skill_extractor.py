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
from app.core.skill_matcher import skill_matcher

logger = logging.getLogger(__name__)
try:
    from sentence_transformers import SentenceTransformer, util
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

try:
    import spacy
    NLP_AVAILABLE = True
except ImportError:
    NLP_AVAILABLE = False


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
    AI_ML = "AI/ML"
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
        self._nlp_model = None
        self._init_skill_vocabularies()
    
    @property
    def nlp_model(self):
        """
        Lazy-loads the spaCy NLP model on first access.
        """
        if self._nlp_model is None:
            if not NLP_AVAILABLE:
                return None
            try:
                self._nlp_model = spacy.load("en_core_web_sm")
            except Exception:
                return None
        return self._nlp_model
    
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

    def _init_skill_descriptions(self):
        """Initialize empty skill descriptions to be populated dynamically"""
        self.skill_descriptions = {}

    def _init_skill_vocabularies(self):
        """Initialize empty skill vocabularies with generic fuzzy terms"""
        
        self.static_skill_db = {
            SkillCategory.PROGRAMMING: {
                'exact': [],
                'fuzzy': ['coding', 'programming', 'development', 'scripting'],
                'word_boundary_required': []
            },
            SkillCategory.FRONTEND: {
                'exact': [],
                'fuzzy': ['frontend', 'ui', 'ux', 'interface', 'browser', 'responsive'],
                'word_boundary_required': []
            },
            SkillCategory.BACKEND: {
                'exact': [],
                'fuzzy': ['backend', 'server', 'api', 'endpoint', 'database', 'query'],
                'word_boundary_required': []
            },
            SkillCategory.DEVOPS: {
                'exact': [],
                'fuzzy': ['devops', 'deployment', 'ci/cd', 'infrastructure', 'container', 'cloud'],
                'word_boundary_required': []
            },
            SkillCategory.DATA_SCIENCE: {
                'exact': [],
                'fuzzy': ['data', 'analysis', 'ml', 'ai', 'model', 'prediction', 'algorithm'],
                'word_boundary_required': []
            },
            SkillCategory.AI_ML: {
                'exact': [],
                'fuzzy': ['data', 'analysis', 'ml', 'ai', 'model', 'prediction', 'algorithm', 'neural', 'deep learning'],
                'word_boundary_required': []
            },
            SkillCategory.TESTING: {
                'exact': [],
                'fuzzy': ['testing', 'test', 'quality', 'qa', 'automation', 'coverage'],
                'word_boundary_required': []
            },
            SkillCategory.SOFT_SKILLS: {
                'exact': [],
                'fuzzy': ['team', 'manage', 'lead', 'communicate', 'coordinate', 'organize'],
                'word_boundary_required': []
            },
            SkillCategory.MANAGEMENT: {
                'exact': [],
                'fuzzy': ['management', 'planning', 'coordination', 'oversight', 'schedule'],
                'word_boundary_required': []
            },
            SkillCategory.SECURITY: {
                'exact': [],
                'fuzzy': ['security', 'secure', 'vulnerability', 'authentication', 'authorization'],
                'word_boundary_required': []
            },
            SkillCategory.FINANCE: {
                'exact': [],
                'fuzzy': ['finance', 'financial', 'accounting', 'budget', 'audit', 'tax', 'revenue', 'expense', 'profit', 'investment', 'banking'],
                'word_boundary_required': []
            },
            SkillCategory.MARKETING: {
                'exact': [],
                'fuzzy': ['marketing', 'advertising', 'branding', 'campaign', 'promotion', 'outreach', 'content', 'social media', 'engagement'],
                'word_boundary_required': []
            },
            SkillCategory.HR: {
                'exact': [],
                'fuzzy': ['hr', 'human resources', 'hiring', 'recruiting', 'payroll', 'benefits', 'workforce', 'personnel', 'staffing', 'retention'],
                'word_boundary_required': []
            },
            SkillCategory.DESIGN: {
                'exact': [],
                'fuzzy': ['design', 'creative', 'visual', 'prototype', 'wireframe', 'layout', 'aesthetic', 'user experience', 'user interface', 'illustration'],
                'word_boundary_required': []
            }
        }
        self.skill_db = self.static_skill_db
        self._init_skill_descriptions()

    def extract_skills(
        self,
        title: str,
        description: str = "",
        required_skills: List[str] = None,
        min_confidence: float = 0.4,
        db_skills: List[Dict] = None
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
        if db_skills:
            # Rebuild dynamically
            dynamic_skill_db = {}
            dynamic_descriptions = {}
            
            # Precompile a list of all names to dynamically find substring overrides
            all_names = [s.get('name') for s in db_skills if s.get('name')]
            
            for skill in db_skills:
                name = skill.get('name')
                category_str = skill.get('category')
                description_str = skill.get('description') or ""
                
                if not name:
                    continue
                
                category = SkillCategory.OTHER
                if category_str:
                    for cat in SkillCategory:
                        if (cat.value.lower() == category_str.lower() or 
                            cat.value.replace('/', '').lower() == category_str.replace('/', '').lower()):
                            category = cat
                            break
                
                if category not in dynamic_skill_db:
                    dynamic_skill_db[category] = {
                        'exact': [],
                        'fuzzy': [],
                        'word_boundary_required': []
                    }
                
                dynamic_skill_db[category]['exact'].append(name)
                
                # Dynamically check if this name is a substring of another skill name
                name_lower = name.lower()
                is_substring_of_other = any(
                    name_lower in other.lower() 
                    for other in all_names 
                    if other.lower() != name_lower
                )
                
                if len(name) <= 3 or is_substring_of_other:
                    dynamic_skill_db[category]['word_boundary_required'].append(name)
                
                dynamic_descriptions[name.lower()] = description_str

            # Copy fuzzy terms from static vocabularies
            for category, skills in self.static_skill_db.items():
                if category in dynamic_skill_db:
                    dynamic_skill_db[category]['fuzzy'] = skills.get('fuzzy', [])
                    for wb in skills.get('word_boundary_required', []):
                        if wb not in dynamic_skill_db[category]['word_boundary_required']:
                            dynamic_skill_db[category]['word_boundary_required'].append(wb)
            
            self.skill_db = dynamic_skill_db
            self.skill_descriptions = dynamic_descriptions
        else:
            self.skill_db = self.static_skill_db
            self._init_skill_descriptions()
                
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

        # 2.5 Dynamic NLP extraction (spaCy zero-shot)
        if self.nlp_model is not None:
            try:
                nlp_skills = self._extract_by_nlp(title, description)
                existing_names = {s.name.lower() for s in extracted}
                for skill in nlp_skills:
                    if skill.name.lower() not in existing_names:
                        extracted.append(skill)
                        existing_names.add(skill.name.lower())
            except Exception as e:
                logger.warning(f"NLP extraction failed: {e}")
        
        # 3. Filter by confidence
        filtered = [s for s in extracted if s.confidence >= min_confidence]
        
        # 4. Deduplicate and sort by confidence using canonical skill names
        unique_skills = {}
        for skill in filtered:
            canonical_key = skill_matcher.get_canonical_skill(skill.name)
            if canonical_key not in unique_skills:
                unique_skills[canonical_key] = skill
            else:
                existing = unique_skills[canonical_key]
                # Prefer:
                #  Higher confidence
                #  If confidence is equal, prefer the one with a non-empty description
                #  Prefer the one with spaces or normal casing (e.g. "Spring Boot" over "Springboot")
                if skill.confidence > existing.confidence:
                    unique_skills[canonical_key] = skill
                elif skill.confidence == existing.confidence:
                    existing_desc = self.skill_descriptions.get(existing.name.lower()) or ""
                    current_desc = self.skill_descriptions.get(skill.name.lower()) or ""
                    if len(current_desc) > len(existing_desc):
                        unique_skills[canonical_key] = skill
                    elif len(current_desc) == len(existing_desc) and " " in skill.name and " " not in existing.name:
                        unique_skills[canonical_key] = skill
        
        result = sorted(unique_skills.values(), key=lambda x: x.confidence, reverse=True)
        
        #  Dynamic co-suggestion
        if result:
            try:
                result = self._add_semantic_cosuggestions(result, co_suggestion_threshold=0.65)
                # Filter again because co-suggestions might have confidence below min_confidence
                result = [s for s in result if s.confidence >= min_confidence]
            except Exception as e:
                logger.warning(f"Co-suggestion failed: {e}")
                
        # Final sort to ensure both exact and semantic matches are strictly ordered
        result.sort(key=lambda x: x.confidence, reverse=True)
        
        # Logging
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
        normalized_text = re.sub(r'[\s\-\.\/_]+', '', combined_text)
        extracted = []
        
        for category, skills in self.skill_db.items():
            # Check exact matches with proper word boundaries
            for skill in skills['exact']:
                skill_lower = skill.lower()
                
                # Use lookarounds instead of \b to handle symbols like C++, .NET, C#, Node.js properly
                pattern = r'(?<![a-z0-9])' + re.escape(skill_lower) + r'(?![a-z0-9])'
                
                # Create a version without spaces/dashes (e.g. "springboot" for "Spring Boot")
                normalized_skill = re.sub(r'[\s\-\.\/_]+', '', skill_lower)
                pattern_norm = r'(?<![a-z0-9])' + re.escape(normalized_skill) + r'(?![a-z0-9])'
                
                if not re.search(pattern, combined_text) and not re.search(pattern_norm, combined_text):
                    continue
                
                confidence = 0.95
                source = "title" if skill_lower in title.lower() else "description"
                
                extracted.append(ExtractedSkill(
                    name=skill,
                    category=category,
                    confidence=confidence,
                    source=source,
                    suggested_proficiency=self._estimate_proficiency(skill, combined_text)
                ))
            
            # Check fuzzy matches
            for fuzzy_term in skills['fuzzy']:
                fuzzy_lower = fuzzy_term.lower()
                # Use regex to enforce word boundaries for fuzzy terms to prevent 'ui' matching 'requires'
                pattern = r'\b' + re.escape(fuzzy_lower) + r'\b'
                if re.search(pattern, combined_text):
                    related_count = sum(
                        1 for term in skills['fuzzy'] 
                        if re.search(r'\b' + re.escape(term.lower()) + r'\b', combined_text)
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

    def _add_semantic_cosuggestions(self, extracted: List[ExtractedSkill], co_suggestion_threshold: float = 0.35) -> List[ExtractedSkill]:
        """
        Dynamically finds related skills based on:
        1. Description cross-matching (e.g. if 'Java' is in 'Spring Boot' description).
        2. Semantic similarity between extracted skill descriptions and database skill descriptions.
        """
        existing_names_lower = {s.name.lower() for s in extracted}
        
        all_vocab_skills = []
        for category, skills in self.skill_db.items():
            for skill_name in skills.get('exact', []):
                all_vocab_skills.append((skill_name, category))

        new_suggestions = {}
        
        # 1. Description cross-matching
        for extracted_skill in extracted:
            desc = self.skill_descriptions.get(extracted_skill.name.lower())
            if not desc:
                continue
            
            desc_lower = desc.lower()
            for vocab_name, vocab_cat in all_vocab_skills:
                vocab_lower = vocab_name.lower()
                if vocab_lower == extracted_skill.name.lower():
                    continue
                if vocab_lower in existing_names_lower:
                    continue
                
                # Check if vocab skill name is a whole word in the description
                pattern = r'\b' + re.escape(vocab_lower) + r'\b'
                if re.search(pattern, desc_lower):
                    confidence = round(extracted_skill.confidence * 0.9, 3)
                    if vocab_lower not in new_suggestions or new_suggestions[vocab_lower].confidence < confidence:
                        new_suggestions[vocab_lower] = ExtractedSkill(
                            name=vocab_name,
                            category=vocab_cat,
                            confidence=confidence,
                            source="description_relation",
                            suggested_proficiency=extracted_skill.suggested_proficiency
                        )

        # Merge Phase 1 suggestions
        for suggestion in new_suggestions.values():
            existing_names_lower.add(suggestion.name.lower())
            extracted.append(suggestion)

        # 2. Semantic embeddings-based similarity suggestions
        if self.model is not None and all_vocab_skills:
            try:
                # Prepare lists for embedding comparison
                vocab_names = [v[0] for v in all_vocab_skills]
                vocab_cats = [v[1] for v in all_vocab_skills]
                vocab_descs = [self.skill_descriptions.get(v[0].lower(), "") for v in all_vocab_skills]
                
                # We need descriptions to compare
                valid_vocab_indices = [i for i, d in enumerate(vocab_descs) if d]
                if not valid_vocab_indices:
                    return extracted
                    
                compare_descs = [vocab_descs[i] for i in valid_vocab_indices]
                vocab_desc_embs = self.model.encode(compare_descs, convert_to_tensor=True)
                
                for extracted_skill in list(extracted):  # Iterate over a copy since we append
                    extracted_desc = self.skill_descriptions.get(extracted_skill.name.lower())
                    if not extracted_desc:
                        continue
                        
                    extracted_emb = self.model.encode(extracted_desc, convert_to_tensor=True)
                    similarities = util.pytorch_cos_sim(extracted_emb, vocab_desc_embs)[0]
                    
                    top_idx = np.argsort(similarities.cpu().numpy())[-3:][::-1]
                    
                    for idx in top_idx:
                        similarity = float(similarities[idx])
                        if similarity > co_suggestion_threshold:
                            real_idx = valid_vocab_indices[idx]
                            vocab_name = vocab_names[real_idx]
                            vocab_lower = vocab_name.lower()
                            
                            if vocab_lower != extracted_skill.name.lower() and vocab_lower not in existing_names_lower:
                                confidence = round(min(extracted_skill.confidence * similarity, 0.95), 3)
                                extracted.append(ExtractedSkill(
                                    name=vocab_name,
                                    category=vocab_cats[real_idx],
                                    confidence=confidence,
                                    source="semantic_relation",
                                    suggested_proficiency=extracted_skill.suggested_proficiency
                                ))
                                existing_names_lower.add(vocab_lower)
            except Exception as e:
                logger.warning(f"Semantic co-suggestion error: {e}")
                
        return extracted

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
        existing_skills: List[str],
        db_skills: List[Dict] = None
    ) -> List[Dict]:
        """
        Identifies skill gaps by analyzing a team's task backlog against their existing skills.
        Aggregates extraction results across all tasks and ranks missing skills by how
        frequently and confidently they appear. Returns the top 10 recommendations.

        Args:
            team_tasks (List[Dict]): Task dicts containing 'title' and 'description' keys.
            existing_skills (List[str]): Skills the team already possesses.
            db_skills (List[Dict], optional): Dynamic database skill definitions.

        Returns:
            List[Dict]: Up to 10 skill gap suggestions sorted by priority score (frequency x confidence).
        """
                
        skill_frequency = {}
        existing_lower = {s.lower() for s in existing_skills}
        
        for task in team_tasks:
            extracted = self.extract_skills(
                task.get('title', ''),
                task.get('description', ''),
                min_confidence=0.6,
                db_skills=db_skills
            )
            
            for skill in extracted:
                if skill.name.lower() not in existing_lower:
                    if skill.name not in skill_frequency:
                        skill_frequency[skill.name] = {
                            'category': skill.category.value if isinstance(skill.category, SkillCategory) else str(skill.category),
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

    def _extract_by_nlp(self, title: str, description: str) -> List[ExtractedSkill]:
        """
        Uses spaCy to dynamically identify proper nouns and tech terms that are not 
        hardcoded in the database (zero-shot extraction).
        """
        if not self.nlp_model:
            return []
            
        combined_text = f"{title} {description}"
        # Keep text reasonably sized for speed
        if len(combined_text) > 2000:
            combined_text = combined_text[:2000]
            
        doc = self.nlp_model(combined_text)
        extracted = []
        
        # Stopwords or generic words we want to avoid as skills
        generic_words = {
            # Meta
            "knowledge", "experience", "ability", "understanding", "skills", "years", "team", "work", "project", 
            "system", "software", "development", "application", "data", "business", "requirements", "support", 
            "management", "design", "good", "strong", "excellent", "familiarity", "proficient", "proficiency", 
            "working", "using", "including", "such", "like", "environment", "role", "candidate", "job", "company", 
            "time", "day", "week", "month", "year", "new", "old", "current", "future", "past", "internal", "external",
            # Verbs often misclassified as proper nouns due to capitalization
            "create", "build", "make", "write", "update", "delete", "remove", "add", "setup", "configure", 
            "test", "deploy", "run", "execute", "manage", "lead", "plan", "review", "implement", "develop",
            "maintain", "improve", "optimize", "analyze", "resolve", "fix", "troubleshoot", "debug", "monitor",
            "coordinate", "evaluate", "discuss", "organize", "prepare", "conduct", "ensure", "align", "track", "launch",
            # Generic IT and Business nouns
            "notebook", "notebooks", "script", "scripts", "code", "file", "files", "document", "documents", 
            "task", "tasks", "issue", "issues", "bug", "bugs", "feature", "features", "app", "apps", 
            "server", "servers", "database", "databases", "api", "apis", "endpoint", "endpoints", "ui", "ux",
            "frontend", "backend", "fullstack", "developer", "engineer", "architect", "manager", "admin",
            "user", "users", "client", "clients", "customer", "customers", "product", "products", "service",
            "hire", "hires", "hiring", "onboarding", "interview", "interviews", "meeting", "meetings", "strategy",
            "process", "processes", "workflow", "workflows", "pipeline", "pipelines", "campaign", "campaigns", "roi",
            "refactor", "refactoring", "managers", "employees", "intern", "interns", "staff", "personnel", "hr",
            "report", "reports", "custom", "query", "queries", "trend", "trends", "metric", "metrics", "analytics"
        }
        
        # We look for PROPN (Proper Nouns) and unique Noun Chunks
        potential_skills = set()
        
        # 1. Look for isolated Proper Nouns (like React, Python)
        for token in doc:
            if token.pos_ == "PROPN" and len(token.text) > 1:
                # Use lemma to catch variations like "Notebooks" -> "notebook"
                if token.text.lower() not in generic_words and token.lemma_.lower() not in generic_words:
                    potential_skills.add(token.text.strip())
                
        # 2. Look for technical Noun Chunks (like "Machine Learning", "Data Analysis")
        for chunk in doc.noun_chunks:
            # Filter out chunks that have determiners/pronouns (e.g. "my experience", "the team")
            valid = True
            for token in chunk:
                if token.pos_ in ["PRON", "DET", "VERB"]:
                    valid = False
            
            clean_text = chunk.text.strip()
            # If valid, not too long, and contains interesting nouns
            if valid and 2 < len(clean_text) < 30:
                # check if any word in the chunk is generic or a verb
                words = [w.lower() for w in clean_text.split()]
                lemmas = [token.lemma_.lower() for token in chunk]
                if not any(w in generic_words for w in words) and not any(l in generic_words for l in lemmas):
                    # Filter out chunks that start with punctuation
                    if not clean_text[0].isalnum():
                        continue
                    # Prevent extracting "C# controllers" if it contains C#
                    if "c#" in clean_text.lower():
                        continue
                    potential_skills.add(clean_text)

        # Specifically look for things like C# or C++ which spacy might misclassify
        import re
        # Use lookarounds instead of \b because # and + are not word characters
        tech_symbols = re.findall(r'(?i)(?<![a-z0-9])(C#|C\+\+|\.NET|Node\.js|React\.js|Vue\.js)(?![a-z0-9])', combined_text)
        for tech in tech_symbols:
            # Normalize casing for C#
            if tech.lower() == 'c#': tech = 'C#'
            if tech.lower() == 'c++': tech = 'C++'
            if tech.lower() == '.net': tech = '.NET'
            potential_skills.add(tech)

        for skill_name in potential_skills:
            # Only add if it's alphanumeric and some symbols, and starts with alphanumeric
            if re.match(r'^[a-zA-Z0-9][a-zA-Z0-9\+#\.\-\s]*$', skill_name):
                extracted.append(ExtractedSkill(
                    name=skill_name.title() if skill_name.islower() else skill_name,
                    category=SkillCategory.OTHER,
                    confidence=0.6, # Default confidence for dynamic NLP
                    source="nlp_dynamic"
                ))
                
        return extracted