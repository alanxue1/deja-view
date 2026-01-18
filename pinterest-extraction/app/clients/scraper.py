"""
Pinterest board scraper - bypasses API when tokens aren't available.
Extracts pin image URLs from public board pages.
"""

import json
import html as html_lib
import logging
import re
import xml.etree.ElementTree as ET
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

    # Extract pin ID from canonical pin URL
    PIN_URL_ID_PATTERN = re.compile(r'/pin/(\d+)/')

    # Extract <img src="..."> from RSS <description> (after HTML unescape)
    RSS_DESCRIPTION_IMG_PATTERN = re.compile(r'<img[^>]+src="([^"]+)"', re.IGNORECASE)
    
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

    def _board_url_to_rss_url(self, board_url: str) -> str:
        """
        Convert a normalized board URL to the RSS URL.

        Example:
          https://www.pinterest.com/user/board  -> https://www.pinterest.com/user/board.rss
        """
        base = board_url.rstrip("/")
        if base.endswith(".rss"):
            return base
        return f"{base}.rss"

    async def _extract_board_pins_from_rss(self, board_url: str, max_pins: int) -> Optional[List[ScrapedPin]]:
        """
        Extract pins from the board RSS feed.

        RSS is typically cleaner than scraping the HTML page: it contains only pins saved to the board.
        Returns None if RSS can't be fetched/parsed.
        """
        if not self._client:
            return None

        rss_url = self._board_url_to_rss_url(board_url)

        try:
            resp = await self._client.get(
                rss_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                follow_redirects=True,
            )
            if resp.status_code != 200:
                logger.debug(f"RSS fetch failed: {rss_url} HTTP {resp.status_code}")
                return None
            xml_text = resp.text
        except Exception as e:
            logger.debug(f"RSS fetch error: {e}")
            return None

        try:
            root = ET.fromstring(xml_text)
        except Exception as e:
            logger.debug(f"RSS parse error: {e}")
            return None

        channel = root.find("channel")
        if channel is None:
            channel = next((el for el in root.iter() if el.tag.endswith("channel")), None)
        if channel is None:
            return None

        items = channel.findall("item")
        if not items:
            items = [el for el in channel.iter() if el.tag.endswith("item")]
        if not items:
            return None

        pins: List[ScrapedPin] = []
        seen_pin_ids: set[str] = set()

        for item in items:
            if len(pins) >= max_pins:
                break

            title = (item.findtext("title") or "").strip() or None
            link = (item.findtext("link") or "").strip()
            guid = (item.findtext("guid") or "").strip()
            pin_url = link or guid
            if not pin_url:
                continue

            m = self.PIN_URL_ID_PATTERN.search(pin_url)
            if not m:
                continue
            pin_id = m.group(1)
            if pin_id in seen_pin_ids:
                continue

            desc_raw = item.findtext("description") or ""
            desc_html = html_lib.unescape(desc_raw)
            img_match = self.RSS_DESCRIPTION_IMG_PATTERN.search(desc_html)
            if not img_match:
                continue
            image_url = img_match.group(1)
            image_url = self._url_to_high_res(image_url)

            seen_pin_ids.add(pin_id)
            pins.append(
                ScrapedPin(
                    pin_id=pin_id,
                    image_url=image_url,
                    board_url=board_url,
                    title=title,
                    description=None,
                )
            )

        if not pins:
            return None

        logger.info(f"Extracted {len(pins)} board pins from RSS feed")
        return pins
    
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
        
        # Try to extract pins from embedded JSON first (most accurate when present)
        json_pins = self._extract_board_pins_from_json(html, board_url, max_pins)
        if json_pins:
            return json_pins

        # Next best option: RSS feed (typically contains only the pins saved to the board).
        rss_pins = await self._extract_board_pins_from_rss(board_url, max_pins)
        if rss_pins:
            return rss_pins

        # Hard stop: do NOT fall back to regex (which includes recommendations).
        logger.warning(
            "Could not extract pins from board JSON or RSS; returning no pins to avoid recommendations"
        )
        return []
