import httpx
import asyncio
import logging
from typing import Optional

from app.settings import settings


logger = logging.getLogger(__name__)


async def retry_with_backoff(
    func,
    max_retries: int = None,
    initial_delay: float = 1.0,
    backoff_factor: float = 2.0,
    max_delay: float = 30.0
):
    """
    Retry a function with exponential backoff.
    
    Args:
        func: Async function to retry
        max_retries: Maximum number of retries (None uses settings default)
        initial_delay: Initial delay in seconds
        backoff_factor: Multiplier for delay after each retry
        max_delay: Maximum delay between retries
        
    Returns:
        Result of func
        
    Raises:
        Last exception if all retries fail
    """
    max_retries = max_retries or settings.max_retries
    delay = initial_delay
    last_exception = None
    
    for attempt in range(max_retries + 1):
        try:
            return await func()
        except (httpx.HTTPError, asyncio.TimeoutError) as e:
            last_exception = e
            
            if attempt >= max_retries:
                logger.error(f"All {max_retries} retries exhausted")
                raise
            
            # Don't retry on auth errors (401, 403) or client errors (4xx except 429)
            if isinstance(e, httpx.HTTPStatusError):
                if e.response.status_code in [401, 403]:
                    logger.error("Auth error, not retrying")
                    raise
                if 400 <= e.response.status_code < 500 and e.response.status_code != 429:
                    logger.error(f"Client error {e.response.status_code}, not retrying")
                    raise
            
            logger.warning(
                f"Attempt {attempt + 1}/{max_retries + 1} failed: {e}. "
                f"Retrying in {delay:.1f}s..."
            )
            
            await asyncio.sleep(delay)
            delay = min(delay * backoff_factor, max_delay)
    
    # Should not reach here, but just in case
    raise last_exception


def create_http_client(timeout: Optional[int] = None) -> httpx.AsyncClient:
    """
    Create an async HTTP client with default timeout and retry configuration.
    
    Args:
        timeout: Optional timeout override in seconds
        
    Returns:
        Configured httpx AsyncClient
    """
    timeout_value = timeout or settings.request_timeout_seconds
    
    return httpx.AsyncClient(
        timeout=httpx.Timeout(timeout_value),
        follow_redirects=True,
        headers={
            "User-Agent": "Pinterest-Extraction-Service/1.0"
        },
        limits=httpx.Limits(
            max_keepalive_connections=10,
            max_connections=20
        )
    )
