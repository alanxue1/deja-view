"""
Pinterest board scraper - bypasses API when tokens aren't available.
Extracts pin image URLs from public board pages.
"""

import json
import logging
import re
from typing import List, Optional
from dataclasses import dataclass
import httpx

from app.utils.http import create_http_client


logger = logging.getLogger(__name__)


@dataclass
class ScrapedPin:
    """A pin extracted by scraping."""
    pin_id: str  # hash from image URL
    image_url: str
    board_url: str
    # Scraped pins have limited metadata
    title: Optional[str] = None
    description: Optional[str] = None


class PinterestScraper:
    """
    Scrapes public Pinterest boards to extract pin image URLs.
    
    Use this when official API access is unavailable (pending approval, etc.)
    """
    
    # Regex to find pinimg.com image URLs
    IMAGE_PATTERN = re.compile(r'https?://i\.pinimg\.com/[^"\'>\s]+\.(?:jpg|png|webp)', re.IGNORECASE)
    
    # Pattern to extract pin hash from URL (the unique identifier)
    HASH_PATTERN = re.compile(r'/([a-f0-9]{32})\.(?:jpg|png|webp)$', re.IGNORECASE)
    
    # Pattern to find Pinterest's embedded JSON data
    PWS_DATA_PATTERN = re.compile(r'<script[^>]*id="__PWS_DATA__"[^>]*>(.+?)</script>', re.DOTALL)
    
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
    
    async def __aenter__(self):
        self._client = create_http_client(timeout=30)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._client:
            await self._client.aclose()
    
    def _normalize_board_url(self, board_url: str) -> str:
        """Ensure board URL is properly formatted."""
        # Handle various Pinterest URL formats
        board_url = board_url.strip().rstrip('/')
        
        # Add https if missing
        if not board_url.startswith('http'):
            board_url = f"https://{board_url}"
        
        # Normalize pinterest domain variations
        board_url = re.sub(
            r'https?://(?:www\.|ca\.|uk\.|[a-z]{2}\.)?pinterest\.com',
            'https://www.pinterest.com',
            board_url
        )
        
        return board_url
    
    def _url_to_high_res(self, url: str) -> str:
        """Convert any pinimg URL to 736x (high quality, reliably accessible)."""
        # Use 736x instead of originals - originals are sometimes blocked
        return re.sub(
            r'/(?:170x|236x|474x|550x|1200x|136x136|200x150|222x|originals)/',
            '/736x/',
            url
        )
    
    def _extract_pin_hash(self, url: str) -> Optional[str]:
        """Extract the unique pin hash from an image URL."""
        match = self.HASH_PATTERN.search(url)
        return match.group(1) if match else None
    
    def _extract_board_pins_from_json(self, html: str, board_url: str, max_pins: int) -> Optional[List[ScrapedPin]]:
        """
        Try to extract pins from Pinterest's embedded __PWS_DATA__ JSON.
        Returns None if extraction fails (fallback to regex).
        """
        try:
            # Find the embedded JSON data
            match = self.PWS_DATA_PATTERN.search(html)
            if not match:
                logger.debug("No __PWS_DATA__ found in page")
                return None
            
            json_str = match.group(1)
            data = json.loads(json_str)
            
            # Navigate Pinterest's JSON structure to find board pins
            # The structure is typically: props.initialReduxState.pins or similar
            pins_data = []
            
            # Try multiple possible paths in Pinterest's JSON structure
            def find_pins_recursive(obj, depth=0):
                """Recursively search for pin data in the JSON."""
                if depth > 10:  # Prevent infinite recursion
                    return
                
                if isinstance(obj, dict):
                    # Check if this looks like a pin object
                    if 'images' in obj and 'id' in obj:
                        pins_data.append(obj)
                    # Also check for pin data in common Pinterest structures
                    elif 'pin' in obj and isinstance(obj['pin'], dict):
                        pins_data.append(obj['pin'])
                    else:
                        for value in obj.values():
                            find_pins_recursive(value, depth + 1)
                elif isinstance(obj, list):
                    for item in obj:
                        find_pins_recursive(item, depth + 1)
            
            # Also try to find the board feed directly
            try:
                # Common path: props.initialReduxState.boards.{boardId}.pins
                initial_state = data.get('props', {}).get('initialReduxState', {})
                
                # Look in the pins section
                pins_section = initial_state.get('pins', {})
                if pins_section:
                    for pin_id, pin_data in pins_section.items():
                        if isinstance(pin_data, dict) and 'images' in pin_data:
                            pins_data.append(pin_data)
                
                # Look in board feeds
                feeds = initial_state.get('feeds', {})
                for feed_key, feed_data in feeds.items():
                    if 'BoardFeed' in feed_key or 'board' in feed_key.lower():
                        if isinstance(feed_data, dict):
                            feed_pins = feed_data.get('pins', [])
                            if isinstance(feed_pins, list):
                                for pin_id in feed_pins:
                                    if pin_id in pins_section:
                                        pins_data.append(pins_section[pin_id])
                
            except Exception as e:
                logger.debug(f"Error in direct path extraction: {e}")
            
            # Fallback: recursive search
            if not pins_data:
                find_pins_recursive(data)
            
            if not pins_data:
                logger.debug("No pin data found in JSON")
                return None
            
            # Convert pin data to ScrapedPin objects
            unique_pins = []
            seen_ids = set()
            
            for pin in pins_data:
                if len(unique_pins) >= max_pins:
                    break
                
                pin_id = pin.get('id')
                if not pin_id or pin_id in seen_ids:
                    continue
                
                # Get image URL from pin data
                images = pin.get('images', {})
                image_url = None
                
                # Try different image size keys (prefer 736x)
                for size_key in ['736x', '564x', '474x', 'orig', 'originals']:
                    if size_key in images and images[size_key].get('url'):
                        image_url = images[size_key]['url']
                        break
                
                if not image_url:
                    # Try getting any available image
                    for size_data in images.values():
                        if isinstance(size_data, dict) and size_data.get('url'):
                            image_url = size_data['url']
                            break
                
                if not image_url:
                    continue
                
                # Extract pin hash from URL
                pin_hash = self._extract_pin_hash(image_url)
                if not pin_hash:
                    # Use pin ID as fallback
                    pin_hash = str(pin_id)
                
                seen_ids.add(pin_id)
                
                unique_pins.append(ScrapedPin(
                    pin_id=pin_hash,
                    image_url=self._url_to_high_res(image_url),
                    board_url=board_url,
                    title=pin.get('title'),
                    description=pin.get('description')
                ))
            
            if unique_pins:
                logger.info(f"Extracted {len(unique_pins)} board pins from JSON data")
                return unique_pins
            
            return None
            
        except json.JSONDecodeError as e:
            logger.debug(f"Failed to parse __PWS_DATA__ JSON: {e}")
            return None
        except Exception as e:
            logger.debug(f"Error extracting pins from JSON: {e}")
            return None
    
    async def scrape_board(self, board_url: str, max_pins: int = 50) -> List[ScrapedPin]:
        """
        Scrape pins from a public Pinterest board.
        
        Args:
            board_url: Full URL to the Pinterest board
            max_pins: Maximum number of pins to return
            
        Returns:
            List of ScrapedPin objects
            
        Raises:
            Exception: If scraping fails
        """
        if not self._client:
            raise RuntimeError("Scraper not initialized. Use async context manager.")
        
        board_url = self._normalize_board_url(board_url)
        logger.info(f"Scraping board: {board_url}")
        
        try:
            response = await self._client.get(
                board_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                follow_redirects=True
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to fetch board: HTTP {response.status_code}")
            
            html = response.text
            
        except httpx.HTTPError as e:
            logger.error(f"HTTP error scraping board: {e}")
            raise Exception(f"Failed to scrape board: {e}")
        
        # Try to extract pins from embedded JSON first (most accurate)
        json_pins = self._extract_board_pins_from_json(html, board_url, max_pins)
        if json_pins:
            return json_pins
        
        # Fallback: regex-based extraction (less accurate, may include recommendations)
        logger.info("Falling back to regex-based pin extraction")
        
        # Extract all image URLs
        all_urls = self.IMAGE_PATTERN.findall(html)
        logger.info(f"Found {len(all_urls)} image URLs in page")
        
        # Deduplicate by pin hash, keeping highest quality version
        seen_hashes = set()
        unique_pins = []
        
        for url in all_urls:
            pin_hash = self._extract_pin_hash(url)
            
            if not pin_hash:
                continue
            
            if pin_hash in seen_hashes:
                continue
            
            # Skip tiny thumbnails (profile pics, icons) and PNG files (often app icons)
            if '/30x30' in url or '/75x75' in url:
                continue
            if url.endswith('.png'):
                continue
            
            seen_hashes.add(pin_hash)
            
            # Convert to high-res (736x is reliably accessible)
            high_res_url = self._url_to_high_res(url)
            
            unique_pins.append(ScrapedPin(
                pin_id=pin_hash,
                image_url=f"https://{high_res_url}" if not high_res_url.startswith('http') else high_res_url,
                board_url=board_url
            ))
            
            if len(unique_pins) >= max_pins:
                break
        
        logger.info(f"Extracted {len(unique_pins)} unique pins from board (regex fallback)")
        return unique_pins
