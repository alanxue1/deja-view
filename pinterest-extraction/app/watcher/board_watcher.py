"""
Pinterest board watcher - polls board and queues new items for 3D generation.
"""

import asyncio
import logging
from datetime import datetime
from typing import List, Optional
from bson import ObjectId

from app.clients.scraper import PinterestScraper, ScrapedPin
from app.clients.mongodb import get_db
from app.clients.llm.registry import get_llm_provider
from app.settings import settings


logger = logging.getLogger(__name__)


class BoardWatcher:
    """
    Polls a Pinterest board and queues new pins as items in MongoDB.
    """
    
    def __init__(
        self,
        board_url: str,
        room_id: str,
        poll_interval: int = 30,
        max_pins: int = 50
    ):
        self.board_url = board_url
        self.room_id = room_id
        self.poll_interval = poll_interval
        self.max_pins = max_pins
        self._running = False
    
    async def start(self):
        """Start watching the board."""
        self._running = True
        logger.info(
            f"Starting board watcher for {self.board_url} "
            f"(polling every {self.poll_interval}s)"
        )
        
        while self._running:
            try:
                await self._poll_board()
            except Exception as e:
                logger.error(f"Board polling error: {e}")
            
            # Wait before next poll
            await asyncio.sleep(self.poll_interval)
    
    def stop(self):
        """Stop the watcher."""
        self._running = False
        logger.info("Board watcher stopped")
    
    async def _poll_board(self):
        """Poll the board and upsert new pins."""
        logger.info(f"Polling board: {self.board_url}")
        
        # Scrape pins
        try:
            async with PinterestScraper() as scraper:
                pins = await scraper.scrape_board(
                    board_url=self.board_url,
                    max_pins=self.max_pins
                )
        except Exception as e:
            logger.error(f"Failed to scrape board: {e}")
            return
        
        if not pins:
            logger.info("No pins found")
            return
        
        logger.info(f"Found {len(pins)} pins, checking for new ones...")
        
        # Upsert pins into MongoDB
        db = get_db()
        items_collection = db["items"]
        
        new_count = 0
        for pin in pins:
            try:
                result = await items_collection.update_one(
                    {"source.pinId": pin.pin_id},
                    {
                        "$setOnInsert": {
                            "roomId": self.room_id,
                            "source": {
                                "type": "pinterest",
                                "boardUrl": pin.board_url,
                                "pinId": pin.pin_id,
                                "imageUrl": pin.image_url
                            },
                            "status": "queued",
                            "transform": {
                                "position": {"x": 0, "y": 0, "z": 0},
                                "rotation": {"x": 0, "y": 0, "z": 0},
                                "scale": 1.0
                            },
                            "createdAt": datetime.utcnow()
                        },
                        "$set": {
                            "updatedAt": datetime.utcnow()
                        }
                    },
                    upsert=True
                )
                
                if result.upserted_id:
                    new_count += 1
                    logger.info(f"Queued new pin: {pin.pin_id}")
            
            except Exception as e:
                logger.error(f"Failed to upsert pin {pin.pin_id}: {e}")
        
        logger.info(f"Queued {new_count} new items out of {len(pins)} pins")
