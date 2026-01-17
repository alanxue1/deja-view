"""
Pinterest board scraper - bypasses API when tokens aren't available.
Extracts pin image URLs from public board pages.
"""

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
        
        logger.info(f"Extracted {len(unique_pins)} unique pins from board")
        return unique_pins
