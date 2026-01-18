#!/usr/bin/env python3
"""
Run the Pinterest board watcher and item worker.

This script starts two background tasks:
1. Board watcher - polls Pinterest board and queues new items
2. Item worker - processes queued items and generates 3D models

Usage:
    python3 run_watcher.py

Make sure to set up your .env file with:
- MONGODB_ATLAS_URI
- DEMO_ROOM_ID
- PINTEREST_BOARD_URL
- All other required API keys (OPENAI_API_KEY, GEMINI_API_KEY, etc.)
"""

import asyncio
import logging
import signal

from app.watcher import BoardWatcher, ItemWorker
from app.clients.mongodb import get_db, close_db
from app.settings import settings


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class WatcherService:
    """Manages board watcher and item worker."""
    
    def __init__(self):
        self.board_watcher = None
        self.item_worker = None
        self.tasks = []
    
    async def start(self):
        """Start watcher and worker tasks."""
        # Validate configuration
        if not settings.mongodb_atlas_uri:
            logger.error("MONGODB_ATLAS_URI not configured in .env")
            return False
        
        if not settings.demo_room_id:
            logger.error("DEMO_ROOM_ID not configured in .env")
            logger.info("Run 'python3 -m app.db_setup' to create a demo room")
            return False
        
        if not settings.pinterest_board_url:
            logger.error("PINTEREST_BOARD_URL not configured in .env")
            return False
        
        # Test MongoDB connection
        try:
            db = get_db()
            await db.command('ping')
            logger.info("✓ Connected to MongoDB")
        except Exception as e:
            logger.error(f"✗ Failed to connect to MongoDB: {e}")
            return False
        
        # Initialize watcher and worker
        self.board_watcher = BoardWatcher(
            board_url=settings.pinterest_board_url,
            room_id=settings.demo_room_id,
            poll_interval=settings.watcher_poll_interval_seconds,
            max_pins=settings.watcher_max_pins
        )
        
        self.item_worker = ItemWorker(max_concurrent=3)
        
        # Start background tasks
        logger.info("Starting background tasks...")
        self.tasks = [
            asyncio.create_task(self.board_watcher.start(), name="board_watcher"),
            asyncio.create_task(self.item_worker.start(), name="item_worker")
        ]
        
        logger.info("✓ Watcher service started")
        logger.info(f"  → Board: {settings.pinterest_board_url}")
        logger.info(f"  → Room: {settings.demo_room_id}")
        logger.info(f"  → Poll interval: {settings.watcher_poll_interval_seconds}s")
        logger.info(f"  → Max concurrent jobs: 3")
        
        return True
    
    async def stop(self):
        """Stop watcher and worker tasks."""
        logger.info("Stopping watcher service...")
        
        if self.board_watcher:
            self.board_watcher.stop()
        
        if self.item_worker:
            self.item_worker.stop()
        
        # Cancel tasks
        for task in self.tasks:
            task.cancel()
        
        # Wait for tasks to complete
        await asyncio.gather(*self.tasks, return_exceptions=True)
        
        # Close MongoDB connection
        await close_db()
        
        logger.info("✓ Watcher service stopped")


async def main():
    """Run the watcher service."""
    service = WatcherService()
    
    # Setup signal handlers for graceful shutdown
    loop = asyncio.get_event_loop()
    
    def handle_signal(sig):
        logger.info(f"Received signal {sig}, shutting down...")
        asyncio.create_task(service.stop())
    
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda s=sig: handle_signal(s))
    
    # Start service
    if not await service.start():
        logger.error("Failed to start watcher service")
        return
    
    # Keep running until interrupted
    try:
        await asyncio.Event().wait()
    except asyncio.CancelledError:
        pass
    finally:
        await service.stop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
