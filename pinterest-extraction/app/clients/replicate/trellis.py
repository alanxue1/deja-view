"""
Replicate Trellis 3D model generation client.

Takes an image and generates a .glb 3D model using the Trellis model.
"""

import logging
import base64
import os
import asyncio
from typing import Optional

import replicate

from app.settings import settings


logger = logging.getLogger(__name__)


def build_trellis_input(image_bytes: bytes, mime_type: str = "image/png") -> dict:
    """
    Build input dict for Trellis model from image bytes.
    
    Args:
        image_bytes: Image file bytes
        mime_type: MIME type of the image (e.g., "image/png")
        
    Returns:
        Dict containing Trellis model input parameters
    """
    # Encode image as base64 data URI
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    data_uri = f"data:{mime_type};base64,{b64}"
    
    return {
        "images": [data_uri],
        "texture_size": 2048,
        "mesh_simplify": 0.9,
        "generate_model": True,
        "save_gaussian_ply": False,  # Only generate .glb for now
        "ss_sampling_steps": 38,
    }


async def run_trellis_and_get_model_url(image_bytes: bytes) -> str:
    """
    Run Trellis model on image bytes and return the model file URL.
    
    Args:
        image_bytes: PNG image bytes (transparent background recommended)
        
    Returns:
        URL to the generated .glb model file
        
    Raises:
        ValueError: If API token not configured or no model file in output
        Exception: If Replicate API call fails
    """
    if not settings.replicate_api_token:
        raise ValueError("REPLICATE_API_TOKEN not configured")
    
    # Set environment variable for Replicate SDK
    os.environ["REPLICATE_API_TOKEN"] = settings.replicate_api_token
    
    # Build input
    input_data = build_trellis_input(image_bytes, mime_type="image/png")
    
    logger.info(
        f"Running Trellis model: version={settings.replicate_trellis_version}"
    )
    
    def _run_replicate():
        """Blocking call to replicate.run()"""
        return replicate.run(settings.replicate_trellis_version, input=input_data)
    
    try:
        # Run in thread pool to avoid blocking event loop
        output = await asyncio.to_thread(_run_replicate)
        
        # Extract model_file URL from output
        model_url = None
        
        if isinstance(output, dict):
            # Output is a dict with keys like "model_file", "gaussian_ply", etc.
            model_file = output.get("model_file")
            if model_file:
                # model_file might be a FileOutput object with .url attribute
                if hasattr(model_file, "url"):
                    model_url = model_file.url
                else:
                    model_url = model_file
        else:
            # Output might be a FileOutput object directly
            if hasattr(output, "url"):
                model_url = output.url
            else:
                model_url = output
        
        if not model_url:
            logger.error(f"No model_file in Replicate output: {output}")
            raise ValueError(f"No model_file found in Replicate output: {output}")
        
        logger.info(f"Trellis generation succeeded: {model_url}")
        
        return model_url
        
    except Exception as e:
        logger.error(f"Trellis generation failed: {e}")
        raise Exception(f"Failed to generate 3D model with Trellis: {e}")
