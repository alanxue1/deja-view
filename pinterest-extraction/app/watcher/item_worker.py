"""
Item worker - processes queued items and generates 3D models.
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional

from app.clients.mongodb import get_db
from app.clients.llm.registry import get_llm_provider
from app.clients.gemini.client import GeminiClient
from app.clients.storage.r2 import R2Client
from app.clients.replicate.trellis import run_trellis_and_get_model_url
from app.utils.http import create_http_client


logger = logging.getLogger(__name__)


class ItemWorker:
    """
    Processes queued items: analyzes with LLM, extracts PNG, generates 3D model.
    """
    
    def __init__(self, max_concurrent: int = 3):
        self.max_concurrent = max_concurrent
        self._running = False
        self._semaphore = asyncio.Semaphore(max_concurrent)
    
    async def start(self):
        """Start processing queued items."""
        self._running = True
        logger.info(f"Starting item worker (max {self.max_concurrent} concurrent jobs)")
        
        while self._running:
            try:
                await self._process_next_item()
            except Exception as e:
                logger.error(f"Item processing error: {e}")
            
            # Brief pause before checking for next item
            await asyncio.sleep(1)
    
    def stop(self):
        """Stop the worker."""
        self._running = False
        logger.info("Item worker stopped")
    
    async def _process_next_item(self):
        """Claim and process the next queued item."""
        db = get_db()
        items_collection = db["items"]
        
        # Atomically claim a queued item
        item = await items_collection.find_one_and_update(
            {"status": "queued"},
            {
                "$set": {
                    "status": "running",
                    "startedAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow()
                }
            },
            sort=[("createdAt", 1)],  # FIFO
            return_document=True  # Return updated document
        )
        
        if not item:
            # No queued items, wait a bit
            await asyncio.sleep(2)
            return
        
        item_id = str(item["_id"])
        pin_id = item["source"]["pinId"]
        image_url = item["source"]["imageUrl"]
        
        logger.info(f"Processing item {item_id} (pin {pin_id})")
        
        # Acquire semaphore for concurrent control
        async with self._semaphore:
            try:
                await self._process_item(item_id, image_url, items_collection)
            except Exception as e:
                logger.error(f"Failed to process item {item_id}: {e}")
                # Mark as failed
                await items_collection.update_one(
                    {"_id": item["_id"]},
                    {
                        "$set": {
                            "status": "failed",
                            "error": str(e),
                            "updatedAt": datetime.utcnow()
                        }
                    }
                )
    
    async def _process_item(self, item_id: str, image_url: str, items_collection):
        """
        Process a single item:
        1. Analyze with LLM to get item description
        2. Extract item PNG with Gemini
        3. Upload PNG to R2
        4. Generate 3D model with Trellis
        5. Download and upload GLB to R2
        6. Update item with asset URLs
        """
        
        # Step 1: Analyze with LLM to get item description
        logger.info(f"Item {item_id}: Analyzing with LLM")
        try:
            llm_provider = get_llm_provider()
            analysis = await llm_provider.analyze_pin(
                image_url=image_url,
                title=None,
                description=None,
                alt_text=None,
                link=None
            )
            item_description = analysis.main_item
            logger.info(f"Item {item_id}: Detected '{item_description}'")
        except Exception as e:
            logger.error(f"Item {item_id}: LLM analysis failed: {e}")
            item_description = "furniture item"  # Fallback
            analysis = None
        
        # Step 2: Download Pinterest image
        logger.info(f"Item {item_id}: Downloading image from {image_url}")
        async with create_http_client() as http_client:
            response = await http_client.get(image_url)
            response.raise_for_status()
            source_image_bytes = response.content
        
        logger.info(f"Item {item_id}: Downloaded {len(source_image_bytes)} bytes")
        
        # Step 3: Extract item with Gemini
        logger.info(f"Item {item_id}: Extracting item with Gemini")
        gemini_client = GeminiClient()
        extracted_image_bytes = await gemini_client.extract_item_transparent(
            image_bytes=source_image_bytes,
            item_description=item_description
        )
        
        logger.info(f"Item {item_id}: Extracted {len(extracted_image_bytes)} bytes")
        
        # Step 4: Upload PNG to R2
        logger.info(f"Item {item_id}: Uploading PNG to R2")
        r2_client = R2Client()
        png_object_key, png_public_url = r2_client.upload_image(
            image_bytes=extracted_image_bytes,
            content_type="image/png",
            key_prefix="items"
        )
        
        logger.info(f"Item {item_id}: PNG uploaded to {png_public_url}")
        
        # Step 5: Generate .glb with Trellis
        logger.info(f"Item {item_id}: Generating 3D model with Trellis")
        model_url = await run_trellis_and_get_model_url(extracted_image_bytes)
        
        logger.info(f"Item {item_id}: Model generated at {model_url}")
        
        # Step 6: Download .glb
        logger.info(f"Item {item_id}: Downloading .glb from {model_url}")
        async with create_http_client(timeout=300) as http_client:
            response = await http_client.get(model_url)
            response.raise_for_status()
            glb_bytes = response.content
        
        logger.info(f"Item {item_id}: Downloaded {len(glb_bytes)} bytes")
        
        # Step 7: Upload .glb to R2
        logger.info(f"Item {item_id}: Uploading .glb to R2")
        glb_object_key, glb_public_url = r2_client.upload_bytes(
            data=glb_bytes,
            content_type="model/gltf-binary",
            extension="glb",
            key_prefix="models"
        )
        
        logger.info(f"Item {item_id}: .glb uploaded to {glb_public_url}")
        
        # Step 8: Update item in MongoDB
        update_doc = {
            "status": "ready",
            "asset": {
                "glbUrl": glb_public_url,
                "extractedPngUrl": png_public_url
            },
            "processedAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        if analysis:
            update_doc["analysis"] = {
                "main_item": analysis.main_item,
                "description": analysis.description,
                "style": analysis.style,
                "materials": analysis.materials,
                "colors": analysis.colors,
                "confidence": analysis.confidence
            }
        
        from bson import ObjectId
        await items_collection.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": update_doc}
        )
        
        logger.info(f"Item {item_id}: Processing complete!")
