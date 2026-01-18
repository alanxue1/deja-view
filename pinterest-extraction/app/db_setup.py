"""
MongoDB database setup script.

Initializes collections and indexes for the deja-view application.
Run this script once to set up the database schema.
"""

import asyncio
import logging
from datetime import datetime
from app.clients.mongodb import get_db, close_db
from app.settings import settings


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def setup_database():
    """
    Set up MongoDB collections and indexes.
    
    Collections:
    - rooms: Store room metadata
    - items: Store furniture/decor items with 3D models
    """
    db = get_db()
    
    # Check connection
    try:
        await db.command('ping')
        logger.info(f"✓ Connected to MongoDB database: {settings.mongodb_db}")
    except Exception as e:
        logger.error(f"✗ Failed to connect to MongoDB: {e}")
        return False
    
    # Create collections (idempotent)
    collections = await db.list_collection_names()
    
    if "rooms" not in collections:
        await db.create_collection("rooms")
        logger.info("✓ Created 'rooms' collection")
    else:
        logger.info("✓ 'rooms' collection already exists")
    
    if "items" not in collections:
        await db.create_collection("items")
        logger.info("✓ Created 'items' collection")
    else:
        logger.info("✓ 'items' collection already exists")
    
    # Create indexes for 'items' collection
    items_collection = db["items"]
    
    # Unique index on source.pinId to prevent duplicate pins
    try:
        await items_collection.create_index(
            [("source.pinId", 1)],
            unique=True,
            name="idx_source_pinId_unique"
        )
        logger.info("✓ Created unique index on 'items.source.pinId'")
    except Exception as e:
        logger.warning(f"Index 'idx_source_pinId_unique' may already exist: {e}")
    
    # Index for room queries (get all items in a room, sorted by update time)
    try:
        await items_collection.create_index(
            [("roomId", 1), ("updatedAt", -1)],
            name="idx_roomId_updatedAt"
        )
        logger.info("✓ Created index on 'items.roomId + updatedAt'")
    except Exception as e:
        logger.warning(f"Index 'idx_roomId_updatedAt' may already exist: {e}")
    
    # Index for worker queries (find queued/running jobs)
    try:
        await items_collection.create_index(
            [("status", 1), ("updatedAt", 1)],
            name="idx_status_updatedAt"
        )
        logger.info("✓ Created index on 'items.status + updatedAt'")
    except Exception as e:
        logger.warning(f"Index 'idx_status_updatedAt' may already exist: {e}")
    
    # List all indexes for confirmation
    indexes = await items_collection.list_indexes().to_list(length=None)
    logger.info(f"✓ 'items' collection indexes: {[idx['name'] for idx in indexes]}")
    
    # Create demo room if DEMO_ROOM_ID is not set or room doesn't exist
    rooms_collection = db["rooms"]
    
    if not settings.demo_room_id:
        # Create a new demo room
        demo_room = {
            "name": "Demo Room",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
            "active": True
        }
        result = await rooms_collection.insert_one(demo_room)
        room_id = str(result.inserted_id)
        logger.info(f"✓ Created demo room with ID: {room_id}")
        logger.info(f"  → Add this to your .env file: DEMO_ROOM_ID={room_id}")
    else:
        # Check if the demo room exists
        from bson import ObjectId
        try:
            room = await rooms_collection.find_one({"_id": ObjectId(settings.demo_room_id)})
            if room:
                logger.info(f"✓ Demo room exists: {settings.demo_room_id}")
            else:
                logger.warning(f"⚠ Demo room ID in .env not found: {settings.demo_room_id}")
                logger.info("  → Creating a new demo room...")
                demo_room = {
                    "name": "Demo Room",
                    "createdAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow(),
                    "active": True
                }
                result = await rooms_collection.insert_one(demo_room)
                room_id = str(result.inserted_id)
                logger.info(f"  → New demo room ID: {room_id}")
                logger.info(f"  → Update your .env file: DEMO_ROOM_ID={room_id}")
        except Exception as e:
            logger.error(f"✗ Invalid DEMO_ROOM_ID format: {e}")
    
    logger.info("\n✓ Database setup complete!")
    return True


async def main():
    """Run database setup."""
    try:
        success = await setup_database()
        if success:
            logger.info("\n✓ You can now start the Pinterest board watcher.")
    except Exception as e:
        logger.error(f"\n✗ Database setup failed: {e}")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
