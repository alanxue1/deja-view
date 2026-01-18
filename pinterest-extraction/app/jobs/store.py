"""
In-memory job store for async 3D generation jobs.

Jobs are stored in memory with TTL expiration. State is lost on server restart.
"""

import logging
import uuid
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from dataclasses import dataclass, field

from app.settings import settings


logger = logging.getLogger(__name__)


# Job statuses
STATUS_QUEUED = "queued"
STATUS_RUNNING = "running"
STATUS_SUCCEEDED = "succeeded"
STATUS_FAILED = "failed"
STATUS_EXPIRED = "expired"


@dataclass
class Job:
    """Represents a 3D generation job."""
    job_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    request_payload: Dict[str, Any]
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert job to dict for API response."""
        return {
            "job_id": self.job_id,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "error": self.error,
            "result": self.result
        }


class JobStore:
    """In-memory store for jobs with TTL and concurrency control."""
    
    def __init__(
        self,
        ttl_hours: int = 24,
        max_concurrent_jobs: int = settings.job_max_concurrent_jobs,
        cleanup_interval_seconds: int = 3600
    ):
        """
        Initialize job store.
        
        Args:
            ttl_hours: Time to live for completed/failed jobs in hours
            max_concurrent_jobs: Maximum number of concurrent running jobs
            cleanup_interval_seconds: How often to run cleanup task
        """
        self._jobs: Dict[str, Job] = {}
        self._lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(max_concurrent_jobs)
        self._ttl = timedelta(hours=ttl_hours)
        self._cleanup_interval = cleanup_interval_seconds
        self._cleanup_task: Optional[asyncio.Task] = None
        
        logger.info(
            f"Initialized job store: ttl={ttl_hours}h, "
            f"max_concurrent={max_concurrent_jobs}"
        )
    
    def start_cleanup_task(self):
        """Start background cleanup task."""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            logger.info("Started job cleanup task")
    
    async def _cleanup_loop(self):
        """Background task to periodically clean up expired jobs."""
        while True:
            try:
                await asyncio.sleep(self._cleanup_interval)
                await self._cleanup_expired_jobs()
            except asyncio.CancelledError:
                logger.info("Cleanup task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")
    
    async def _cleanup_expired_jobs(self):
        """Remove expired jobs from store."""
        now = datetime.utcnow()
        async with self._lock:
            expired_ids = []
            for job_id, job in self._jobs.items():
                if job.status in [STATUS_SUCCEEDED, STATUS_FAILED, STATUS_EXPIRED]:
                    age = now - job.updated_at
                    if age > self._ttl:
                        expired_ids.append(job_id)
            
            for job_id in expired_ids:
                del self._jobs[job_id]
                logger.info(f"Cleaned up expired job: {job_id}")
            
            if expired_ids:
                logger.info(f"Cleaned up {len(expired_ids)} expired job(s)")
    
    async def create_job(self, request_payload: Dict[str, Any]) -> str:
        """
        Create a new job in queued state.
        
        Args:
            request_payload: Original request data
            
        Returns:
            job_id
        """
        job_id = uuid.uuid4().hex
        now = datetime.utcnow()
        
        job = Job(
            job_id=job_id,
            status=STATUS_QUEUED,
            created_at=now,
            updated_at=now,
            request_payload=request_payload
        )
        
        async with self._lock:
            self._jobs[job_id] = job
        
        logger.info(f"Created job {job_id}")
        return job_id
    
    async def get_job(self, job_id: str) -> Optional[Job]:
        """
        Get job by ID.
        
        Args:
            job_id: Job identifier
            
        Returns:
            Job or None if not found
        """
        async with self._lock:
            return self._jobs.get(job_id)
    
    async def update_job_status(
        self,
        job_id: str,
        status: str,
        error: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None
    ):
        """
        Update job status.
        
        Args:
            job_id: Job identifier
            status: New status
            error: Error message if failed
            result: Result data if succeeded
        """
        async with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.status = status
                job.updated_at = datetime.utcnow()
                if error:
                    job.error = error
                if result:
                    job.result = result
                logger.info(f"Updated job {job_id}: status={status}")
    
    async def acquire_slot(self) -> bool:
        """
        Try to acquire a job processing slot (for concurrency control).
        
        Returns:
            True if slot acquired (must call release_slot later)
        """
        return await self._semaphore.acquire()
    
    def release_slot(self):
        """Release a job processing slot."""
        self._semaphore.release()
    
    def get_stats(self) -> Dict[str, int]:
        """Get job store statistics."""
        stats = {
            "total": len(self._jobs),
            STATUS_QUEUED: 0,
            STATUS_RUNNING: 0,
            STATUS_SUCCEEDED: 0,
            STATUS_FAILED: 0,
            STATUS_EXPIRED: 0
        }
        for job in self._jobs.values():
            stats[job.status] = stats.get(job.status, 0) + 1
        return stats


# Global job store instance
_job_store: Optional[JobStore] = None


def get_job_store() -> JobStore:
    """Get or create global job store instance."""
    global _job_store
    if _job_store is None:
        _job_store = JobStore()
        _job_store.start_cleanup_task()
    return _job_store
