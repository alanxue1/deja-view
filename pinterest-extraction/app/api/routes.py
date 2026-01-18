import logging
from fastapi import APIRouter, HTTPException

from app.api.schemas import (
    AnalyzeRequest, AnalyzeResponse, AnalyzedPin,
    ExtractItemImageRequest, ExtractItemImageResponse
)
from app.clients.scraper import PinterestScraper
from app.clients.llm.registry import get_llm_provider
from app.clients.gemini.client import GeminiClient
from app.clients.storage.r2 import R2Client
from app.utils.http import create_http_client


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1")


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_board(request: AnalyzeRequest):
    """
    Scrape pins from a PUBLIC Pinterest board and analyze them with LLM.
    
    NO API TOKEN REQUIRED - uses web scraping to extract pin images.
    Pass the Pinterest board URL in the request body.
    
    Returns structured furniture/decor data suitable for 3D model generation.
    """
    logger.info(f"Starting analysis for board: {request.board_url}, max_pins={request.max_pins}")
    
    # Initialize LLM provider
    try:
        llm_provider = get_llm_provider()
    except ValueError as e:
        logger.error(f"Failed to initialize LLM provider: {e}")
        raise HTTPException(status_code=500, detail=f"LLM provider error: {e}")
    
    # Scrape pins from the board
    scraped_pins = []
    try:
        async with PinterestScraper() as scraper:
            scraped_pins = await scraper.scrape_board(
                board_url=request.board_url,
                max_pins=request.max_pins
            )
    except Exception as e:
        logger.error(f"Scraping failed: {e}")
        raise HTTPException(
            status_code=502, 
            detail=f"Failed to scrape board. Make sure it's a valid public Pinterest board URL. Error: {e}"
        )
    
    if not scraped_pins:
        logger.info(f"No pins found for board {request.board_url}")
        return AnalyzeResponse(
            board_id=request.board_url,
            num_pins_fetched=0,
            num_pins_analyzed=0,
            num_pins_skipped=0,
            pins=[]
        )
    
    logger.info(f"Scraped {len(scraped_pins)} pins, starting LLM analysis")
    
    # Analyze each pin
    analyzed_pins = []
    num_analyzed = 0
    num_skipped = 0
    
    for pin in scraped_pins:
        try:
            analysis = await llm_provider.analyze_pin(
                image_url=pin.image_url,
                title=pin.title,
                description=pin.description,
                alt_text=None,
                link=None,
                model_override=request.llm_model,
                temperature_override=None,
                reasoning_effort_override=request.llm_reasoning_effort,
                verbosity_override=None,
                max_output_tokens_override=request.llm_max_output_tokens
            )
            
            analyzed_pins.append(AnalyzedPin(
                pin_id=pin.pin_id,
                board_id=request.board_url,
                image_url=pin.image_url,
                pinterest_description=pin.description,
                title=pin.title,
                analysis=analysis,
                skipped=False
            ))
            num_analyzed += 1
            logger.info(f"Successfully analyzed pin {pin.pin_id}")
            
        except Exception as e:
            logger.error(f"Failed to analyze pin {pin.pin_id}: {e}")
            analyzed_pins.append(AnalyzedPin(
                pin_id=pin.pin_id,
                board_id=request.board_url,
                image_url=pin.image_url,
                pinterest_description=pin.description,
                title=pin.title,
                skipped=True,
                skip_reason=f"LLM analysis failed: {str(e)}"
            ))
            num_skipped += 1
    
    logger.info(
        f"Analysis complete: {num_analyzed} analyzed, {num_skipped} skipped "
        f"out of {len(scraped_pins)} total"
    )
    
    return AnalyzeResponse(
        board_id=request.board_url,
        num_pins_fetched=len(scraped_pins),
        num_pins_analyzed=num_analyzed,
        num_pins_skipped=num_skipped,
        pins=analyzed_pins
    )


@router.post("/extract-item-image", response_model=ExtractItemImageResponse)
async def extract_item_image(request: ExtractItemImageRequest):
    """
    Extract a single item from a Pinterest image and generate a transparent PNG.
    
    Takes a direct Pinterest image URL and item description, uses Gemini Nano Banana
    to generate an isolated image of just that item on transparent background,
    uploads to Cloudflare R2, and returns a public URL.
    
    Designed for feeding into 3D model generators.
    """
    logger.info(
        f"Starting item extraction: image_url={request.image_url}, "
        f"item='{request.item_description}'"
    )
    
    # Validate that it's a direct image URL
    if not request.image_url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400,
            detail="image_url must be a valid HTTP(S) URL"
        )
    
    # Download image bytes from Pinterest (in-memory)
    logger.info(f"Downloading image from {request.image_url}")
    try:
        async with create_http_client() as http_client:
            response = await http_client.get(request.image_url)
            response.raise_for_status()
            image_bytes = response.content
            
        logger.info(f"Downloaded {len(image_bytes)} bytes")
        
    except Exception as e:
        logger.error(f"Failed to download image: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to download Pinterest image: {e}"
        )
    
    # Initialize Gemini client
    try:
        gemini_client = GeminiClient()
    except ValueError as e:
        logger.error(f"Failed to initialize Gemini client: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Gemini client initialization failed: {e}"
        )
    
    # Generate isolated item image with transparent background
    logger.info("Calling Gemini to extract item")
    try:
        extracted_image_bytes = await gemini_client.extract_item_transparent(
            image_bytes=image_bytes,
            item_description=request.item_description,
            model_override=request.model_image,
            max_output_pixels=request.max_output_pixels
        )
        
        logger.info(f"Gemini returned {len(extracted_image_bytes)} bytes")
        
    except Exception as e:
        logger.error(f"Gemini extraction failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate extracted image: {e}"
        )
    
    # Initialize R2 client and upload
    try:
        r2_client = R2Client()
    except ValueError as e:
        logger.error(f"Failed to initialize R2 client: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"R2 client initialization failed: {e}"
        )
    
    logger.info("Uploading extracted image to R2")
    try:
        object_key, public_url = r2_client.upload_image(
            image_bytes=extracted_image_bytes,
            content_type="image/png",
            key_prefix="items"
        )
        
        logger.info(f"Upload successful: {public_url}")
        
    except Exception as e:
        logger.error(f"R2 upload failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload to R2: {e}"
        )
    
    # Return response with public URL
    return ExtractItemImageResponse(
        source_image_url=request.image_url,
        item_description=request.item_description,
        result_image_url=public_url,
        r2_object_key=object_key,
        mime_type="image/png"
    )
