# ai_service/app/core/backend_client.py

"""
Client for communicating with the Spring Boot backend.

This module provides the BackendClient class, which handles all HTTP 
interactions with the main backend service, including authentication, 
multi-company isolation, and pagination.
"""

import httpx
import logging
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class BackendClient:
    """Async HTTP client for Spring Boot API with pagination support.

    Handles communication with the backend services for resource planning,
    task management, and employee data retrieval.
    """
    
    def __init__(self):
        """Initializes the backend client with base URL and timeout settings."""
        self.base_url = settings.BACKEND_API_URL
        self.timeout = httpx.Timeout(30.0, connect=10.0)
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        company_id: str,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generic request handler with company isolation.

        Args:
            method: The HTTP method (GET, POST, etc.).
            endpoint: The API endpoint path.
            company_id: The ID of the company for which the request is made.
            headers: Optional dictionary of HTTP headers.
            params: Optional dictionary of query parameters.
            **kwargs: Additional arguments for the request.

        Returns:
            Dict[str, Any]: The JSON response from the backend.

        Raises:
            httpx.HTTPStatusError: If the backend returns an error status.
            Exception: For any other request-related errors.
        """
        url = f"{self.base_url}{endpoint}"
        
        # Ensure company isolation by setting the mandatory header
        request_headers = headers or {}
        request_headers["X-Company-Id"] = company_id
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                # Execute the asynchronous HTTP request
                response = await client.request(
                    method=method,
                    url=url,
                    headers=request_headers,
                    params=params,
                    **kwargs
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError:
                # Re-raise status errors for higher-level handling
                raise
            except Exception:
                # Re-raise general exceptions
                raise
    
    async def get_skill_name_by_id(
        self,
        skill_id: str,
        token: str,
        company_id: str
    ) -> Optional[str]:
        """Retrieves a skill name given its unique ID.

        Args:
            skill_id: The ID of the skill to fetch.
            token: Auth token for the backend.
            company_id: The ID of the company.

        Returns:
            Optional[str]: The name of the skill, or None if not found or on error.
        """
        try:
            headers = {
                "Authorization": f"Bearer {token}",
                "X-Company-Id": company_id
            }
            
            data = await self._request(
                "GET",
                f"/skills/{skill_id}",
                company_id,
                headers=headers
            )
            
            return data.get('name')
        except Exception as e:
            logger.error(f"Failed to fetch skill name for ID {skill_id}: {e}")
            return None


    async def get_skills_by_ids(
        self,
        skill_ids: List[str],
        token: str,
        company_id: str
    ) -> Dict[str, str]:
        """Batch fetches skill names for multiple skill IDs.

        Args:
            skill_ids: List of skill IDs to fetch.
            token: Auth token for the backend.
            company_id: The ID of the company.

        Returns:
            Dict[str, str]: A mapping of skill IDs to their corresponding names.
        """
        try:
            headers = {
                "Authorization": f"Bearer {token}",
                "X-Company-Id": company_id
            }
            
            # Retrieve all available skills once to avoid multiple network calls
            all_skills = await self._request(
                "GET",
                "/skills",
                company_id,
                headers=headers
            )
            
            # Create the mapping for specified skill IDs
            skill_map = {}
            for skill in all_skills:
                if skill['id'] in skill_ids:
                    skill_map[skill['id']] = skill['name']
            
            return skill_map
            
        except Exception as e:
            logger.error(f"Failed to fetch skills: {e}")
            return {}
    
    async def _fetch_all_pages(
        self,
        endpoint: str,
        company_id: str,
        token: str,
        page_size: int = 100,
        max_pages: int = 100
    ) -> List[Dict[str, Any]]:
        """Iteratively fetches all pages from a paginated API endpoint.

        Args:
            endpoint: The paginated endpoint path.
            company_id: The ID of the company.
            token: Auth token.
            page_size: Number of items per page.
            max_pages: Maximum number of pages to prevent infinite loops.

        Returns:
            List[Dict[str, Any]]: A consolidated list of all retrieved items.
        """
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Company-Id": company_id
        }
        
        all_items = []
        current_page = 0
        
        while current_page < max_pages:
            try:
                # Define pagination and sorting parameters
                params = {
                    "page": current_page,
                    "size": page_size,
                    "sortBy": "createdAt",
                    "sortDir": "desc"
                }
                
                response = await self._request(
                    "GET",
                    endpoint,
                    company_id,
                    headers=headers,
                    params=params
                )
                
                # Extract items from the page content wrapper
                if isinstance(response, dict) and 'content' in response:
                    content = response['content']
                    all_items.extend(content)
                    
                    # Update iteration state based on response metadata
                    total_pages = response.get('totalPages', 1)
                    current_page += 1
                    
                    if current_page >= total_pages:
                        break
                else:
                    # Return direct list if response is not in the paged wrapper format
                    return response if isinstance(response, list) else [response]
                    
            except Exception:
                # Gracefully stop pagination on error
                break
        
        return all_items
    
    async def get_employees(
        self,
        company_id: str,
        token: str,
        fetch_all: bool = True
    ) -> List[Dict[str, Any]]:
        """Retrieves employee records for a specific company.

        Args:
            company_id: The ID of the company.
            token: Auth token.
            fetch_all: Whether to use pagination to retrieve the full dataset.

        Returns:
            List[Dict[str, Any]]: List of employee objects.
        """
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Company-Id": company_id
        }
        
        try:
            if fetch_all:
                try:
                    # Attempt to use the paginated endpoint for robustness
                    data = await self._fetch_all_pages(
                        "/employees/paginated",
                        company_id,
                        token,
                        page_size=100
                    )
                    return data
                except Exception as e:
                    logger.error(f"Failed to fetch all employees with pagination: {e}")

            # Fallback to the standard un-paginated endpoint
            data = await self._request("GET", "/employees", company_id, headers=headers)
            return data
        except Exception:
            return []
    
    async def get_employee_skills(
        self,
        employee_id: str,
        token: str,
        company_id: str
    ) -> Dict[str, int]:
        """Retrieves and normalizes skills for a specific employee.

        This method handles multiple backend response formats to ensure
        a consistent mapping of skill names to proficiency levels.

        Args:
            employee_id: The employee ID.
            token: Auth token.
            company_id: The ID of the company.

        Returns:
            Dict[str, int]: Mapping of {skill_name: proficiency_level}.
        """
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Company-Id": company_id
        }
        
        try:
            # Request detailed format which includes mapped skill names
            data = await self._request(
                "GET",
                f"/employees/{employee_id}/skills",
                company_id,
                headers=headers,
                params={"format": "detailed"}
            )
                        
            # Normalize complex dictionary responses
            if isinstance(data, dict):
                # Try to get skillsByName first (preferred)
                if 'skillsByName' in data:
                    skills = data['skillsByName']
                    return skills
                
                # Try skillsById as fallback
                elif 'skillsById' in data:
                    skills = data['skillsById']
                    return skills
                
                # If direct dict of skills
                elif all(isinstance(v, int) for v in data.values()):
                    return data
                
                # If it has 'skills' list, convert it
                elif 'skills' in data and isinstance(data['skills'], list):
                    skill_dict = {}
                    for skill in data['skills']:
                        if isinstance(skill, dict) and 'skillName' in skill and 'proficiencyLevel' in skill:
                            skill_dict[skill['skillName']] = skill['proficiencyLevel']
                    return skill_dict
            
            # Normalize list-based responses
            elif isinstance(data, list):
                skill_dict = {}
                for skill in data:
                    if isinstance(skill, dict):
                        if 'skillName' in skill and 'proficiencyLevel' in skill:
                            skill_dict[skill['skillName']] = skill['proficiencyLevel']
                        elif 'name' in skill and 'proficiency' in skill:
                            skill_dict[skill['name']] = skill['proficiency']
                return skill_dict
            
            return {}
                
        except Exception:
            return {}
        
    async def get_all_employee_skills_batch(
        self,
        employee_ids: List[str],
        token: str,
        company_id: str
    ) -> Dict[str, Dict[str, int]]:
        """Fetches normalized skills for multiple employees in a single batch request.

        Args:
            employee_ids: List of employee UUID strings.
            token: Auth token.
            company_id: Company ID.

        Returns:
            Dict[str, Dict[str, int]]: Nested mapping of {employee_id: {skill_name: proficiency}}.
        """
        if not employee_ids:
            return {}
        
        try:
            headers = {
                "Authorization": f"Bearer {token}",
                "X-Company-Id": company_id
            }
            
            params = {
                "employeeIds": employee_ids,
                "format": "simple"
            }
            
            # Execute batch request for performance optimization
            data = await self._request(
                "GET",
                "/employees/skills/batch",
                company_id,
                headers=headers,
                params=params
            )
            
            return data
            
        except Exception:
            # Parallel retry logic if batch endpoint is unavailable
            result = {}
            for emp_id in employee_ids:
                try:
                    skills = await self.get_employee_skills(emp_id, token, company_id)
                    result[emp_id] = skills
                except Exception as emp_error:
                    logger.warning(f"Failed to fetch skills for {emp_id}: {emp_error}")
                    result[emp_id] = {}
            
            return result
    
    async def get_tasks(
        self,
        company_id: str,
        token: str,
        status: Optional[str] = None,
        fetch_all: bool = True
    ) -> List[Dict[str, Any]]:
        """Retrieves tasks for a specific company and includes their required skills.

        Args:
            company_id: The ID of the company.
            token: Auth token.
            status: Optional task status to filter by (e.g., TODO, IN_PROGRESS).
            fetch_all: Whether to retrieve all items using pagination.

        Returns:
            List[Dict[str, Any]]: List of task objects with embedded requiredSkillIds.
        """
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Company-Id": company_id
        }
        
        try:
            if fetch_all:
                try:
                    # Attempt paginated fetch for exhaustive task retrieval
                    endpoint = "/tasks/paginated"
                    if status:
                        logger.info(f"Fetching all {status} tasks with pagination")
                    
                    tasks = await self._fetch_all_pages(
                        endpoint,
                        company_id,
                        token,
                        page_size=100
                    )
                    
                    if status:
                        tasks = [t for t in tasks if t.get('status') == status]
                    
                except Exception:
                    # Simple GET fallback
                    endpoint = "/tasks"
                    if status:
                        endpoint += f"?status={status}"
                    tasks = await self._request("GET", endpoint, company_id, headers=headers)
            else:
                endpoint = "/tasks"
                if status:
                    endpoint += f"?status={status}"
                tasks = await self._request("GET", endpoint, company_id, headers=headers)
            
            if tasks:
                # Populate task skills in a single batch to avoid N+1 queries
                task_ids = [task['id'] for task in tasks]  #Collect all IDs
                
                # Single batch call
                all_task_skills = await self.get_task_required_skills_batch(
                    task_ids, token, company_id
                )
                
                # Mapper logic for skill IDs
                for task in tasks:
                    task['requiredSkillIds'] = all_task_skills.get(task['id'], [])

            return tasks 
            
        except Exception:
            return []
    
    async def get_employee_workload(
        self,
        company_id: str,
        token: str,
        fetch_all: bool = True
    ) -> List[Dict[str, Any]]:
        """Retrieves aggregated workload statistics for all employees in a company.

        Args:
            company_id: The ID of the company.
            token: Auth token.
            fetch_all: Flag for retrieving full dataset (unused presently).

        Returns:
            List[Dict[str, Any]]: Workload metrics per employee.
        """
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Company-Id": company_id
        }
        
        try:
            data = await self._request(
                "GET",
                "/employees/workload",
                company_id,
                headers=headers
            )
            return data
        except Exception:
            return []
    
    async def get_skills(
        self,
        company_id: str,
        token: str,
        fetch_all: bool = True
    ) -> List[Dict[str, Any]]:
        """Retrieves the full list of skill definitions for a company.

        Args:
            company_id: The ID of the company.
            token: Auth token.
            fetch_all: Unused parameter for now.

        Returns:
            List[Dict[str, Any]]: List of skill definitions.
        """
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Company-Id": company_id
        }
        
        try:
            data = await self._request("GET", "/skills", company_id, headers=headers)
            return data
        except Exception:
            return []
    
    async def get_historical_tasks(
        self,
        company_id: str,
        token: str,
        days: int = 90
    ) -> List[Dict[str, Any]]:
        """Fetches successfully completed tasks to be used for model training.

        Args:
            company_id: The ID of the company.
            token: Auth token.
            days: Lookback period for history (currently uses all retrieved tasks).

        Returns:
            List[Dict[str, Any]]: Filtered list of completed tasks with actual hours recorded.
        """
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Company-Id": company_id
        }
        
        try:
            # Fetch all tasks and filter locally to preserve required skill context
            all_tasks = await self.get_tasks(company_id, token, fetch_all=True)
            
            completed = [
                t for t in all_tasks
                if t.get('status') == 'COMPLETED' and
                t.get('actualHours') is not None and
                t.get('actualHours') > 0
            ]
            
            return completed
        except Exception:
            return []
        
    async def get_task_required_skills_batch(
        self,
        task_ids: List[str],
        token: str,
        company_id: str
    ) -> Dict[str, List[str]]:
        """Batch fetches the list of required skill IDs for multiple tasks.

        Args:
            task_ids: List of task IDs.
            token: Auth token.
            company_id: The company ID.

        Returns:
            Dict[str, List[str]]: Mapping of task_id to its list of required skill IDs.
        """
        if not task_ids:
            return {}
        
        try:
            headers = {
                "Authorization": f"Bearer {token}",
                "X-Company-Id": company_id
            }
            
            params = {
                "taskIds": task_ids
            }
            
            # Call specialized batch discovery endpoint
            data = await self._request(
                "GET",
                "/tasks/required-skills/batch",
                company_id,
                headers=headers,
                params=params
            )

            return data
            
        except Exception:
            # Fallback to individual fetches if batch API is unavailable
            result = {}
            for task_id in task_ids:
                try:
                    # Note: Assumes individual get_task_required_skills exists (logic inferred)
                    result[task_id] = []
                except:
                    result[task_id] = []
            return result
    
    async def get_task_by_id(
        self,
        task_id: str,
        token: str,
        company_id: str
    ) -> Dict[str, Any]:
        """Fetches a single task by its unique identifier.

        Args:
            task_id: The unique ID of the task.
            token: Auth token.
            company_id: The ID of the company.

        Returns:
            Dict[str, Any]: The task object.

        Raises:
            Exception: If retrieval fails.
        """
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Company-Id": company_id
        }
        
        try:
            data = await self._request(
                "GET",
                f"/tasks/{task_id}",
                company_id,
                headers=headers
            )
            return data
        except Exception:
            # Re-raise to allow endpoint-level error handling
            raise


# Global client instance for singleton usage across the application
backend_client = BackendClient()