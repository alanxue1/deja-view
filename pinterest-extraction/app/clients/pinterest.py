import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import httpx

from app.settings import settings
from app.utils.http import create_http_client, retry_with_backoff
from app.utils.images import extract_best_image_url


logger = logging.getLogger(__name__)


class PinterestAPIError(Exception):
    """Base exception for Pinterest API errors."""
    pass


class PinterestAuthError(PinterestAPIError):
    """Authentication/authorization error."""
    pass


class PinterestRateLimitError(PinterestAPIError):
    """Rate limit exceeded."""
    pass


class PinData:
    """Structured pin data extracted from Pinterest API response."""
    
    def __init__(self, raw_data: Dict[str, Any]):
        self.raw_data = raw_data
        self.pin_id = raw_data.get("id", "")
        self.board_id = raw_data.get("board_id", "")
        self.title = raw_data.get("title")
        self.description = raw_data.get("description") or raw_data.get("note")
        self.alt_text = raw_data.get("alt_text")
        self.link = raw_data.get("link")
        
        # Parse created_at if present
        self.created_at = None
        if "created_at" in raw_data:
            try:
                self.created_at = datetime.fromisoformat(
                    raw_data["created_at"].replace("Z", "+00:00")
                )
            except (ValueError, AttributeError):
                pass
        
        # Extract best image URL
        self.image_url = extract_best_image_url(raw_data)


class PinterestClient:
    """
    Client for Pinterest API v5.
    
    Handles board pin listing with pagination, retry logic, and error handling.
    """
    
    def __init__(self, access_token: str):
        """
        Initialize Pinterest client.
        
        Args:
            access_token: Pinterest OAuth access token
        """
        self.access_token = access_token
        self.base_url = settings.pinterest_api_base_url
        self._client: Optional[httpx.AsyncClient] = None
    
    async def __aenter__(self):
        self._client = create_http_client()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._client:
            await self._client.aclose()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Pinterest API requests."""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json"
        }
    
    async def list_board_pins(
        self,
        board_id: str,
        page_size: int = 50,
        bookmark: Optional[str] = None
    ) -> tuple[List[PinData], Optional[str]]:
        """
        List pins from a Pinterest board (one page).
        
        Args:
            board_id: Pinterest board ID
            page_size: Number of pins per page (max 100)
            bookmark: Pagination bookmark from previous response
            
        Returns:
            Tuple of (list of PinData, next bookmark or None)
            
        Raises:
            PinterestAuthError: Invalid token or missing permissions
            PinterestRateLimitError: Rate limit exceeded
            PinterestAPIError: Other API errors
        """
        if not self._client:
            raise RuntimeError("Client not initialized. Use async context manager.")
        
        # Clamp page_size to Pinterest's limits
        page_size = min(max(1, page_size), 100)
        
        url = f"{self.base_url}/boards/{board_id}/pins"
        params = {"page_size": page_size}
        
        if bookmark:
            params["bookmark"] = bookmark
        
        logger.info(f"Fetching pins from board {board_id}, page_size={page_size}, bookmark={bookmark}")
        
        async def make_request():
            response = await self._client.get(
                url,
                headers=self._get_headers(),
                params=params
            )
            
            # Handle error status codes
            if response.status_code == 401:
                raise PinterestAuthError("Invalid or expired Pinterest access token")
            elif response.status_code == 403:
                raise PinterestAuthError(
                    "Insufficient permissions to access this board. "
                    "Ensure token has boards:read and pins:read scopes."
                )
            elif response.status_code == 404:
                raise PinterestAPIError(f"Board {board_id} not found")
            elif response.status_code == 429:
                retry_after = response.headers.get("Retry-After", "unknown")
                raise PinterestRateLimitError(
                    f"Rate limit exceeded. Retry after: {retry_after}"
                )
            elif response.status_code >= 400:
                raise PinterestAPIError(
                    f"Pinterest API error: {response.status_code} - {response.text}"
                )
            
            response.raise_for_status()
            return response
        
        try:
            # Retry with backoff for transient errors
            response = await retry_with_backoff(make_request)
            data = response.json()
            
            # Extract pins
            items = data.get("items", [])
            pins = [PinData(item) for item in items]
            
            # Get next bookmark
            next_bookmark = data.get("bookmark")
            
            logger.info(f"Fetched {len(pins)} pins, next_bookmark={next_bookmark}")
            
            return pins, next_bookmark
            
        except (PinterestAuthError, PinterestRateLimitError):
            # Don't wrap auth/rate limit errors
            raise
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching pins: {e}")
            raise PinterestAPIError(f"Failed to fetch pins: {e}")
    
    async def fetch_all_pins(
        self,
        board_id: str,
        max_pins: int,
        page_size: int = 50
    ) -> List[PinData]:
        """
        Fetch pins from a board with pagination, up to max_pins.
        
        Args:
            board_id: Pinterest board ID
            max_pins: Maximum number of pins to fetch
            page_size: Pins per page
            
        Returns:
            List of PinData
            
        Raises:
            PinterestAuthError, PinterestRateLimitError, PinterestAPIError
        """
        all_pins = []
        bookmark = None
        
        while len(all_pins) < max_pins:
            pins, next_bookmark = await self.list_board_pins(
                board_id=board_id,
                page_size=min(page_size, max_pins - len(all_pins)),
                bookmark=bookmark
            )
            
            if not pins:
                # No more pins available
                logger.info(f"No more pins available for board {board_id}")
                break
            
            all_pins.extend(pins)
            logger.info(f"Progress: {len(all_pins)}/{max_pins} pins fetched")
            
            if not next_bookmark:
                # No more pages
                logger.info(f"Reached end of board {board_id}")
                break
            
            bookmark = next_bookmark
        
        # Trim to exact max if we went over
        result = all_pins[:max_pins]
        logger.info(f"Completed fetching {len(result)} pins from board {board_id}")
        return result
