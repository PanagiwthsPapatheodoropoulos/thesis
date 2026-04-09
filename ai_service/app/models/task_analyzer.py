# ai_service/app/models/task_analyzer.py
"""
NLP-based Task Analysis System
Automatically scores task complexity, categorizes tasks, and estimates effort
Uses transformers and linguistic analysis for semantic understanding
"""

import logging
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import re

NLPTOOLS_AVAILABLE = True

try:
    from sentence_transformers import SentenceTransformer, util
except ImportError as e:
    NLPTOOLS_AVAILABLE = False
    logging.error(f"SentenceTransformers import failed: {e}")

try:
    import spacy
except ImportError as e:
    NLPTOOLS_AVAILABLE = False
    spacy = None
    logging.error(f"spaCy import failed: {e}")

logger = logging.getLogger(__name__)


class TaskCategory(str, Enum):
    """Predefined task categories"""
    BUG_FIX = "Bug Fix"
    FEATURE_DEVELOPMENT = "Feature Development"
    REFACTORING = "Refactoring"
    DOCUMENTATION = "Documentation"
    TESTING = "Testing & QA"
    DEPLOYMENT = "Deployment"
    INFRASTRUCTURE = "Infrastructure"
    PERFORMANCE = "Performance Optimization"
    SECURITY = "Security"
    MAINTENANCE = "Maintenance"
    CODE_REVIEW = "Code Review"
    RESEARCH = "Research & POC"
    CONFIGURATION = "Configuration"
    INTEGRATION = "Integration"
    UNKNOWN = "Unknown"


@dataclass
class TaskAnalysis:
    """
    Complete task analysis result representation.
    Holds the output of the task complexity analysis algorithm.
    """
    complexity_score: float  # 0.0 to 1.0
    category: TaskCategory
    category_confidence: float
    effort_hours_estimate: float  # Low-level estimate
    effort_confidence: float
    risk_level: str  # "LOW", "MEDIUM", "HIGH"
    blocking_factors: List[str]
    dependencies_detected: bool
    estimated_components: int  # Number of files/components affected
    required_expertise: List[str]  # Skills needed

    
    # Detailed breakdown
    complexity_factors: Dict[str, float]
    reasoning: str


class TaskComplexityAnalyzer:
    """
    Analyzes task complexity, category, and effort requirements
    Uses NLP to understand task semantics beyond simple keywords
    """

    def __init__(self):
        self._nlp_model = None  # Lazy load
        self._spacy_model = None  # Lazy load
        self._init_complexity_patterns()
        self._init_category_definitions()
        self._init_effort_mappings()
    
    @property
    def nlp_model(self):
        if self._nlp_model is None and NLPTOOLS_AVAILABLE:
            try:
                self._nlp_model = SentenceTransformer('all-MiniLM-L6-v2')
            except Exception as e:
                logger.warning(f"Transformer load failed: {e}")
        return self._nlp_model
    
    @property
    def spacy_model(self):
        if self._spacy_model is None and spacy is not None:
            try:
                self._spacy_model = spacy.load("en_core_web_sm")
            except Exception as e:
                logger.warning(f"spaCy load failed: {e}")
        return self._spacy_model


    def _init_complexity_patterns(self):
        """Initialize patterns for complexity detection"""
        
        self.complexity_indicators = {
            'trivial': {
                'keywords': [
                    'typo', 'spelling', 'comment', 'rename', 'delete', 'update label',
                    'fix link', 'change text', 'simple change', 'minor fix'
                ],
                'patterns': [
                    r'change\s+(text|label|name)\s+from\s+\w+\s+to\s+\w+',
                    r'fix\s+(typo|spelling)',
                    r'update\s+(comment|documentation)'
                ],
                'base_score': 0.1
            },
            'simple': {
                'keywords': [
                    'bug fix', 'hotfix', 'patch', 'validation', 'error handling',
                    'small component', 'basic ui', 'quick fix', 'single function',
                    'add logging', 'add test', 'configuration'
                ],
                'patterns': [
                    r'(add|implement)\s+(validation|error\s+handling)',
                    r'fix\s+\w+\s+bug',
                    r'(write|add)\s+(unit\s+)?test'
                ],
                'base_score': 0.3
            },
            'moderate': {
                'keywords': [
                    'new feature', 'implement feature', 'api endpoint', 'rest api',
                    'database migration', 'schema update', 'ui component', 'widget',
                    'integration', 'refactor', 'cleanup code'
                ],
                'patterns': [
                    r'(implement|add|create)\s+(new\s+)?feature',
                    r'(create|implement|add)\s+(api|endpoint)',
                    r'(integrate|connect)\s+\w+\s+(to|with)',
                    r'database\s+(migration|schema)'
                ],
                'base_score': 0.5
            },
            'complex': {
                'keywords': [
                    'full module', 'entire module', 'authentication', 'authorization',
                    'complex algorithm', 'multi-step', 'workflow', 'real-time',
                    'analytics', 'reporting system', 'admin panel', 'dashboard',
                    'microservices', 'distributed', 'caching'
                ],
                'patterns': [
                    r'(implement|build)\s+(authentication|authorization)',
                    r'(implement|create)\s+(multi-step|workflow)',
                    r'(build|create)\s+(dashboard|reporting)',
                    r'(implement|add)\s+(real-time|live\s+update)'
                ],
                'base_score': 0.7
            },
            'very_complex': {
                'keywords': [
                    'architecture', 'redesign', 'overhaul', 'rebuild', 'platform migration',
                    'migrate platform', 'full migration', 'legacy replacement',
                    'microservices', 'distributed system', 'multi-tenant', 'scalability',
                    'security audit', 'performance rewrite'
                ],
                'patterns': [
                    r'(architecture|redesign|overhaul)',
                    r'(full\s+)?(platform\s+)?migration',
                    r'(entire|full)\s+(system|platform)',
                    r'(security|performance)\s+(audit|overhaul)'
                ],
                'base_score': 0.9
            }
        }

    def _init_category_definitions(self):
        """Define task category patterns"""
        
        self.category_patterns = {
            TaskCategory.BUG_FIX: {
                'keywords': ['bug', 'fix', 'issue', 'problem', 'broken', 'crash', 'error', 'failing', 'regression'],
                'excludes': ['bug report', 'investigate']
            },
            TaskCategory.FEATURE_DEVELOPMENT: {
                'keywords': ['feature', 'new', 'implement', 'add', 'develop', 'create', 'build'],
                'excludes': []
            },
            TaskCategory.REFACTORING: {
                'keywords': ['refactor', 'cleanup', 'clean up', 'improve', 'optimize', 'restructure', 'rewrite'],
                'excludes': ['bug']
            },
            TaskCategory.DOCUMENTATION: {
                'keywords': ['document', 'documentation', 'comment', 'readme', 'wiki', 'write guide', 'api docs'],
                'excludes': []
            },
            TaskCategory.TESTING: {
                'keywords': ['test', 'qa', 'quality assurance', 'coverage', 'manual test', 'automation'],
                'excludes': []
            },
            TaskCategory.DEPLOYMENT: {
                'keywords': ['deploy', 'deployment', 'release', 'rollout', 'production', 'staging', 'publish'],
                'excludes': []
            },
            TaskCategory.INFRASTRUCTURE: {
                'keywords': ['infrastructure', 'devops', 'ci/cd', 'pipeline', 'kubernetes', 'docker', 'cloud', 'aws', 'azure'],
                'excludes': []
            },
            TaskCategory.PERFORMANCE: {
                'keywords': ['performance', 'optimize', 'speed', 'slow', 'faster', 'caching', 'latency', 'throughput'],
                'excludes': ['performance review']
            },
            TaskCategory.SECURITY: {
                'keywords': ['security', 'vulnerability', 'vulnerability fix', 'penetration', 'secure', 'encryption', 'authentication'],
                'excludes': []
            },
            TaskCategory.INTEGRATION: {
                'keywords': ['integration', 'integrate', 'connect', 'api', 'third-party', 'plugin', 'extension'],
                'excludes': []
            }
        }

    def _init_effort_mappings(self):
        """Map complexity and dependencies to effort estimates"""
        
        self.effort_base = {
            0.1: (0.25, 1),      # Trivial: 15 min to 1 hour
            0.3: (1, 4),          # Simple: 1-4 hours
            0.5: (4, 16),         # Moderate: 4-16 hours (1-2 days)
            0.7: (16, 40),        # Complex: 16-40 hours (2-5 days)
            0.9: (40, 120),       # Very complex: 40-120 hours (1-3 weeks)
        }

    def analyze_task(
        self,
        title: str,
        description: str = "",
        existing_tasks: Optional[List[Dict]] = None
    ) -> TaskAnalysis:
        """
        Comprehensively analyze a task
        
        Args:
            title: Task title
            description: Task description
            existing_tasks: Other tasks for dependency detection
            
        Returns:
            TaskAnalysis with full breakdown
        """
                
        combined_text = f"{title} {description}".lower()
        
        # 1. Detect complexity
        complexity_score, complexity_factors = self._calculate_complexity(combined_text)
        
        # 2. Categorize task
        category, category_confidence = self._categorize_task(combined_text)
        
        # 3. Estimate effort
        effort_hours = self._estimate_effort(complexity_score, description)
        effort_confidence = 0.7 if description else 0.4
        
        # 4. Detect risk factors
        risk_level, blocking_factors = self._detect_risks(combined_text, description)
        
        # 5. Estimate components affected
        components = self._estimate_components(title, description)
        
        # 6. Extract required expertise
        expertise = self._extract_expertise(combined_text)
        
        # 7. Detect dependencies
        has_dependencies = self._detect_dependencies(combined_text, existing_tasks)
        
        # 8. Generate reasoning
        reasoning = self._generate_reasoning(
            complexity_score, category, effort_hours,
            complexity_factors, risk_level
        )
        
        analysis = TaskAnalysis(
            complexity_score=round(complexity_score, 2),
            category=category,
            category_confidence=round(category_confidence, 2),
            effort_hours_estimate=round(effort_hours, 1),
            effort_confidence=round(effort_confidence, 2),
            risk_level=risk_level,
            blocking_factors=blocking_factors,
            dependencies_detected=has_dependencies,
            estimated_components=components,
            required_expertise=expertise,
            complexity_factors=complexity_factors,
            reasoning=reasoning
        )
        
        
        return analysis

    def _calculate_complexity(self, text: str) -> Tuple[float, Dict[str, float]]:
        """Calculate task complexity (0.0-1.0) with factor breakdown"""
        
        factors = {
            'keyword_score': 0.0,
            'semantic_score': 0.0,
            'linguistic_complexity': 0.0,
            'scope_indicators': 0.0,
            'dependency_indicators': 0.0
        }
        
        # 1. Keyword-based scoring
        keyword_scores = []
        for level, data in self.complexity_indicators.items():
            for keyword in data['keywords']:
                if keyword in text:
                    keyword_scores.append(data['base_score'])
            
            for pattern in data['patterns']:
                if re.search(pattern, text, re.IGNORECASE):
                    keyword_scores.append(data['base_score'])
        
        if keyword_scores:
            factors['keyword_score'] = max(keyword_scores)
        
        # 2. Semantic complexity (if model available)
        if self.nlp_model:
            try:
                factors['semantic_score'] = self._semantic_complexity_score(text)
            except Exception as e:
                logger.debug(f"Semantic scoring failed: {e}")
        
        # 3. Linguistic complexity (if spaCy available)
        if self.spacy_model:
            try:
                factors['linguistic_complexity'] = self._linguistic_complexity(text)
            except Exception as e:
                logger.debug(f"Linguistic analysis failed: {e}")
        
        # 4. Scope indicators
        factors['scope_indicators'] = self._detect_scope(text)
        
        # 5. Dependency indicators
        factors['dependency_indicators'] = self._detect_dependency_complexity(text)
        
        # Weighted average
        weights = {
            'keyword_score': 0.35,
            'semantic_score': 0.25,
            'linguistic_complexity': 0.15,
            'scope_indicators': 0.15,
            'dependency_indicators': 0.10
        }
        
        final_score = sum(factors[k] * weights[k] for k in weights.keys())
        final_score = min(final_score, 1.0)  # Cap at 1.0
        
        return final_score, factors

    def _semantic_complexity_score(self, text: str) -> float:
        """Calculate semantic complexity using embeddings"""
        
        # Complexity reference phrases
        complex_phrases = [
            "complex algorithm",
            "distributed system",
            "real-time processing",
            "machine learning",
            "advanced architecture",
            "microservices",
            "concurrent processing"
        ]
        
        simple_phrases = [
            "simple fix",
            "small change",
            "update label",
            "add comment",
            "minor adjustment"
        ]
        
        try:
            text_embedding = self.nlp_model.encode(text, convert_to_tensor=True)
            
            complex_embeddings = self.nlp_model.encode(complex_phrases, convert_to_tensor=True)
            simple_embeddings = self.nlp_model.encode(simple_phrases, convert_to_tensor=True)
            
            complex_sim = float(util.pytorch_cos_sim(text_embedding, complex_embeddings).max())
            simple_sim = float(util.pytorch_cos_sim(text_embedding, simple_embeddings).max())
            
            # Score increases with complex similarity, decreases with simple similarity
            score = (complex_sim - simple_sim) / 2.0
            return max(0.0, min(score, 1.0))
        except:
            return 0.0

    def _linguistic_complexity(self, text: str) -> float:
        """Analyze linguistic complexity (sentence length, vocabulary, etc.)"""
        
        try:
            doc = self.spacy_model(text)
            
            # Sentence length (longer = more complex)
            sentences = list(doc.sents)
            if not sentences:
                return 0.0
            
            avg_sentence_len = len(text.split()) / len(sentences)
            sentence_complexity = min(avg_sentence_len / 30, 1.0)  # Normalized
            
            # Dependency depth (complex sentences have deeper trees)
            max_depth = max(
                (len(list(token.ancestors)) for token in doc),
                default=0
            )
            depth_complexity = min(max_depth / 10, 1.0)
            
            # Entity complexity (technical entities = complex)
            entities = [ent for ent in doc.ents if ent.label_ in ['PRODUCT', 'WORK_OF_ART']]
            entity_complexity = min(len(entities) / 5, 1.0)
            
            return (sentence_complexity * 0.4 + depth_complexity * 0.4 + entity_complexity * 0.2)
        except:
            return 0.0

    def _detect_scope(self, text: str) -> float:
        """Detect scope indicators (full module vs single file)"""
        
        full_scope = [
            'entire', 'full', 'complete', 'all', 'system', 'platform',
            'end-to-end', 'complete overhaul', 'comprehensive'
        ]
        
        partial_scope = [
            'single', 'one', 'specific', 'particular', 'one component',
            'function', 'method', 'file'
        ]
        
        full_score = sum(1 for term in full_scope if term in text) * 0.2
        partial_score = sum(1 for term in partial_scope if term in text) * 0.1
        
        return min(full_score - partial_score, 1.0)

    def _detect_dependency_complexity(self, text: str) -> float:
        """Detect if task has dependencies on other tasks/systems"""
        
        dependency_indicators = [
            'after', 'depends on', 'requires', 'needs', 'blocked by',
            'integration', 'connected to', 'communicates with', 'calls',
            'data from', 'sync with', 'multi-system'
        ]
        
        matches = sum(1 for indicator in dependency_indicators if indicator in text)
        return min(matches * 0.15, 1.0)

    def _categorize_task(self, text: str) -> Tuple[TaskCategory, float]:
        """Categorize task into predefined categories"""
        
        scores = {}
        
        for category, patterns in self.category_patterns.items():
            score = 0.0
            
            # Check keywords
            for keyword in patterns['keywords']:
                if keyword in text:
                    score += 1.0
            
            # Penalize if exclusion keywords present
            for exclude in patterns['excludes']:
                if exclude in text:
                    score -= 0.5
            
            scores[category] = max(score, 0.0)
        
        if not scores or max(scores.values()) == 0:
            return TaskCategory.UNKNOWN, 0.3
        
        best_category = max(scores, key=scores.get)
        confidence = scores[best_category] / (max(scores.values()) + 1)
        
        return best_category, min(confidence, 1.0)

    def _estimate_effort(self, complexity: float, description: str) -> float:
        """Estimate effort in hours based on complexity"""
        
        # Find closest base score
        bases = [0.1, 0.3, 0.5, 0.7, 0.9]
        closest_base = min(bases, key=lambda x: abs(x - complexity))
        
        low, high = self.effort_base[closest_base]
        
        # Adjust based on description details
        detail_multiplier = 1.0
        if description:
            detail_level = len(description.split()) / 50  # More details = more clarity
            detail_multiplier = 0.9 + (detail_level * 0.2)  # 0.9 to 1.1
        
        estimated = (low + high) / 2 * detail_multiplier
        return estimated

    def _detect_risks(self, title_text: str, description: str) -> Tuple[str, List[str]]:
        """Detect risk factors and blocking issues"""
        
        factors = []
        risk_score = 0.0
        
        # High-risk indicators
        high_risk = [
            'security', 'data loss', 'critical', 'production', 'database migration',
            'breaking change', 'authentication', 'payment', 'compliance'
        ]
        
        medium_risk = [
            'integration', 'api change', 'performance', 'scalability',
            'third-party', 'external'
        ]
        
        for term in high_risk:
            if term in title_text:
                factors.append(f"⚠️ {term.title()}")
                risk_score += 0.3
        
        for term in medium_risk:
            if term in title_text:
                factors.append(f"⚠️ {term.title()}")
                risk_score += 0.15
        
        # Unclear requirements
        if description and len(description) < 20:
            factors.append("⚠️ Unclear Requirements")
            risk_score += 0.2
        
        if risk_score >= 0.6:
            level = "HIGH"
        elif risk_score >= 0.3:
            level = "MEDIUM"
        else:
            level = "LOW"
        
        return level, factors

    def _estimate_components(self, title: str, description: str) -> int:
        """Estimate number of components/files affected"""
        
        text = f"{title} {description}".lower()
        
        component_keywords = {
            'api': 2,
            'database': 3,
            'ui': 2,
            'controller': 1,
            'service': 1,
            'model': 1,
            'test': 1,
            'config': 1,
            'docker': 1,
            'migration': 2
        }
        
        components = 1  # Minimum
        for keyword, count in component_keywords.items():
            if keyword in text:
                components += count
        
        # Estimate based on keywords like "multiple", "several"
        if any(word in text for word in ['multiple', 'several', 'many', 'entire']):
            components = max(components, 5)
        
        return min(components, 10)  # Cap at 10

    def _extract_expertise(self, text: str) -> List[str]:
        """Extract required expertise areas"""
        
        expertise_map = {
            'python': 'Python',
            'java': 'Java',
            'react': 'React',
            'vue': 'Vue.js',
            'angular': 'Angular',
            'api': 'API Design',
            'database': 'Database Design',
            'devops': 'DevOps',
            'cloud': 'Cloud Architecture',
            'machine learning': 'Machine Learning',
            'security': 'Security',
            'testing': 'QA/Testing'
        }
        
        required = []
        for keyword, skill in expertise_map.items():
            if keyword in text and skill not in required:
                required.append(skill)
        
        return required[:5]  # Top 5

    def _detect_dependencies(self, text: str, existing_tasks: Optional[List] = None) -> bool:
        """Detect if task has dependencies on other tasks"""
        
        dependency_keywords = [
            'after', 'once', 'depends on', 'requires', 'blocked by',
            'following', 'completion of', 'in parallel with'
        ]
        
        has_dep_keyword = any(keyword in text.lower() for keyword in dependency_keywords)
        
        return has_dep_keyword

    def _generate_reasoning(
        self,
        complexity: float,
        category: TaskCategory,
        effort: float,
        factors: Dict,
        risk_level: str
    ) -> str:
        """Generate human-readable reasoning for the analysis"""
        
        parts = []
        
        # Complexity explanation
        if complexity < 0.2:
            parts.append("Trivial task with minimal scope")
        elif complexity < 0.4:
            parts.append("Small task affecting limited scope")
        elif complexity < 0.6:
            parts.append("Moderate task with standard scope")
        elif complexity < 0.8:
            parts.append("Complex task with significant scope")
        else:
            parts.append("Highly complex task requiring extensive effort")
        
        # Category note
        parts.append(f"Categorized as {category.value}")
        
        # Effort note
        if effort < 2:
            parts.append(f"Quick task (~{effort:.1f}h)")
        elif effort < 8:
            parts.append(f"Single day task (~{effort:.1f}h)")
        elif effort < 40:
            parts.append(f"Multi-day task (~{effort:.1f}h / {effort/8:.1f} days)")
        else:
            parts.append(f"Extended task (~{effort:.1f}h / {effort/40:.1f} weeks)")
        
        # Risk note
        if risk_level == "HIGH":
            parts.append("⚠️ High risk - requires careful planning")
        elif risk_level == "MEDIUM":
            parts.append("Moderate risk - some coordination needed")
        
        return ". ".join(parts)

    def batch_analyze(self, tasks: List[Dict]) -> List[TaskAnalysis]:
        """Analyze multiple tasks efficiently"""
        
        results = []
        
        for task in tasks:
            try:
                analysis = self.analyze_task(
                    task.get('title', ''),
                    task.get('description', '')
                )
                results.append(analysis)
            except Exception as e:
                logger.error(f"Error analyzing task: {e}")
        
        return results