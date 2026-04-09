#app/models/assignment_model.py
"""
models/assignment_model.py - Multi-Factor Task Assignment Scoring and Genetic Optimization.

This module implements the core AI logic for matching employees to tasks.
The TaskAssignmentModel calculates a weighted fit score from five components:
skill match (40%), workload capacity (25%), experience alignment (15%),
adaptability bonus (10%), and priority alignment (10%). A Genetic Algorithm
(GA) is also provided for optimizing bulk multi-task assignment problems.
"""

import numpy as np
import logging
from typing import List, Dict, Tuple
from app.core.config import settings
from dataclasses import dataclass
import random

logger = logging.getLogger(__name__)

@dataclass
class Individual:
    """
    Represents a single candidate solution (chromosome) in the Genetic Algorithm.
    Each gene in the list is the ID of the employee assigned to the corresponding task.

    Attributes:
        genes (List[str]): Employee IDs, one per task, representing the assignment plan.
        fitness (float): Evaluated quality score of this assignment configuration.
    """
    genes: List[str]  # List of employee IDs (one per task)
    fitness: float = 0.0


class TaskAssignmentModel:
    """
    Multi-factor scoring model for assigning employees to tasks.

    Computes a composite fit score for each (task, employee) pair and generates
    human-readable reasoning for each recommendation. The scoring uses configurable
    experience thresholds and skill coverage minimums defined in application settings.
    """
    
    def __init__(self, company_id: str):
        self.company_id = company_id
        # Learning factors for handling edge cases
        self.min_skill_coverage_for_training = settings.MIN_SKILL_COVERAGE         # 0.6
        self.junior_experience_threshold = settings.JUNIOR_EXPERIENCE_YEARS        # 3
        self.senior_experience_threshold = settings.SENIOR_EXPERIENCE_YEARS        # 10
    
    def calculate_fit_score(
    self,
    task: Dict,
    employee: Dict
) -> Tuple[float, float, Dict]:
        """
        Calculates a comprehensive fit score for an employee-task pairing.
        Combines five sub-scores using a fixed weighting scheme.

        Args:
            task (Dict): Task data including required_skills, priority, and complexity_score.
            employee (Dict): Employee data including skills, workload_percentage, and years_experience.

        Returns:
            Tuple[float, float, Dict]: A tuple of (fit_score, confidence_score, components_dict)
            where components_dict contains the individual sub-scores and their detail objects.
        """
        
        try:
            # Extract data with proper defaults
            task_skills = task.get('required_skills', [])
            emp_skills = employee.get('skills', {})  # {skill_id: proficiency}
            priority = task.get('priority', 'MEDIUM')
            complexity = task.get('complexity_score', 0.5)
            workload_pct = employee.get('workload_percentage', 0)
            experience_years = employee.get('years_experience', 0)
            max_hours = employee.get('max_weekly_hours', 40)
            active_tasks = employee.get('active_tasks', 0)
            emp_name = employee.get('first_name', 'Unknown')
            
            # Skill Match (40% weight)
            skill_score, skill_details = self._calculate_skill_match_fixed(
                task_skills, 
                emp_skills,
                complexity
            )
            
            # Workload Capacity (25% weight)
            workload_score, workload_details = self._calculate_workload_score_fixed(
                workload_pct,
                max_hours,
                active_tasks,
                experience_years,
                complexity,
                priority
            )
            
            # Experience Match (15% weight)
            experience_score, exp_details = self._calculate_experience_match_fixed(
                complexity,
                experience_years,
                emp_skills
            )
            
            # Adaptability Bonus (10% weight)
            adaptability_score, adapt_details = self._calculate_adaptability_score(
                emp_skills,
                task_skills,
                experience_years
            )
            
            # Priority/Urgency Alignment (10% weight)
            priority_score = self._calculate_priority_alignment(
                priority,
                experience_years,
                complexity
            )
            
            # Weighted combination
            fit_score = (
                skill_score * 0.40 +
                workload_score * 0.25 +
                experience_score * 0.15 +
                adaptability_score * 0.10 +
                priority_score * 0.10
            )
            
            # Calculate confidence based on ALL factors
            confidence = self._calculate_confidence_fixed(
                skill_score,
                workload_score,
                experience_score,
                skill_details,
                workload_details,
                fit_score
            )
            
            # Store all component scores for accurate reasoning
            components = {
                'skill_score': skill_score,
                'workload_score': workload_score,
                'experience_score': experience_score,
                'adaptability_score': adaptability_score,
                'priority_score': priority_score,
                'skill_details': skill_details,
                'workload_details': workload_details,
                'exp_details': exp_details
            }
            # Log decision components for accuracy tracking
            if fit_score > 0.3:
                logger.debug(
                    f"{emp_name}: skill={skill_score:.2f}, "
                    f"workload={workload_score:.2f}, exp={experience_score:.2f}, "
                    f"adapt={adaptability_score:.2f}, priority={priority_score:.2f} "
                    f"→ fit={fit_score:.2f}, conf={confidence:.2f}"
                )
            
            return (round(fit_score, 4), round(confidence, 4), components)
            
        except Exception:
            return (0.0, 0.0, {})
    
    def _calculate_skill_match_fixed(
    self,
    task_skills: List[str],  # These are NAMES like ["Java", "Spring Boot"]
    emp_skills: Dict[str, int],  # These are {name: proficiency}
    task_complexity: float
) -> Tuple[float, Dict]:
        """
        Computes a skill match score using fuzzy name matching via the SkillMatcher utility.
        Returns a score in [0, 1] where 1.0 means all required skills are matched with
        high proficiency, and a details dict summarizing coverage and match reasons.

        Args:
            task_skills (List[str]): Required skill names from the task definition.
            emp_skills (Dict[str, int]): Employee's skills mapped to proficiency (1-5).
            task_complexity (float): Task difficulty score (0.0 to 1.0).

        Returns:
            Tuple[float, Dict]: (skill_score, details_dict).
        """
        
        # Import the skill matcher
        from app.core.skill_matcher import skill_matcher
        
        if not task_skills or len(task_skills) == 0:
            return (0.70, {'reason': 'no_skills_required', 'coverage': 1.0})
        
        if not emp_skills or len(emp_skills) == 0:
            return (0.15, {
                'reason': 'no_skills_recorded',
                'coverage': 0.0,
                'matched_count': 0,
                'total_required': len(task_skills)
            })
        
        # Use the SkillMatcher for fuzzy matching
        match_result = skill_matcher.match_skill_sets(
            required_skills=task_skills,  # ["Java", "Spring Boot"]
            employee_skills=emp_skills     # {"Java": 5, "Springboot": 4, "Leadership": 3}
        )

        coverage = match_result['coverage']
        avg_proficiency = match_result['avg_proficiency']


        # Log detailed matches
        for skill, detail in match_result['details'].items():
            if detail['matched']:
                logger.info(f" '{skill}' → '{detail['employee_skill']}' "
                        f"(conf: {detail['confidence']:.0%}, prof: {detail['proficiency']}/5)")
            else:
                logger.info(f" '{skill}' NOT matched")

        # Calculate score based on coverage
        reason = "unmatched"
        if coverage >= 1.0:
            skill_score = 0.9 + (avg_proficiency / 5.0 * 0.1)
            reason = "perfect_match"
        elif coverage >= 0.8:
            skill_score = 0.7 + (coverage * 0.1) + (avg_proficiency / 5.0 * 0.1)
            reason = "nearly_qualified"
        elif coverage >= 0.6:
            skill_score = 0.5 + (coverage * 0.1) + (avg_proficiency / 5.0 * 0.1)
            reason = "trainable_with_support"
        elif coverage >= 0.4:
            skill_score = 0.3 + (coverage * 0.1)
            reason = "needs_mentorship"
        else:
            skill_score = 0.15 + (coverage * 0.1)
            reason = "unqualified"

        details = {
            'coverage': coverage,
            'matched_count': len(match_result['matched']),
            'total_required': len(task_skills),
            'avg_proficiency': avg_proficiency,
            'reason': reason,
            'matches': match_result['details']
        }

        return (min(skill_score, 1.0), details)
    
    def _calculate_workload_score_fixed(
        self,
        workload_pct: float,
        max_hours: float,
        active_tasks: int,
        experience_years: float,
        task_complexity: float,
        priority: str
    ) -> Tuple[float, Dict]:
        """
        Workload calculation using ACTUAL data, not hardcoded
        
        Considers:
        - Current workload %
        - Experience level (seniors handle more)
        - Task complexity (complex tasks need more focus)
        - Priority (critical needs fresh person)
        """
        
        # Validate workload_pct
        if workload_pct is None or workload_pct < 0:
            workload_pct = 0
        elif workload_pct != workload_pct:  # NaN check
            workload_pct = 0
        
        workload_pct = min(workload_pct, 200)  # Cap at 200% (override)
        
        # Determine experience level
        if experience_years >= self.senior_experience_threshold:
            exp_level = "senior"
            base_capacity = 0.95  # Seniors handle high workload better
            ideal_workload = 85  # Can go to 85%
        elif experience_years >= self.junior_experience_threshold:
            exp_level = "mid"
            base_capacity = 0.85
            ideal_workload = 75
        else:
            exp_level = "junior"
            base_capacity = 0.70  # Juniors need slack
            ideal_workload = 60
        
        # Workload availability score
        if workload_pct <= ideal_workload * 0.5:  # Under 50% of ideal
            availability_score = 1.0  # Fully available
        elif workload_pct <= ideal_workload:  # Optimal range
            availability_score = 0.95 - (workload_pct - ideal_workload * 0.5) / (ideal_workload * 0.5) * 0.15
        elif workload_pct <= 100:  # Over-capacity but manageable
            availability_score = 0.7 - ((workload_pct - ideal_workload) / (100 - ideal_workload)) * 0.3
        else:  # Severely overloaded (>100%)
            availability_score = max(0.1, 0.4 - (workload_pct - 100) / 100 * 0.3)
        
        # Complexity modifier (complex tasks need focus)
        if task_complexity > 0.7 and workload_pct > 80:
            complexity_penalty = 0.85  # Reduce score for complex tasks under load
        else:
            complexity_penalty = 1.0
        
        # Priority modifier (critical tasks need fresh people)
        if priority == 'CRITICAL':
            if workload_pct > 70:
                priority_penalty = 0.9  # Not ideal
            elif workload_pct > 85:
                priority_penalty = 0.7  # Bad choice
            else:
                priority_penalty = 1.0
        else:
            priority_penalty = 1.0
        
        # Active tasks context switch penalty
        if active_tasks > 5:
            context_switch_penalty = max(0.5, 1.0 - (active_tasks - 5) * 0.05)
        else:
            context_switch_penalty = 1.0
        
        # Combined workload score
        workload_score = (
            availability_score * 
            complexity_penalty * 
            priority_penalty * 
            context_switch_penalty
        )
        
        details = {
            'workload_pct': round(workload_pct, 1),
            'experience_level': exp_level,
            'active_tasks': active_tasks,
            'availability_score': round(availability_score, 2),
            'complexity_penalty': round(complexity_penalty, 2),
            'priority_penalty': round(priority_penalty, 2),
            'context_switch_penalty': round(context_switch_penalty, 2)
        }
        
        return (min(workload_score, 1.0), details)
    
    def _calculate_experience_match_fixed(
        self,
        task_complexity: float,
        experience_years: float,
        emp_skills: Dict[str, int]
    ) -> Tuple[float, Dict]:
        """
        Maps the gap between an employee's normalized experience and the task complexity
        to a suitability score. Employees whose experience level closely matches the
        task difficulty receive the highest scores.

        Args:
            task_complexity (float): Normalized task difficulty (0.0 to 1.0).
            experience_years (float): Years of professional experience.
            emp_skills (Dict[str, int]): Employee skill proficiency map.

        Returns:
            Tuple[float, Dict]: (experience_score, details_dict).
        """
        
        # Experience years should NOT be 0 or hardcoded!
        if experience_years is None or experience_years < 0:
            experience_years = 0
        
        # Normalize experience (cap at 20 years for calculation)
        normalized_exp = min(experience_years / 20.0, 1.0)
        
        # Calculate average skill proficiency (NOT HARDCODED!)
        if emp_skills:
            avg_skill_level = np.mean(list(emp_skills.values())) / 5.0
        else:
            avg_skill_level = normalized_exp * 0.5  # Assume some growth
        
        # Perfect match when experience ≈ complexity
        diff = abs(task_complexity - normalized_exp)
        
        if diff < 0.2:
            # Perfect match
            experience_score = 0.95
            reason = "perfect_experience_match"
        elif diff < 0.4:
            # Good match
            experience_score = 0.80
            reason = "good_experience_match"
        elif diff < 0.6:
            # Acceptable (either learning opportunity or slight over-qualified)
            experience_score = 0.65
            reason = "acceptable_match"
        elif diff < 0.8:
            # Stretch (risky)
            if normalized_exp > task_complexity:
                # Over-qualified (might be bored)
                experience_score = 0.55
                reason = "overqualified"
            else:
                # Under-qualified (needs support)
                experience_score = 0.50
                reason = "underqualified_needs_support"
        else:
            # Poor match
            experience_score = 0.30
            reason = "poor_experience_match"
        
        # Boost if high average skill proficiency
        if avg_skill_level > 0.8:
            experience_score = min(1.0, experience_score + 0.1)
        
        details = {
            'experience_years': round(experience_years, 1),
            'normalized_exp': round(normalized_exp, 2),
            'avg_skill_level': round(avg_skill_level, 2),
            'task_complexity': round(task_complexity, 2),
            'experience_complexity_diff': round(diff, 2),
            'reason': reason
        }
        
        return (min(experience_score, 1.0), details)
    
    def _calculate_adaptability_score(
        self,
        emp_skills: Dict[str, int],
        task_skills: List[str],
        experience_years: float
    ) -> Tuple[float, Dict]:
        """
        Awards bonus points for learning potential and skill breadth.
        Employees with diverse skill portfolios and more years of experience
        are considered more adaptable to new or partially-matching assignments.

        Args:
            emp_skills (Dict[str, int]): The employee's current skill map.
            task_skills (List[str]): Required skills for the task.
            experience_years (float): Years of professional experience.

        Returns:
            Tuple[float, Dict]: (adaptability_score capped at 0.3, details_dict).
        """
        
        skill_diversity = len(emp_skills)
        
        # Bonus if learning new skill (has related skills but not exact match)
        learning_opportunity = 0
        if task_skills and emp_skills:
            unmatched_task_skills = set(task_skills) - set(emp_skills.keys())
            if unmatched_task_skills:
                # They'd be learning something new
                # Bonus if they have general foundation
                if skill_diversity >= 3:
                    learning_opportunity = 0.1  # 10% bonus for learning
        
        # Skill diversity bonus (people with many skills adapt faster)
        if skill_diversity >= 8:
            diversity_bonus = 0.15
        elif skill_diversity >= 5:
            diversity_bonus = 0.10
        elif skill_diversity >= 3:
            diversity_bonus = 0.05
        else:
            diversity_bonus = 0.0
        
        # Experience helps with adaptation
        if experience_years >= 8:
            experience_bonus = 0.08
        elif experience_years >= 5:
            experience_bonus = 0.05
        else:
            experience_bonus = 0.0
        
        adaptability_score = learning_opportunity + diversity_bonus + experience_bonus
        
        details = {
            'skill_diversity': skill_diversity,
            'learning_opportunity': learning_opportunity,
            'diversity_bonus': diversity_bonus,
            'experience_bonus': experience_bonus
        }
        
        return (min(adaptability_score, 0.3), details)  # Cap at 30%
    
    def _calculate_priority_alignment(
        self,
        priority: str,
        experience_years: float,
        complexity: float
    ) -> Tuple[float]:
        """
        Scores how well an employee's experience level aligns with the task's urgency.
        Critical tasks benefit from senior staff; low-priority tasks can serve as growth
        opportunities for junior employees.

        Args:
            priority (str): Task priority string (LOW, MEDIUM, HIGH, CRITICAL).
            experience_years (float): Employee years of experience.
            complexity (float): Task complexity score (not used directly but available).

        Returns:
            float: Alignment score between 0.0 and 1.0.
        """
        
        priority_map = {
            'LOW': 1,
            'MEDIUM': 2,
            'HIGH': 3,
            'CRITICAL': 4
        }
        
        priority_val = priority_map.get(priority, 2)
        exp_level = min(experience_years / 15.0, 1.0)
        
        # Alignment score
        if priority_val == 4:  # CRITICAL
            # Prefer experienced people
            if experience_years >= 8:
                return 0.95
            elif experience_years >= 5:
                return 0.75
            else:
                return 0.50
        
        elif priority_val == 3:  # HIGH
            # Prefer mid to senior
            if experience_years >= 5:
                return 0.90
            elif experience_years >= 3:
                return 0.75
            else:
                return 0.60
        
        elif priority_val == 2:  # MEDIUM
            # Neutral
            return 0.80
        
        else:  # LOW
            # Good for juniors to learn
            if experience_years < 3:
                return 0.90  # Bonus for developing juniors
            elif experience_years < 8:
                return 0.80
            else:
                return 0.60  # Over-qualified
    
    def _calculate_confidence_fixed(
        self,
        skill_score: float,
        workload_score: float,
        experience_score: float,
        skill_details: Dict,
        workload_details: Dict,
        final_fit: float
    ) -> float:
        """
        Derives a confidence value from the reliability of the three primary sub-scores.
        High skill coverage, good availability, and strong experience experience all
        contribute positively. A low overall fit score applies a global penalty.

        Args:
            skill_score (float): The computed skill match score.
            workload_score (float): The computed workload availability score.
            experience_score (float): The computed experience match score.
            skill_details (Dict): Detail dict from the skill match calculation.
            workload_details (Dict): Detail dict from the workload calculation.
            final_fit (float): The composite weighted fit score.

        Returns:
            float: Confidence score in [0.0, 1.0].
        """
        
        confidence = 0.5  # Base confidence
        
        # Skill score confidence
        if skill_details.get('reason') == 'perfect_match':
            confidence += 0.25
        elif skill_details.get('reason') in ['nearly_qualified', 'trainable_with_support']:
            confidence += 0.15
        elif skill_details.get('reason') == 'needs_mentorship':
            confidence += 0.05
        else:
            confidence += 0.0
        
        # Workload score confidence
        if workload_details.get('availability_score', 0) >= 0.9:
            confidence += 0.15  # Very available = high confidence
        elif workload_details.get('availability_score', 0) >= 0.7:
            confidence += 0.10
        else:
            confidence += 0.0
        
        # Experience score confidence
        if experience_score >= 0.8:
            confidence += 0.10
        elif experience_score >= 0.6:
            confidence += 0.05
        
        # Penalty for low fit overall
        if final_fit < 0.4:
            confidence *= 0.7
        
        return min(confidence, 1.0)
    
    def _generate_reasoning(
    self,
    task: Dict,
    employee: Dict,
    fit_score: float,
    components: Dict
) -> str:
        """
        Generates a concise human-readable explanation for an assignment recommendation.
        Uses the actual computed component scores rather than raw field values.

        Args:
            task (Dict): The task being assigned.
            employee (Dict): The candidate employee.
            fit_score (float): The final composite fit score.
            components (Dict): The component scores and their detail objects.

        Returns:
            str: A bullet-separated string summarizing the skill, workload, and experience rationale.
        """
        
        emp_name = f"{employee.get('first_name')} {employee.get('last_name')}"
        task_skills = task.get('required_skills', [])
        emp_skills = employee.get('skills', {})
        experience = employee.get('years_experience', 0)
        workload_pct = employee.get('workload_percentage', 0)
        
        reasons = []
        
        # Skill analysis (use actual calculated scores)
        skill_score = components.get('skill_score', 0.5)
        skill_details = components.get('skill_details', {})
        
        if task_skills:
            coverage = skill_details.get('coverage', 0)
            matched = skill_details.get('matched_count', 0)
            total = skill_details.get('total_required', len(task_skills))
            
            if coverage >= 1.0:
                reasons.append(f"Has all {total} required skills")
            elif coverage >= 0.8:
                reasons.append(f"Has {matched}/{total} required skills (80%+ match)")
            elif coverage >= 0.6:
                reasons.append(f"Has {matched}/{total} skills - trainable with support")
            else:
                reasons.append(f"Only {matched}/{total} skills ({coverage:.0%})")
        else:
            reasons.append("No specific skills required")
        
        # Workload analysis (use actual calculated scores)
        workload_score = components.get('workload_score', 0.5)
        workload_details = components.get('workload_details', {})
        
        if workload_pct > 100:
            reasons.append(f"Overloaded ({workload_pct:.0f}% busy)")
        elif workload_pct > 80:
            reasons.append(f"High workload ({workload_pct:.0f}% busy)")
        elif workload_pct < 50:
            reasons.append(f"Good availability ({workload_pct:.0f}% busy)")
        else:
            reasons.append(f"Optimal workload ({workload_pct:.0f}% busy)")
        
        # Experience analysis (use actual calculated scores)
        experience_score = components.get('experience_score', 0.5)
        
        if experience >= 10:
            reasons.append(f"Very experienced ({experience:.0f}y)")
        elif experience >= 5:
            reasons.append(f"Experienced ({experience:.0f}y)")
        elif experience >= 3:
            reasons.append(f"Developing ({experience:.0f}y)")
        else:
            reasons.append(f"Junior ({experience:.0f}y)")
        
        # Final assessment based on ACTUAL fit score
        if fit_score >= 0.8:
            reasons.append("→ Excellent match")
        elif fit_score >= 0.6:
            reasons.append("→ Good match")
        elif fit_score >= 0.4:
            reasons.append("→ Acceptable (needs support)")
        else:
            reasons.append("→ Poor match")
        
        return " • ".join(reasons)
    


    def genetic_algorithm_optimize(
        self,
        tasks: List[Dict],
        employees: List[Dict],
        pre_calculated: Dict[str, Dict[str, float]]
    ) -> List[Dict]:
        """
        Genetic Algorithm for optimal task-employee assignment
        
        Optimizes for:
        1. Maximum skill match (fit scores)
        2. Balanced workload distribution
        3. Priority task placement
        
        Algorithm:
        - Population: Different assignment combinations
        - Fitness: Weighted sum of fit scores + workload balance
        - Selection: Tournament selection
        - Crossover: Single-point crossover
        - Mutation: Random reassignment
        
        Args:
            tasks: List of task dictionaries
            employees: List of employee dictionaries
            pre_calculated: Pre-calculated fit scores {task_id: {emp_id: score}}
        
        Returns:
            List of optimized assignments
        """
        
        if not tasks or not employees:
            return []
                
        # GA Parameters
        POPULATION_SIZE = min(50, len(employees) ** min(len(tasks), 3))  # Adaptive
        GENERATIONS = 100
        TOURNAMENT_SIZE = 5
        CROSSOVER_RATE = 0.8
        MUTATION_RATE = 0.2
        ELITISM_COUNT = 2  # Keep best 2 solutions
        
        # Helper functions
        def create_individual() -> Individual:
            """Create random assignment (chromosome)"""
            genes = []
            available_employees = employees.copy()
            
            for task in tasks:
                # Weighted random selection (better fits more likely)
                weights = [
                    max(pre_calculated.get(task['id'], {}).get(emp['id'], 0), 0.01)
                    for emp in available_employees
                ]
                
                # Normalize weights
                total = sum(weights)
                if total > 0:
                    weights = [w / total for w in weights]
                else:
                    weights = [1.0 / len(available_employees)] * len(available_employees)
                
                # Select employee
                selected_emp = random.choices(available_employees, weights=weights)[0]
                genes.append(selected_emp['id'])
            
            return Individual(genes=genes)
        
        def calculate_fitness(individual: Individual) -> float:
            """
            Calculate fitness score for an assignment
            
            Fitness = 
                0.50 * Average Fit Score +
                0.30 * Workload Balance Score +
                0.20 * Priority Alignment Score
            """
            
            # 1. Average fit score (0-1)
            fit_scores = []
            for i, task in enumerate(tasks):
                emp_id = individual.genes[i]
                fit = pre_calculated.get(task['id'], {}).get(emp_id, 0)
                fit_scores.append(fit)
            
            avg_fit = np.mean(fit_scores) if fit_scores else 0
            
            # 2. Workload balance score (0-1)
            # Count tasks per employee
            employee_loads = {emp['id']: 0 for emp in employees}
            for emp_id in individual.genes:
                employee_loads[emp_id] += 1
            
            loads = list(employee_loads.values())
            if len(loads) > 1:
                # Lower standard deviation = better balance
                std_dev = np.std(loads)
                max_possible_std = np.std([len(tasks), 0] + [0] * (len(employees) - 2))
                
                if max_possible_std > 0:
                    balance_score = 1.0 - (std_dev / max_possible_std)
                else:
                    balance_score = 1.0
            else:
                balance_score = 0.5
            
            # 3. Priority alignment score (0-1)
            # High priority tasks should go to best fits
            priority_map = {'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1}
            priority_scores = []
            
            for i, task in enumerate(tasks):
                task_priority = priority_map.get(task.get('priority', 'MEDIUM'), 2)
                emp_id = individual.genes[i]
                fit = pre_calculated.get(task['id'], {}).get(emp_id, 0)
                
                # High priority tasks with high fit = good
                priority_alignment = (task_priority / 4.0) * fit
                priority_scores.append(priority_alignment)
            
            avg_priority_alignment = np.mean(priority_scores) if priority_scores else 0
            
            # Weighted combination
            fitness = (
                avg_fit * 0.50 +
                balance_score * 0.30 +
                avg_priority_alignment * 0.20
            )
            
            return fitness
        
        def tournament_selection(population: List[Individual]) -> Individual:
            """Select best individual from random tournament"""
            tournament = random.sample(population, min(TOURNAMENT_SIZE, len(population)))
            return max(tournament, key=lambda ind: ind.fitness)
        
        def crossover(parent1: Individual, parent2: Individual) -> Tuple[Individual, Individual]:
            """Single-point crossover"""
            if random.random() > CROSSOVER_RATE or len(parent1.genes) < 2:
                return Individual(genes=parent1.genes.copy()), Individual(genes=parent2.genes.copy())
            
            # Random crossover point
            point = random.randint(1, len(parent1.genes) - 1)
            
            child1_genes = parent1.genes[:point] + parent2.genes[point:]
            child2_genes = parent2.genes[:point] + parent1.genes[point:]
            
            return Individual(genes=child1_genes), Individual(genes=child2_genes)
        
        def mutate(individual: Individual) -> Individual:
            """Random mutation - reassign some tasks"""
            mutated_genes = individual.genes.copy()
            
            for i in range(len(mutated_genes)):
                if random.random() < MUTATION_RATE:
                    # Reassign to random employee
                    mutated_genes[i] = random.choice(employees)['id']
            
            return Individual(genes=mutated_genes)
        
        # Initialize population
        population = [create_individual() for _ in range(POPULATION_SIZE)]
        
        # Evaluate initial fitness
        for individual in population:
            individual.fitness = calculate_fitness(individual)
        
        best_fitness_history = []
        
        # Evolution loop
        for generation in range(GENERATIONS):
            # Sort by fitness
            population.sort(key=lambda ind: ind.fitness, reverse=True)
            
            # Track best fitness
            best_fitness = population[0].fitness
            best_fitness_history.append(best_fitness)
            
            # Early stopping if converged
            if generation > 20:
                recent_improvement = best_fitness_history[-1] - best_fitness_history[-20]
                if recent_improvement < 0.001:  # Less than 0.1% improvement in 20 generations
                    break
            
            if generation % 20 == 0:
                logger.info(f"Generation {generation}/{GENERATIONS}: Best fitness = {best_fitness:.3f}")
            
            # Create next generation
            next_generation = []
            
            # Elitism - keep best solutions
            next_generation.extend(population[:ELITISM_COUNT])
            
            # Generate offspring
            while len(next_generation) < POPULATION_SIZE:
                # Selection
                parent1 = tournament_selection(population)
                parent2 = tournament_selection(population)
                
                # Crossover
                child1, child2 = crossover(parent1, parent2)
                
                # Mutation
                child1 = mutate(child1)
                child2 = mutate(child2)
                
                # Evaluate
                child1.fitness = calculate_fitness(child1)
                child2.fitness = calculate_fitness(child2)
                
                next_generation.append(child1)
                if len(next_generation) < POPULATION_SIZE:
                    next_generation.append(child2)
            
            population = next_generation
        
        # Get best solution
        population.sort(key=lambda ind: ind.fitness, reverse=True)
        best_solution = population[0]
                
        # Convert best solution to assignments
        assignments = []
        for i, task in enumerate(tasks):
            emp_id = best_solution.genes[i]
            
            # Find employee
            emp = next((e for e in employees if e['id'] == emp_id), None)
            if not emp:
                continue
            
            fit_score = pre_calculated.get(task['id'], {}).get(emp_id, 0)
            
            assignments.append({
                'task_id': task['id'],
                'task_title': task['title'],
                'employee_id': emp_id,
                'employee_name': f"{emp['first_name']} {emp['last_name']}",
                'fit_score': round(fit_score, 3),
                'confidence_score': round(best_solution.fitness, 3),
                'reasoning': f'Genetic Algorithm optimization (fitness: {best_solution.fitness:.2f})'
            })
        
        return assignments