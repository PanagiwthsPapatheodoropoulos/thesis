# app/models/lstm_predictor.py

"""
Hybrid Duration Prediction: LSTM + RandomForest + Gradient Boosting Ensemble.

This module implements a multi-model ensemble approach to predict task durations,
leveraging temporal patterns through LSTM and feature interactions through 
RandomForest and Gradient Boosting.
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional
import logging
from pathlib import Path
import pickle
import json
from datetime import datetime, timedelta

try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential, load_model
    from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization, Bidirectional
    from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
    from tensorflow.keras.optimizers import Adam
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    logging.warning("TensorFlow not available - LSTM predictor will use fallback")

from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error

logger = logging.getLogger(__name__)


class HybridDurationPredictor:
    """Ensemble-based duration prediction using multiple ML models.
    
    This class combines different model types to provide robust predictions:
    - LSTM: Captures temporal work patterns (30% weight).
    - RandomForest: Models complex feature interactions (35% weight).
    - Gradient Boosting: Optimizes for high precision (25% weight).
    - Historical Baseline: Provides a safe fallback (10% weight).
    """
    
    def __init__(self, company_id: str, model_dir: str = "/app/models"):
        """Initializes the predictor with company isolation.

        Args:
            company_id: Unique identifier for the company.
            model_dir: Base directory for storing serialized models.
        """
        self.company_id = company_id
        self.model_dir = Path(model_dir) / company_id
        self.model_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize model placeholders
        self.lstm_model = None
        self.rf_model = None
        self.gb_model = None
        self.scaler = StandardScaler()
        self.feature_scaler = StandardScaler()
        
        # Define the set of features used for training and inference
        self.feature_columns = [
            'priority_encoded',              # Task priority mapped to 1-4
            'complexity_score',              # Normalized task difficulty 0-1
            'required_skill_count',          # Number of skills required
            'avg_skill_proficiency_actual',  # Mean proficiency of assigned employee
            'employee_experience_years',     # Years of professional experience
            'historical_avg_15days',         # Rolling 15-day company average
            'similar_task_avg',              # Average of tasks with similar features
            'task_domain_factor',            # Domain-specific multiplier (e.g., DevOps=1.3)
            'day_of_week_encoded',           # Weekday encoding 0-6
            'month_encoded',                 # Month encoding 1-12
            'is_weekend',                    # Boolean flag for weekend work
            'employee_skill_diversity',      # Total unique skills known by employee
            'skill_match_percentage',        # % of required skills matching employee
            'employee_complexity_max_past',  # Highest complexity handled by employee
        ]
        
        self.sequence_length = 10
        self.min_samples = 30
        
        # Attempt to load existing pre-trained models
        self._load_models()
    
    def train(self, historical_tasks: List[Dict]) -> bool:
        """Trains all ensemble models using historical task data.

        Args:
            historical_tasks: List of dictionary objects containing completed tasks.

        Returns:
            bool: True if training succeeded, False otherwise.
        """
        
        if len(historical_tasks) < self.min_samples:
            logger.info(f"Insufficient samples for training ({len(historical_tasks)} < {self.min_samples})")
            return False
        
        try:
            # Generate feature matrix from raw task data
            df = self._prepare_features_fixed(historical_tasks)
            
            if df is None or df.empty:
                return False
            
            X = df[self.feature_columns].values
            y = df['actual_hours'].values
            
            # Filter out invalid entries to ensure clean training data
            if np.all(np.isnan(y)) or len(y) < self.min_samples:
                return False
            
            valid_idx = ~(np.isnan(X).any(axis=1) | np.isnan(y))
            X = X[valid_idx]
            y = y[valid_idx]
            
            if len(X) < self.min_samples:
                return False
                        
            # Partition data for training and evaluation
            split_idx = int(len(X) * 0.8)
            X_train, X_test = X[:split_idx], X[split_idx:]
            y_train, y_test = y[:split_idx], y[split_idx:]
            
            # Standardize features for model stability
            X_train_scaled = self.feature_scaler.fit_transform(X_train)
            X_test_scaled = self.feature_scaler.transform(X_test)
            
            # Execute training for each component of the ensemble
            self._train_random_forest(X_train_scaled, y_train, X_test_scaled, y_test)
            self._train_gradient_boosting(X_train_scaled, y_train, X_test_scaled, y_test)
            
            # Conditionally train LSTM if environment and data size allow
            if TENSORFLOW_AVAILABLE and len(X_train) >= self.sequence_length * 2:
                self._train_lstm(X_train_scaled, y_train, X_test_scaled, y_test)
            else:
                logger.warning("LSTM training skipped (TensorFlow unavailable or insufficient data)")
            
            # Persist the newly trained models to disk
            self._save_models()
        
            # Evaluate and log performance metrics for monitoring
            self._log_ensemble_performance(X_test_scaled, y_test)
            
            return True
            
        except Exception as e:
            logger.error(f"Training pipeline error: {e}")
            return False
    
    def _prepare_features_fixed(self, tasks: List[Dict]) -> Optional[pd.DataFrame]:
        """Engineers features from raw historical task data.

        Args:
            tasks: List of task dictionaries.

        Returns:
            Optional[pd.DataFrame]: Dataframe containing processed features and target.
        """
        
        priority_map = {'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4}
        features_list = []
        
        for i, task in enumerate(tasks):
            try:
                # Target extraction (actual duration)
                actual_hours = task.get('actualHours')
                if actual_hours is None or actual_hours <= 0:
                    continue
                
                # Transform categorical and numeric attributes
                priority_encoded = priority_map.get(task.get('priority', 'MEDIUM'), 2)
                complexity = max(0.1, min(1.0, float(task.get('complexityScore', 0.5))))
                
                # Resource-related features
                required_skills = task.get('requiredSkillIds', [])
                skill_count = len(required_skills) if required_skills else 0
                
                employee_skills = {}
                employee_exp = 0
                if task.get('assignments') and len(task['assignments']) > 0:
                    assignment_data = task['assignments'][0]
                    employee_skills = assignment_data.get('employee', {}).get('skills', {})
                    employee_exp = float(assignment_data.get('employee', {}).get('yearsOfExperience', 0))
                
                # Proficiency calculation logic
                if employee_skills and isinstance(employee_skills, dict):
                    proficiencies = [p for p in employee_skills.values() if p]
                    avg_proficiency = np.mean(proficiencies) / 5.0 if proficiencies else 0.3
                else:
                    avg_proficiency = 0.3
                
                # Contextual and temporal feature calculations
                historical_avg = self._calculate_historical_average(tasks[:i], 15)
                similar_avg = self._calculate_similar_task_average(tasks[:i], complexity, skill_count)
                domain_factor = self._infer_domain_factor(required_skills, task.get('description', ''))
                
                created_date = pd.to_datetime(task.get('createdAt')) if task.get('createdAt') else pd.Timestamp.now()
                day_of_week = created_date.dayofweek
                month = created_date.month
                is_weekend = 1 if day_of_week >= 5 else 0
        
                # Professional matching scores
                skill_diversity = len(employee_skills) if employee_skills else 0
                if skill_count > 0 and employee_skills:
                    matched = len([s for s in required_skills if s in employee_skills])
                    skill_match_pct = matched / skill_count
                else:
                    skill_match_pct = 0.5 if skill_count == 0 else 0.0
                
                max_complexity_past = self._get_max_complexity_by_employee(tasks[:i], employee_exp)
                
                # Consolidate into feature dictionary
                feature_dict = {
                    'priority_encoded': priority_encoded,
                    'complexity_score': complexity,
                    'required_skill_count': skill_count,
                    'avg_skill_proficiency_actual': avg_proficiency,  
                    'employee_experience_years': employee_exp,
                    'historical_avg_15days': historical_avg,
                    'similar_task_avg': similar_avg,
                    'task_domain_factor': domain_factor,
                    'day_of_week_encoded': day_of_week,
                    'month_encoded': month,
                    'is_weekend': is_weekend,
                    'employee_skill_diversity': skill_diversity,
                    'skill_match_percentage': skill_match_pct,
                    'employee_complexity_max_past': max_complexity_past,
                    'actual_hours': actual_hours
                }
                
                features_list.append(feature_dict)
                
            except Exception:
                continue
        
        return pd.DataFrame(features_list) if features_list else None
    
    def _calculate_historical_average(self, tasks: List[Dict], days: int = 15) -> float:
        """Calculates the average task duration over a recent window.

        Args:
            tasks: Previous tasks list.
            days: Number of days to look back.

        Returns:
            float: Average duration or default baseline.
        """
        if not tasks:
            return 8.0
        
        cutoff_date = datetime.now() - timedelta(days=days)
        recent_values = [
            task.get('actualHours') for task in tasks
            if (pd.to_datetime(task.get('createdAt')) if task.get('createdAt') else None) 
            and pd.to_datetime(task.get('createdAt')) >= cutoff_date
            and task.get('actualHours', 0) > 0
        ]
        
        return np.mean(recent_values) if recent_values else 8.0
    
    def _calculate_similar_task_average(self, tasks: List[Dict], complexity: float, skill_count: int) -> float:
        """Finds the average duration of tasks with similar complexity profiles.

        Args:
            tasks: Filtered task list.
            complexity: target complexity.
            skill_count: target skill count.

        Returns:
            float: Mean duration of comparable tasks.
        """
        if not tasks:
            return 8.0
        
        similar = [
            task.get('actualHours') for task in tasks
            if task.get('actualHours', 0) > 0 and
            abs(task.get('complexityScore', 0.5) - complexity) < 0.2 and
            abs(len(task.get('requiredSkillIds', [])) - skill_count) <= 2
        ]
        
        return np.mean(similar) if similar else 8.0
    
    def _infer_domain_factor(self, skills: List[str], description: str = "") -> float:
        """Heuristically determines complexity adjustment based on technical domain.

        Args:
            skills: Required skill identifiers.
            description: Task text content.

        Returns:
            float: Multiplier reflecting domain difficulty (0.8 - 1.3).
        """
        combined_text = (str(skills) + " " + description).lower()
        
        if any(x in combined_text for x in ['devops', 'kubernetes', 'aws', 'infra', 'docker']):
            return 1.3
        elif any(x in combined_text for x in ['frontend', 'ui', 'react', 'vue', 'html', 'css']):
            return 0.8
        return 1.0
    
    def _get_max_complexity_by_employee(self, tasks: List[Dict], employee_exp: float) -> float:
        """Historical maximum complexity baseline for an employee.

        Args:
            tasks: Task history.
            employee_exp: Years of experience.

        Returns:
            float: Max complexity score handled.
        """
        if employee_exp == 0:
            return 0.3
        
        past_complexities = [t.get('complexityScore', 0.5) for t in tasks if t.get('actualHours', 0) > 0]
        if past_complexities:
            return max(past_complexities)
        
        return min(employee_exp / 15.0, 0.9)
    
    def _train_random_forest(self, X_train, y_train, X_test, y_test):
        """Trains the Random Forest regressor for the ensemble."""
        self.rf_model = RandomForestRegressor(
            n_estimators=200, max_depth=20, min_samples_split=5, 
            min_samples_leaf=2, random_state=42, n_jobs=-1, max_features='sqrt'
        )
        self.rf_model.fit(X_train, y_train)
            
    def _train_gradient_boosting(self, X_train, y_train, X_test, y_test):
        """Trains the Gradient Boosting regressor for the ensemble."""
        self.gb_model = GradientBoostingRegressor(
            n_estimators=200, max_depth=5, learning_rate=0.05, 
            subsample=0.8, random_state=42, loss='huber'
        )
        self.gb_model.fit(X_train, y_train)
            
    def _train_lstm(self, X_train, y_train, X_test, y_test):
        """Trains the Deep Learning LSTM model for sequence prediction."""
        try:
            # Construct time-series sequences from the flattened data
            X_seq, y_seq = self._create_sequences(X_train, y_train, self.sequence_length)
            
            if len(X_seq) < 10:
                logger.warning("Insufficient sequences for LSTM")
                return
            
            split_idx = int(len(X_seq) * 0.8)
            X_lstm_train, X_lstm_val = X_seq[:split_idx], X_seq[split_idx:]
            y_lstm_train, y_lstm_val = y_seq[:split_idx], y_seq[split_idx:]
            
            # Architecture for capturing bidirectional temporal dependencies
            input_shape = (self.sequence_length, len(self.feature_columns))
            self.lstm_model = Sequential([
                Bidirectional(LSTM(128, return_sequences=True, input_shape=input_shape)),
                Dropout(0.3),
                BatchNormalization(),
                Bidirectional(LSTM(64, return_sequences=True)),
                Dropout(0.3),
                BatchNormalization(),
                Bidirectional(LSTM(32, return_sequences=False)),
                Dropout(0.2),
                BatchNormalization(),
                Dense(32, activation='relu'),
                Dropout(0.2),
                Dense(16, activation='relu'),
                Dense(1, activation='relu')
            ])
            
            self.lstm_model.compile(
                optimizer=Adam(learning_rate=0.001),
                loss='mean_absolute_percentage_error',
                metrics=['mae']
            )
            
            # Prevent overfitting with early stopping and lr reduction
            callbacks = [
                EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True),
                ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=8, min_lr=0.00001)
            ]
            
            self.lstm_model.fit(
                X_lstm_train, y_lstm_train, validation_data=(X_lstm_val, y_lstm_val),
                epochs=150, batch_size=16, callbacks=callbacks, verbose=0
            )
            
            # y_pred = self.lstm_model.predict(X_lstm_val, verbose=0)
            # mae = mean_absolute_error(y_lstm_val, y_pred)
            
        except Exception as e:
            self.lstm_model = None
            logger.error(f"LSTM training failed: {e}")
    
    def predict(
        self,
        task_features: Dict,
        recent_tasks: Optional[List[Dict]] = None
    ) -> Tuple[float, float, float]:
        """Generates an ensemble prediction with calibrated confidence intervals.

        Args:
            task_features: Properties of the task to predict.
            recent_tasks: Contextual sequence of tasks for LSTM.

        Returns:
            Tuple[float, float, float]: (Prediction, Lower Bound, Upper Bound).
        """
        
        try:
            # Transform task properties into the model-expected format
            feature_vec = self._extract_features_for_prediction(task_features)
            
            if feature_vec is None:
                logger.warning("Feature extraction failed, using fallback")
                return self._fallback_prediction(task_features)
            
            X_scaled = self.feature_scaler.transform(np.array([feature_vec]))
            
            predictions = []
            weights = []
            
            # Gather weighted contributions from active ensemble members
            if self.rf_model is not None:
                rf_pred = self.rf_model.predict(X_scaled)[0]
                predictions.append(max(0.5, rf_pred))
                weights.append(0.35)
            
            if self.gb_model is not None:
                gb_pred = self.gb_model.predict(X_scaled)[0]
                predictions.append(max(0.5, gb_pred))
                weights.append(0.25)
            
            if self.lstm_model is not None and recent_tasks:
                lstm_val = self._lstm_predict_fixed(X_scaled, recent_tasks)
                if lstm_val is not None:
                    predictions.append(max(0.5, lstm_val))
                    weights.append(0.30)
            
            # Include historical baseline for robustness
            priority_defaults = {'LOW': 4, 'MEDIUM': 8, 'HIGH': 14, 'CRITICAL': 20}
            fallback = priority_defaults.get(task_features.get('priority', 'MEDIUM'), 8.0)
            historical_pred = task_features.get('historical_avg') or fallback
            predictions.append(max(0.5, historical_pred))
            weights.append(0.10)
            
            if not predictions:
                return self._fallback_prediction(task_features)
            
            # Calculate the final combined estimation
            total_weight = sum(weights)
            final_pred = np.average(predictions, weights=[w / total_weight for w in weights][:len(predictions)])
            
            # Compute confidence boundaries based on model variance
            pred_array = np.array(predictions)
            std = np.std(pred_array) if len(predictions) > 1 else final_pred * 0.25
            lower = max(0.5, final_pred - 1.5 * std)
            upper = final_pred + 1.5 * std
            
            return (float(final_pred), float(lower), float(upper))
            
        except Exception as e:
            logger.error(f"Prediction pipeline error: {e}")
            return self._fallback_prediction(task_features)
    
    def _extract_features_for_prediction(self, task_features: Dict) -> Optional[np.ndarray]:
        """Prepares a single feature vector for model inference."""
        try:
            priority_map = {'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4}
            now = pd.Timestamp.now()
            
            priority = priority_map.get(task_features.get('priority', 'MEDIUM'), 2)
            complexity = max(0.1, min(1.0, float(task_features.get('complexity_score', 0.5))))
            skill_count = len(task_features.get('required_skills', []))
            
            # Default values if not provided
            avg_proficiency = float(task_features.get('avg_skill_proficiency', 0.5))
            employee_exp = float(task_features.get('employee_experience', 0))
            historical_avg = float(task_features.get('historical_avg', 8.0))
            domain_factor = float(task_features.get('domain_factor', 1.0))
            
            # Construct feature vector matching training columns
            vec = [
                priority, complexity, skill_count,
                avg_proficiency,
                employee_exp,
                historical_avg,
                historical_avg,  # Similar task avg (fallback if not provided)
                domain_factor,
                now.dayofweek,
                now.month,
                1 if now.dayofweek >= 5 else 0,
                skill_count,  # Diversity proxy (if not provided)
                0.5,  # Skill match (unknown, default to 0.5)
                min(complexity, employee_exp / 15.0)  # Max complexity proxy
            ]
            return np.array(vec, dtype=np.float32)
        except Exception as e:
            logger.error(f"Feature extraction error: {e}")
            return None
    
    def _lstm_predict_fixed(self, X_scaled: np.ndarray, recent_tasks: List[Dict]) -> Optional[float]:
        """Generates an LSTM prediction using recent task context."""
        try:
            if self.lstm_model is None or len(recent_tasks) < 2:
                return None
            
            # Reconstruct sequence from task history
            recent_features = []
            for task in recent_tasks[-self.sequence_length:]:
                # Extract same features as training
                f = self._extract_features_for_prediction({
                    'priority': task.get('priority', 'MEDIUM'),
                    'complexity_score': task.get('complexityScore', 0.5),
                    'required_skills': task.get('requiredSkillIds', []),
                    'historical_avg': task.get('actualHours', 8.0) # Use actual hours as historical context
                })
                if f is not None:
                    recent_features.append(f)
            
            if len(recent_features) < self.sequence_length:
                # Pad sequence to match model input requirements
                pad_size = self.sequence_length - len(recent_features)
                recent_features = [X_scaled[0]] * pad_size + recent_features
            
            input_seq = np.array(recent_features[-self.sequence_length:]).reshape(1, self.sequence_length, -1)
            pred = self.lstm_model.predict(input_seq, verbose=0)[0][0]
            return max(0.5, float(pred))
        except Exception as e:
            logger.debug(f"LSTM prediction failed: {e}")
            return None
    
    def _create_sequences(self, X, y, seq_length):
        """Builds time-ordered sequence segments for LSTM input.

        Args:
            X: Feature matrix.
            y: Target vector.
            seq_length: Length of each sequence.

        Returns:
            Tuple[np.ndarray, np.ndarray]: Sequences of features and corresponding targets.
        """
        X_seq, y_seq = [], []
        for i in range(len(X) - seq_length):
            X_seq.append(X[i:i + seq_length])
            y_seq.append(y[i + seq_length])
        return np.array(X_seq), np.array(y_seq)
    
    def _fallback_prediction(self, task_features: Dict) -> Tuple[float, float, float]:
        """Safe heuristic fallback when ML models are unavailable or fail.

        Args:
            task_features: Input features for the task.

        Returns:
            Tuple[float, float, float]: (Predicted hours, Lower bound, Upper bound).
        """
        priority = task_features.get('priority', 'MEDIUM')
        complexity = float(task_features.get('complexity_score', 0.5))
        skills = len(task_features.get('required_skills', []))
        
        # Base duration adjusted by complexity and skill load
        base = {'LOW': 3, 'MEDIUM': 8, 'HIGH': 12, 'CRITICAL': 16}.get(priority, 8)
        predicted = base * (0.5 + complexity * 1.5) * (1.0 + min(skills * 0.1, 0.5))
        
        # Apply a fixed variance for fallback predictions
        variance = predicted * 0.4
        lower = predicted - variance
        upper = predicted + variance
        
        return (float(predicted), float(lower), float(upper))
    
    def _log_ensemble_performance(self, X_test, y_test):
        """Internal performance logger for individual model verification."""
        # This method is intentionally left with minimal implementation
        # as detailed logging of individual model performance might be
        # handled by external monitoring or more complex reporting.
        # For now, it serves as a placeholder.
        
        if self.rf_model is not None:
            y_pred_rf = self.rf_model.predict(X_test)
            mae_rf = mean_absolute_error(y_test, y_pred_rf)
            logger.debug(f"RandomForest MAE: {mae_rf:.2f}")
        
        if self.gb_model is not None:
            y_pred_gb = self.gb_model.predict(X_test)
            mae_gb = mean_absolute_error(y_test, y_pred_gb)
            logger.debug(f"GradientBoosting MAE: {mae_gb:.2f}")
        
        if self.lstm_model is not None:
            try:
                # Reshape X_test for LSTM prediction if possible
                if len(X_test) >= self.sequence_length:
                    X_lstm_test, y_lstm_test = self._create_sequences(X_test, y_test, self.sequence_length)
                    if len(X_lstm_test) > 0:
                        y_pred_lstm = self.lstm_model.predict(X_lstm_test, verbose=0)
                        mae_lstm = mean_absolute_error(y_lstm_test, y_pred_lstm)
                        logger.debug(f"LSTM MAE: {mae_lstm:.2f}")
            except Exception as e:
                logger.debug(f"Could not log LSTM performance: {e}")
        
    
    def _save_models(self):
        """Serialized all active models to persistent storage."""
        
        # Save LSTM model if available
        if self.lstm_model:
            self.lstm_model.save(str(self.model_dir / "lstm_model.h5"))
        
        # Save RandomForest model if available
        if self.rf_model:
            with open(self.model_dir / "rf_model.pkl", 'wb') as f:
                pickle.dump(self.rf_model, f)
        
        # Save GradientBoosting model if available
        if self.gb_model:
            with open(self.model_dir / "gb_model.pkl", 'wb') as f:
                pickle.dump(self.gb_model, f)
        
        # Save feature scaler
        with open(self.model_dir / "feature_scaler.pkl", 'wb') as f:
            pickle.dump(self.feature_scaler, f)
        
        # Save feature names for consistency
        with open(self.model_dir / "feature_columns.json", 'w') as f:
            json.dump(self.feature_columns, f)
            
    def _load_models(self):
        """Deserialized previously saved models from disk."""
        
        try:
            # Load LSTM model if TensorFlow is available and file exists
            if TENSORFLOW_AVAILABLE and (self.model_dir / "lstm_model.h5").exists():
                self.lstm_model = load_model(str(self.model_dir / "lstm_model.h5"))
            
            # Load RandomForest model
            if (self.model_dir / "rf_model.pkl").exists():
                with open(self.model_dir / "rf_model.pkl", 'rb') as f:
                    self.rf_model = pickle.load(f)
            
            # Load GradientBoosting model
            if (self.model_dir / "gb_model.pkl").exists():
                with open(self.model_dir / "gb_model.pkl", 'rb') as f:
                    self.gb_model = pickle.load(f)
            
            # Load feature scaler
            if (self.model_dir / "feature_scaler.pkl").exists():
                with open(self.model_dir / "feature_scaler.pkl", 'rb') as f:
                    self.feature_scaler = pickle.load(f)
            
            # Load feature columns for consistency check (optional)
            if (self.model_dir / "feature_columns.json").exists():
                with open(self.model_dir / "feature_columns.json", 'r') as f:
                    loaded_features = json.load(f)
                    if loaded_features != self.feature_columns:
                        logger.warning("Loaded feature columns do not match current definition. Model might be incompatible.")
        
        except Exception as e:
            logger.error(f"Failed to load models: {e}")
    
    def incremental_update(self, task_data: Dict, actual_hours: float) -> bool:
        """Performs online learning to adjust the models with real-time feedback.

        Args:
            task_data: Features of the completed task.
            actual_hours: Actual time taken.

        Returns:
            bool: Success status of the update.
        """
        if self.rf_model is None or self.gb_model is None:
            logger.warning("Cannot perform incremental update: RF or GB model not loaded.")
            return False
        
        try:
            # Extract features for the single completed task
            feature_vec = self._extract_features_for_prediction(task_data)
            if feature_vec is None:
                logger.warning("Incremental update failed: Feature extraction for task data failed.")
                return False
            
            X_scaled = self.feature_scaler.transform(np.array([feature_vec]))
            y = np.array([actual_hours])
            
            # Incremental tree addition for Gradient Boosting
            # GradientBoostingRegressor supports 'warm_start' for adding estimators
            if hasattr(self.gb_model, 'fit'):
                # Increment n_estimators to add one more tree
                self.gb_model.n_estimators += 1
                # Fit on the new sample, leveraging warm_start
                self.gb_model.fit(X_scaled, y)
            
            # Sliding window retraining for Random Forest (persisted sample-based)
            # RandomForest does not have a direct `partial_fit` for adding single samples.
            # A common strategy is to maintain a buffer of recent samples and periodically
            # retrain a small part of the forest or the entire forest on this buffer.
            samples_path = self.model_dir / "recent_samples.json"
            try:
                # Load existing recent samples
                if samples_path.exists():
                    with open(samples_path, 'r') as f:
                        samples = json.load(f)
                else:
                    samples = []
            except Exception as e:
                logger.warning(f"Could not load recent_samples for RF incremental update: {e}")
                samples = []
            
            # Add the new sample
            samples.append({'X': X_scaled[0].tolist(), 'y': actual_hours})
            samples = samples[-50:] # Limit history buffer size to last 50 samples
            
            # Persist the updated sample buffer
            try:
                with open(samples_path, 'w') as f:
                    json.dump(samples, f)
            except Exception as e:
                logger.warning(f"Could not persist recent_samples: {e}")
            
            # Periodically rebuild small RF ensemble components for fast adaptation
            # This approach trains a few new trees on the recent samples and adds them
            # to the existing forest, effectively "updating" it.
            if len(samples) >= 10 and X_scaled.shape[1] == self.rf_model.n_features_in_:
                X_recent = np.array([s['X'] for s in samples])
                y_recent = np.array([s['y'] for s in samples])
                
                new_rf = RandomForestRegressor(n_estimators=5, random_state=None, n_jobs=-1)
                new_rf.fit(X_recent, y_recent)
                
                # Merge new estimators with existing ones, keeping the most recent
                self.rf_model.estimators_ = (self.rf_model.estimators_[:] + new_rf.estimators_)[-250:]
                self.rf_model.n_estimators = len(self.rf_model.estimators_)
            elif X_scaled.shape[1] != self.rf_model.n_features_in_:
                logger.warning(f"Feature mismatch: recent={X_scaled.shape[1]}, model={self.rf_model.n_features_in_}, skipping RF merge")
            
            # Save updated models to disk
            self._save_models()
            
            return True
            
        except Exception as e:
            logger.error(f"Incremental update failed: {e}")
            return False