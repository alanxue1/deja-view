"""
Gemini API client for Nano Banana image generation.

One-shot image generation: takes an input image + item description,
returns a transparent PNG of just the described item.

See: https://ai.google.dev/gemini-api/docs/image-generation
"""

import logging
import base64
from typing import Optional
from google import genai
from google.genai import types
import io

from app.settings import settings


logger = logging.getLogger(__name__)


class GeminiClient:
    """Client for Gemini Nano Banana image generation."""
    
    def __init__(self):
        """Initialize Gemini client with API key."""
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY not configured")
        
        # Initialize the new google-genai client
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.default_model = settings.gemini_image_model
    
    async def extract_item_transparent(
        self,
        image_bytes: bytes,
        item_description: str,
        model_override: Optional[str] = None,
        max_output_pixels: Optional[int] = None
    ) -> bytes:
        """
        Extract a single item from an image and return it on transparent background.
        
        Args:
            image_bytes: Input image bytes
            item_description: Description of item to extract (e.g., "red handbag")
            model_override: Override default Gemini model
            max_output_pixels: Max dimension for output image
            
        Returns:
            PNG image bytes with transparent background
            
        Raises:
            ValueError: If generation fails or returns no image
        """
        model_name = model_override or self.default_model
        
        # Encode image as base64
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        
        # Prepare prompt for one-shot extraction (text-and-image-to-image)
        prompt_text = f"""Extract and return ONLY the following item from this image: {item_description}

Requirements:
- Return the item as a standalone image
- Use a transparent background (PNG with alpha channel)
- Center the item in the frame
- Remove all other objects and background elements completely
- Preserve the item's original appearance, colors, and details exactly
- Do not add any text, labels, watermarks, or extra elements
- Keep only the described item, nothing else"""
        
        # Build contents with text + inline image data
        contents = [
            {"text": prompt_text},
            {
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": base64_image,
                }
            }
        ]
        
        logger.info(
            f"Generating extracted item with Gemini Nano Banana: model={model_name}, "
            f"description='{item_description}'"
        )
        
        try:
            # Call Gemini API using the new SDK pattern
            response = self.client.models.generate_content(
                model=model_name,
                contents=contents,
            )
            
            # Extract image from response parts
            if hasattr(response, 'candidates') and len(response.candidates) > 0:
                parts = response.candidates[0].content.parts
                for part in parts:
                    if hasattr(part, 'inline_data') and part.inline_data is not None:
                        # Decode base64 image data
                        image_data = part.inline_data.data
                        if isinstance(image_data, str):
                            image_bytes_out = base64.b64decode(image_data)
                        else:
                            image_bytes_out = image_data
                        
                        logger.info(f"Successfully generated image: {len(image_bytes_out)} bytes")
                        return image_bytes_out
                    elif hasattr(part, 'text') and part.text:
                        logger.info(f"Gemini text response: {part.text[:200]}...")
            
            # Also check response.parts directly (alternative API pattern)
            if hasattr(response, 'parts'):
                for part in response.parts:
                    if hasattr(part, 'inline_data') and part.inline_data is not None:
                        # Use as_image() if available, otherwise decode manually
                        if hasattr(part, 'as_image'):
                            from PIL import Image
                            pil_image = part.as_image()
                            output_buffer = io.BytesIO()
                            pil_image.save(output_buffer, format='PNG')
                            return output_buffer.getvalue()
                        else:
                            image_data = part.inline_data.data
                            if isinstance(image_data, str):
                                return base64.b64decode(image_data)
                            return image_data
            
            logger.error("No image in Gemini response")
            raise ValueError("Gemini returned no image data - model may not support this operation")
            
        except Exception as e:
            logger.error(f"Gemini image generation failed: {e}")
            raise ValueError(f"Failed to generate image with Gemini: {e}")
