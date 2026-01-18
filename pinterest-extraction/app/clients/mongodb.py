"""
MongoDB client for async database operations.
"""

import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.settings import settings


logger = logging.getLogger(__name__)


class MongoDBClient:
    """Async MongoDB client wrapper using motor."""
    
    _client: Optional[AsyncIOMotorClient] = None
    _db: Optional[AsyncIOMotorDatabase] = None
    
    @classmethod
    def get_client(cls) -> AsyncIOMotorClient:
        """Get or create MongoDB client."""
        if cls._client is None:
            if not settings.mongodb_atlas_uri:
                raise ValueError("MONGODB_ATLAS_URI not configured in environment")
            
            cls._client = AsyncIOMotorClient(
                settings.mongodb_atlas_uri,
                maxPoolSize=10,
                minPoolSize=1,
                serverSelectionTimeoutMS=5000,
            )
            logger.info("MongoDB client initialized")
        
        return cls._client
    
    @classmethod
    def get_db(cls) -> AsyncIOMotorDatabase:
        """Get database instance."""
        if cls._db is None:
            client = cls.get_client()
            cls._db = client[settings.mongodb_db]
            logger.info(f"MongoDB database '{settings.mongodb_db}' connected")
        
        return cls._db
    
    @classmethod
    async def close(cls):
        """Close MongoDB connection."""
        if cls._client:
            cls._client.close()
            cls._client = None
            cls._db = None
            logger.info("MongoDB client closed")
    
    @classmethod
    async def ping(cls) -> bool:
        """Check if MongoDB is reachable."""
        try:
            client = cls.get_client()
            await client.admin.command('ping')
            return True
        except Exception as e:
            logger.error(f"MongoDB ping failed: {e}")
            return False


# Convenience functions
def get_db() -> AsyncIOMotorDatabase:
    """Get MongoDB database instance."""
    return MongoDBClient.get_db()


async def close_db():
    """Close MongoDB connection."""
    await MongoDBClient.close()
