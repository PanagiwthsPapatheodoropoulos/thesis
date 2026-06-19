# ai_service/app/models/text_analyzer.py
"""
Intelligent Text Analysis for Task Duration Estimation
Uses NLP and pattern matching to understand task complexity across all domains
"""

import re
import logging
from typing import Dict, Tuple, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Try to import sentence transformers for advanced NLP
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    from sklearn.metrics.pairwise import cosine_similarity
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    logger.warning("sentence-transformers not available, using fallback text analysis")


@dataclass
class TaskComplexityAnalysis:
    """
    Results of text-based complexity analysis.
    Stores estimated hours bounds and derived complexity classification.
    """
    complexity_score: float  # 0.0 to 1.0
    estimated_hours: float
    estimated_hours_lower: float
    estimated_hours_upper: float
    category: str  # trivial, small, medium, large, very_large
    confidence: float  # 0.0 to 1.0
    reasoning: str
    detected_keywords: List[str]


class SmartTextAnalyzer:
    """
    Domain-agnostic text analyzer for task complexity estimation.
    Works for any business domain: CS, finance, marketing, HR, etc.
    """
    
    def __init__(self):
        self.nlp_model = None
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                # Lightweight multilingual model for semantic similarity
                # all-MiniLM-L6-v2 is fast and effective
                self.nlp_model = SentenceTransformer('all-MiniLM-L6-v2')
            except Exception as e:
                logger.warning(f"Could not load NLP model: {e}")
        
        # Domain-agnostic patterns for task complexity
        self._init_patterns()
    
    def _init_patterns(self):
        """Initialize keyword patterns for all domains"""
        
        # TRIVIAL: Very simple, quick tasks (0.25-2 hours)
        self.trivial_patterns = [
            r'\b(hello\s*world|hello world)\b',
            r'\b(typo|spelling|grammar)\b',
            r'\b(readme|documentation\s*update|update\s*docs?)\b',
            r'\b(simple\s*change|minor\s*fix|small\s*fix|quick\s*fix)\b',
            r'\b(rename|delete\s*file|add\s*comment)\b',
            r'\b(copy|paste|duplicate)\b',
            r'\b(fix\s*link|update\s*email|change\s*text)\b',
        ]
        
        # SMALL: Quick tasks requiring some thought (1-8 hours)
        self.small_patterns = [
            r'\b(bug\s*fix|hotfix|patch)\b',
            r'\b(add\s*validation|input\s*check|error\s*handling)\b',
            r'\b(refactor\s*function|clean\s*code|improve\s*function)\b',
            r'\b(write\s*test|unit\s*test|add\s*tests?)\b',
            r'\b(update\s*config|configuration\s*change)\b',
            r'\b(simple\s*form|basic\s*ui|small\s*component)\b',
            r'\b(send\s*email|notification|alert)\b',
            r'\b(export\s*(?:csv|excel|pdf)|generate\s*report)\b',
        ]
        
        # MEDIUM: Standard features (6-24 hours)
        self.medium_patterns = [
            r'\b(new\s*feature|implement\s*feature|add\s*feature)\b',
            r'\b(api\s*endpoint|rest\s*api|graphql)\b',
            r'\b(database\s*migration|schema\s*update|table\s*creation)\b',
            r'\b(ui\s*component|frontend\s*component|widget)\b',
            r'\b(create\s*dashboard|build\s*dashboard)\b',
            r'\b(integration\s*with|connect\s*to|link\s*with)\b',
            r'\b(payment\s*integration|checkout\s*flow)\b',
            r'\b(user\s*profile|account\s*settings)\b',
            r'\b(search\s*functionality|filter|sort)\b',
            r'\b(crud\s*operations?|create\s*read\s*update\s*delete)\b',
        ]
        
        # LARGE: Complex features or modules (20-80 hours)
        self.large_patterns = [
            r'\b(full\s*module|entire\s*module|complete\s*module)\b',
            r'\b(authentication\s*system|auth\s*system|login\s*system)\b',
            r'\b(authorization|permissions?\s*system|rbac|role.based)\b',
            r'\b(complex\s*algorithm|advanced\s*logic)\b',
            r'\b(multi.step\s*process|workflow|pipeline)\b',
            r'\b(real.time|websocket|live\s*update)\b',
            r'\b(data\s*analytics?|reporting\s*system|metrics)\b',
            r'\b(admin\s*panel|management\s*system)\b',
            r'\b(integration\s*platform|api\s*gateway)\b',
        ]
        
        # VERY LARGE: System-level changes (60+ hours)
        self.very_large_patterns = [
            r'\b(architecture|redesign|overhaul|rebuild)\b',
            r'\b(platform\s*migration|migrate\s*platform|full\s*migration)\b',
            r'\b(microservices?|distributed\s*system)\b',
            r'\b(entire\s*(?:system|platform|application))\b',
            r'\b(multi.tenant|multi.company)\b',
            r'\b(performance\s*optimization|scalability)\b',
            r'\b(security\s*audit|penetration\s*test|compliance)\b',
            r'\b(legacy\s*system\s*replacement)\b',
        ]
        
        # Action verb complexity (affects multiplier)
        self.action_verbs = {
            'trivial': ['fix', 'update', 'change', 'modify', 'rename', 'delete', 'add'],
            'small': ['create', 'write', 'implement', 'build', 'make'],
            'medium': ['develop', 'design', 'integrate', 'extend'],
            'large': ['architect', 'redesign', 'refactor', 'migrate', 'overhaul']
        }
    
    def analyze(
        self,
        title: str,
        description: str = "",
        priority: str = "MEDIUM"
    ) -> TaskComplexityAnalysis:
        """
        Analyze task text and estimate complexity + duration
        
        Args:
            title: Task title
            description: Task description (optional)
            priority: Task priority (LOW, MEDIUM, HIGH, CRITICAL)
            
        Returns:
            TaskComplexityAnalysis with estimated hours and confidence
        """
                
        combined_text = f"{title} {description}".lower()
        
        # 1. Pattern-based classification
        category, base_hours, confidence = self._classify_by_patterns(combined_text, title)
        
        # 2. Text feature analysis
        text_features = self._extract_text_features(title, description)
        
        # 3. Adjust based on text features
        adjusted_hours = self._adjust_for_features(base_hours, text_features, priority)
        
        # 4. Calculate confidence interval
        variance_factor = 0.4 if confidence > 0.7 else 0.6  # Lower variance for high confidence
        lower = max(0.25, adjusted_hours * (1 - variance_factor))
        upper = adjusted_hours * (1 + variance_factor)
        
        # 5. Calculate complexity score (0-1)
        complexity_score = self._hours_to_complexity(adjusted_hours)
        
        # 6. Generate reasoning
        reasoning = self._generate_reasoning(category, text_features, priority)
        
        # 7. Detected keywords
        keywords = self._extract_keywords(combined_text)
        
        analysis = TaskComplexityAnalysis(
            complexity_score=round(complexity_score, 2),
            estimated_hours=round(adjusted_hours, 1),
            estimated_hours_lower=round(lower, 1),
            estimated_hours_upper=round(upper, 1),
            category=category,
            confidence=round(confidence, 2),
            reasoning=reasoning,
            detected_keywords=keywords
        )
        
        return analysis
    
    def _classify_by_patterns(self, text: str, title: str) -> Tuple[str, float, float]:
        """Classify task based on keyword patterns"""
        
        scores = {
            'very_large': 0.0,
            'large': 0.0,
            'medium': 0.0,
            'small': 0.0,
            'trivial': 0.0
        }
        
        # Check each pattern category
        for pattern in self.very_large_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                scores['very_large'] += 1.0
        
        for pattern in self.large_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                scores['large'] += 1.0
        
        for pattern in self.medium_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                scores['medium'] += 1.0
        
        for pattern in self.small_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                scores['small'] += 1.0
        
        for pattern in self.trivial_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                scores['trivial'] += 1.0
        
        # Title gets extra weight
        title_lower = title.lower()
        if any(re.search(p, title_lower, re.IGNORECASE) for p in self.trivial_patterns):
            scores['trivial'] += 2.0
        
        # Find best match
        best_category = max(scores, key=scores.get)
        best_score = scores[best_category]
        
        # If no patterns matched, default to medium
        if best_score == 0:
            return 'medium', 8.0, 0.3  # Low confidence
        
        # Map to base hours
        hour_ranges = {
            'trivial': (1.0, 0.8),      # 1 hour, high confidence
            'small': (4.0, 0.7),        # 4 hours
            'medium': (12.0, 0.6),      # 12 hours
            'large': (40.0, 0.7),       # 40 hours
            'very_large': (100.0, 0.8)  # 100 hours, high confidence
        }
        
        base_hours, confidence = hour_ranges[best_category]
        
        return best_category, base_hours, confidence
    
    def _extract_text_features(self, title: str, description: str) -> Dict:
        """Extract features from text"""
        
        return {
            'title_length': len(title),
            'description_length': len(description),
            'word_count': len((title + ' ' + description).split()),
            'has_details': len(description) > 50,  # Detailed description
            'is_vague': len(description) < 20,  # Vague task
            'has_numbers': bool(re.search(r'\d+', title + description)),  # Contains numbers
            'has_technical_terms': self._has_technical_terms(title + description),
            'question_marks': (title + description).count('?'),  # Indicates uncertainty
        }
    
    def _has_technical_terms(self, text: str) -> bool:
        """Check if text contains technical/domain-specific terms"""
        technical_keywords = [
            'api', 'database', 'server', 'client', 'frontend', 'backend',
            'algorithm', 'function', 'class', 'module', 'service', 'endpoint',
            'schema', 'query', 'authentication', 'authorization', 'security',
            'performance', 'optimization', 'integration', 'migration'
        ]
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in technical_keywords)
    
    def _adjust_for_features(self, base_hours: float, features: Dict, priority: str) -> float:
        """Adjust base estimate based on text features"""
        
        adjusted = base_hours
        
        # Vague tasks tend to take longer (poorly defined scope)
        if features['is_vague'] and base_hours > 2:
            adjusted *= 1.3  # +30% for vague specification
        
        # Detailed tasks might be well-planned (slightly shorter)
        if features['has_details'] and features['word_count'] > 100:
            adjusted *= 0.9  # -10% for detailed planning
        
        # Technical complexity
        if features['has_technical_terms']:
            adjusted *= 1.1  # +10% for technical work
        
        # Priority adjustment (urgent != complex, but might need buffer)
        if priority == 'CRITICAL' and base_hours < 10:
            # Critical small tasks might have hidden complexity
            adjusted *= 1.2
        
        return adjusted
    
    def _hours_to_complexity(self, hours: float) -> float:
        """Convert estimated hours to complexity score (0-1)"""
        # Logarithmic scale: 1h=0.1, 5h=0.3, 10h=0.4, 20h=0.5, 50h=0.7, 100h=0.9
        if hours <= 1:
            return 0.1
        elif hours <= 4:
            return 0.2
        elif hours <= 8:
            return 0.3
        elif hours <= 16:
            return 0.5
        elif hours <= 40:
            return 0.7
        elif hours <= 80:
            return 0.85
        else:
            return 0.95
    
    def _generate_reasoning(self, category: str, features: Dict, priority: str) -> str:
        """Generate human-readable reasoning"""
        
        reasons = []
        
        # Category reasoning
        category_reasons = {
            'trivial': "Task appears to be trivial (simple fix, minor change)",
            'small': "Task is small in scope (single function/component)",
            'medium': "Task is medium complexity (feature or integration)",
            'large': "Task is large (full module or complex system)",
            'very_large': "Task is very large (architecture-level change)"
        }
        reasons.append(category_reasons[category])
        
        # Feature-based reasoning
        if features['is_vague']:
            reasons.append("vague description may indicate unclear scope")
        if features['has_details']:
            reasons.append("detailed specification provided")
        if features['has_technical_terms']:
            reasons.append("technical complexity detected")
        
        if priority in ['HIGH', 'CRITICAL']:
            reasons.append(f"{priority.lower()} priority may require extra care")
        
        return "; ".join(reasons).capitalize()
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Extract important keywords from text"""
        keywords = []
        
        # Check all patterns
        all_patterns = (
            self.trivial_patterns +
            self.small_patterns +
            self.medium_patterns +
            self.large_patterns +
            self.very_large_patterns
        )
        
        for pattern in all_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            keywords.extend(matches[:2])  # Limit to 2 matches per pattern
        
        return list(set(keywords))[:10]  # Return up to 10 unique keywords
