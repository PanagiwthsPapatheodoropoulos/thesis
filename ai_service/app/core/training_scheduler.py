# ai_service/app/core/training_scheduler.py
"""
core/training_scheduler.py - Automated Model Training and Retraining Scheduler.
Uses APScheduler to run two recurring jobs:
  1. A full daily retraining at 2 AM for all companies with sufficient task history.
  2. An incremental update every 6 hours for companies with new completed task data.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.backend_client import backend_client
from app.models.lstm_predictor import HybridDurationPredictor
from app.core.redis_client import redis_client
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

logger = logging.getLogger(__name__)

class TrainingScheduler:
    """
    Orchestrates periodic ML model training using the APScheduler library.
    Maintains per-company training state to prevent concurrent retraining jobs
    from conflicting. Interfaces with the backend client to fetch training data
    and with Redis to persist training metrics and history.
    """
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.min_tasks_for_training = 30
        self.training_window_days = 90
        self.is_training = {}  # Track training status per company
        
    def start(self):
        """
        Registers and starts the APScheduler cron jobs.
        Schedules daily full retraining at 2:00 AM and incremental updates every 6 hours.
        """
        # Train daily at 2 AM
        self.scheduler.add_job(
            self.train_all_companies,
            CronTrigger(hour=2, minute=0),
            id='daily_training',
            replace_existing=True
        )
        
        # Quick retrain every 6 hours if new data available
        self.scheduler.add_job(
            self.incremental_train_all,
            CronTrigger(hour='*/6'),
            id='incremental_training',
            replace_existing=True
        )
        
        self.scheduler.start()

    async def train_all_companies(self):
        """
        Triggers a full model retraining for every active company.
        Retrieves the list of companies from the backend and processes each one sequentially.
        Errors for individual companies are logged without interrupting the overall run.
        """        
        try:
            # Get list of companies (you'll need to implement this endpoint)
            companies = await self._get_active_companies()
            
            for company_id in companies:
                try:
                    await self.train_company_model(company_id, full_retrain=True)
                except Exception as e:
                    logger.error(f"Training failed for company {company_id}: {e}")
                    
        except Exception as e:
            logger.error(f"Scheduled training failed: {e}")
            
    async def train_company_model(
        self, 
        company_id: str, 
        full_retrain: bool = False
    ) -> bool:
        """
        Train prediction model for a specific company
        
        Args:
            company_id: Company UUID
            full_retrain: If True, retrain from scratch. If False, incremental update
        
        Returns:
            True if training succeeded
        """
        if self.is_training.get(company_id, False):
            return False
            
        self.is_training[company_id] = True
        
        try:
            
            # Fetch historical data
            historical_tasks = await self._fetch_training_data(company_id)
            
            if len(historical_tasks) < self.min_tasks_for_training:
                return False
                
            # Initialize or load predictor
            predictor = HybridDurationPredictor(company_id)
            
            # Train the model
            success = predictor.train(historical_tasks)
            
            if success:                
                # Evaluate model performance
                metrics = await self._evaluate_model(predictor, historical_tasks)
                
                # Store metrics in Redis
                await self._store_training_metrics(company_id, metrics)
                
                return True
            else:
                return False
                
        except Exception:
            return False
        finally:
            self.is_training[company_id] = False
            
    async def incremental_train_all(self):
        """
        Checks all active companies for newly completed tasks and triggers an incremental
        model update for any company that has accumulated at least 5 new data points since
        the last training run.
        """        
        try:
            companies = await self._get_active_companies()
            
            for company_id in companies:
                # Check if there's new data since last training
                new_data_count = await self._count_new_completed_tasks(company_id)
                
                if new_data_count >= 5:  # At least 5 new tasks
                    await self.train_company_model(
                        company_id, 
                        full_retrain=False
                    )
                    
        except Exception as e:
            logger.error(f"Incremental training failed: {e}")
            
    async def _fetch_training_data(self, company_id: str) -> List[Dict]:
        """
        Fetch completed tasks for training
        
        Returns tasks with:
        - title, description, priority
        - estimatedHours, actualHours
        - complexityScore, requiredSkillIds
        - createdAt, completedDate
        """
        try:
            # Get admin token for this company (implement token management)
            token = await self._get_service_token(company_id)
            
            # Fetch completed tasks from last 90 days
            cutoff_date = datetime.now() - timedelta(days=self.training_window_days)
            
            # This would be a new backend endpoint
            historical_tasks = await backend_client.get_historical_tasks(
                company_id, 
                token,
                days=self.training_window_days
            )
            
            # Filter and validate
            valid_tasks = []
            for task in historical_tasks:
                if self._is_valid_training_sample(task):
                    valid_tasks.append(task)
            
            return valid_tasks
            
        except Exception:
            return []
            
    def _is_valid_training_sample(self, task: Dict) -> bool:
        """Validate if a task is suitable for training"""
        # Must have actual hours
        if not task.get('actualHours') or task['actualHours'] <= 0:
            return False
            
        # Must have title
        if not task.get('title'):
            return False
            
        # Must have completion date
        if not task.get('completedDate'):
            return False
            
        # Must not be a request or archived
        if task.get('isEmployeeRequest') or task.get('isArchived'):
            return False
            
        # Exclude outliers (tasks > 200 hours are likely data errors)
        if task['actualHours'] > 200:
            return False
            
        return True
        
    async def _evaluate_model(
        self, 
        predictor: HybridDurationPredictor, 
        test_tasks: List[Dict]
    ) -> Dict:
        """
        Evaluate model performance on test set
        
        Returns:
            {
                'mae': float,  # Mean Absolute Error
                'mape': float,  # Mean Absolute Percentage Error
                'rmse': float,  # Root Mean Squared Error
                'r2': float,   # R-squared
                'sample_count': int
            }
        """
        
        predictions = []
        actuals = []
        
        # Use last 20% of data as test set
        test_split = int(len(test_tasks) * 0.8)
        test_samples = test_tasks[test_split:]
        
        for task in test_samples:
            try:
                # Make prediction
                task_features = {
                    'priority': task.get('priority', 'MEDIUM'),
                    'complexity_score': task.get('complexityScore', 0.5),
                    'required_skills': task.get('requiredSkillIds', []),
                    'historical_avg': None
                }
                
                predicted, _, _ = predictor.predict(
                    task_features=task_features,
                    recent_tasks=[]
                )
                
                predictions.append(predicted)
                actuals.append(task['actualHours'])
                
            except Exception:
                continue
                
        if not predictions:
            return {
                'mae': 999.0,
                'mape': 999.0,
                'rmse': 999.0,
                'r2': 0.0,
                'sample_count': 0
            }
            
        predictions = np.array(predictions)
        actuals = np.array(actuals)
        
        mae = mean_absolute_error(actuals, predictions)
        rmse = np.sqrt(mean_squared_error(actuals, predictions))
        r2 = r2_score(actuals, predictions)
        
        # Calculate MAPE (avoid division by zero)
        mape = np.mean(np.abs((actuals - predictions) / np.maximum(actuals, 0.1))) * 100
        
        metrics = {
            'mae': float(mae),
            'mape': float(mape),
            'rmse': float(rmse),
            'r2': float(r2),
            'sample_count': len(predictions),
            'trained_at': datetime.now().isoformat()
        }
        
        return metrics
        
    async def _store_training_metrics(
        self, company_id: str, metrics: Dict
    ):
        """
        Persists model evaluation metrics for a company to Redis.
        Stores the latest result under a fixed key and appends to a rolling history list
        of up to 10 training runs.

        Args:
            company_id (str): The company UUID.
            metrics (Dict): The evaluation metric dictionary to store.
        """
        cache_key = "training_metrics:latest"
        await redis_client.set(
            company_id,
            cache_key,
            metrics,
            ttl=86400 * 30  # 30 days
        )
        
        # Also store in history
        history_key = "training_metrics:history"
        try:
            history = await redis_client.get(company_id, history_key) or []
            history.append(metrics)
            
            # Keep last 10 training runs
            if len(history) > 10:
                history = history[-10:]
                
            await redis_client.set(
                company_id,
                history_key,
                history,
                ttl=86400 * 90  # 90 days
            )
        except Exception as e:
            logger.warning(f"Failed to store training history: {e}")
            
    async def _get_active_companies(self) -> List[str]:
        """
        Retrieves the list of company IDs that are actively using the system.
        Requires a backend endpoint to enumerate companies.
        Currently a placeholder that returns an empty list.

        Returns:
            List[str]: A list of active company UUID strings.
        """
        # This would need a backend endpoint to list companies
        # For now, return empty list - implement this based on your needs
        try:
            # Placeholder - implement backend endpoint
            return []
        except:
            return []
            
    async def _count_new_completed_tasks(self, company_id: str) -> int:
        """
        Returns the count of tasks completed since the last training run for a company.
        If no prior training has occurred, returns a large sentinel value to force training.

        Args:
            company_id (str): The company UUID.

        Returns:
            int: The number of newly completed tasks, or 999 if never trained.
        """
        try:
            cache_key = "last_training_timestamp"
            last_training = await redis_client.get(company_id, cache_key)
            
            if not last_training:
                return 999  # Force training if never trained
                
            # This would need a backend endpoint to count new tasks
            # Placeholder implementation
            return 0
            
        except:
            return 0
            
    async def _get_service_token(self, company_id: str) -> str:
        """
        Obtains a service-to-service authentication token for calling the backend API.
        Requires implementation of a proper service account credential flow.

        Args:
            company_id (str): The company UUID for context.

        Returns:
            str: A valid JWT token for backend API requests.
        """
        # Implement proper service-to-service authentication
        # For now, return empty string - needs implementation
        return ""
        
    def stop(self):
        """Shuts down the APScheduler instance, stopping all pending and active jobs."""
        self.scheduler.shutdown()


# Global scheduler instance
training_scheduler = TrainingScheduler()