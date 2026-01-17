"""
Gemini API client for Nano Banana image generation.

One-shot image generation: takes an input image + item description,
returns a transparent PNG of just the described item.
"""

import logging
from typing import Optional
import google.generativeai as genai
from PIL import Image
import io

from app.settings import settings


logger = logging.getLogger(__name__)


class GeminiClient:
    """Client for Gemini Nano Banana image generation."""
    
    def __init__(self):
        """Initialize Gemini client with API key."""
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY not configured")
        
        genai.configure(api_key=settings.gemini_api_key)
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
        
        # Prepare prompt for one-shot extraction
        prompt = f"""Extract and return ONLY the following item from this image: {item_description}

Requirements:
- Return the item as a standalone image
- Use a transparent background (PNG with alpha channel)
- Center the item
- Remove all other objects and background elements
- Preserve the item's original appearance, colors, and details
- Do not add any text, labels, or extra elements"""
        
        logger.info(
            f"Generating extracted item with Gemini: model={model_name}, "
            f"description='{item_description}'"
        )
        
        try:
            # Load image from bytes
            input_image = Image.open(io.BytesIO(image_bytes))
            
            # Get the generative model
            model = genai.GenerativeModel(model_name)
            
            # Generate content with image + prompt
            # Note: Gemini's generate_content should support image inputs
            response = model.generate_content(
                [prompt, input_image],
                generation_config=genai.GenerationConfig(
                    response_mime_type="image/png"
                )
            )
            
            # Extract image from response
            # The exact API may vary; adjust based on actual google-genai SDK
            if hasattr(response, 'image'):
                # If response has image directly
                result_image = response.image
            elif hasattr(response, 'parts') and len(response.parts) > 0:
                # If response has parts with image data
                for part in response.parts:
                    if hasattr(part, 'inline_data'):
                        image_data = part.inline_data.data
                        return image_data
            else:
                logger.error("No image in Gemini response")
                raise ValueError("Gemini returned no image data")
            
            # Convert PIL image to PNG bytes if needed
            if isinstance(result_image, Image.Image):
                output_buffer = io.BytesIO()
                result_image.save(output_buffer, format='PNG')
                return output_buffer.getvalue()
            
            logger.error("Unexpected response format from Gemini")
            raise ValueError("Could not extract image from Gemini response")
            
        except Exception as e:
            logger.error(f"Gemini image generation failed: {e}")
            raise ValueError(f"Failed to generate image with Gemini: {e}")
