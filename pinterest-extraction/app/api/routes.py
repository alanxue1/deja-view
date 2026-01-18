import logging
import asyncio
from typing import List
from fastapi import APIRouter, HTTPException

from app.api.schemas import (
    AnalyzeRequest, AnalyzeResponse, AnalyzedPin,
    AnalyzeJobStartResponse, AnalyzeJobStatusResponse, AnalyzeJobProgress,
    ExtractItemImageRequest, ExtractItemImageResponse,
    ExtractItem3DRequest, ExtractItem3DJobStartResponse,
    ExtractItem3DJobStatusResponse, ExtractItem3DResult
)
from app.clients.scraper import PinterestScraper
from app.clients.llm.registry import get_llm_provider
from app.clients.gemini.client import GeminiClient
from app.clients.storage.r2 import R2Client
from app.clients.replicate.trellis import run_trellis_and_get_model_url
from app.utils.http import create_http_client
from app.jobs.store import get_job_store, STATUS_QUEUED, STATUS_RUNNING, STATUS_SUCCEEDED, STATUS_FAILED


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1")

ANALYZE_CONCURRENCY = 4  # Bounded parallelism for pin analysis


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


@router.post("/analyze-job", response_model=AnalyzeJobStartResponse)
async def start_analyze_job(request: AnalyzeRequest):
    """
    Start an async job to analyze pins from a board without hitting request timeouts.
    
    Returns immediately with job_id. Poll /analyze-job/{job_id} for status and progress.
    """
    logger.info(f"Creating analyze job for board: {request.board_url}, max_pins={request.max_pins}")
    
    # Validate LLM provider up front so we fail fast if misconfigured
    try:
        _ = get_llm_provider()
    except ValueError as e:
        logger.error(f"Failed to initialize LLM provider: {e}")
        raise HTTPException(status_code=500, detail=f"LLM provider error: {e}")
    
    # Create job
    job_store = get_job_store()
    job_id = await job_store.create_job({
        "board_url": request.board_url,
        "max_pins": request.max_pins,
        "llm_model": request.llm_model,
        "llm_reasoning_effort": request.llm_reasoning_effort,
        "llm_max_output_tokens": request.llm_max_output_tokens,
    })
    
    # Kick off background processing
    asyncio.create_task(_process_analyze_job(job_id, request))
    
    logger.info(f"Analyze job created: {job_id}")
    return AnalyzeJobStartResponse(job_id=job_id)


@router.get("/analyze-job/{job_id}", response_model=AnalyzeJobStatusResponse)
async def get_analyze_job_status(job_id: str):
    """
    Get status/progress of an analyze job.
    """
    job_store = get_job_store()
    job = await job_store.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    progress = None
    result_model = None
    
    if job.result:
        # Extract progress if present
        progress_data = job.result.get("progress")
        if progress_data:
            progress = AnalyzeJobProgress(**progress_data)
        
        # Parse analyze result if available
        if all(key in job.result for key in ("board_id", "num_pins_fetched", "num_pins_analyzed", "num_pins_skipped", "pins")):
            try:
                result_model = AnalyzeResponse(
                    board_id=job.result["board_id"],
                    num_pins_fetched=job.result["num_pins_fetched"],
                    num_pins_analyzed=job.result["num_pins_analyzed"],
                    num_pins_skipped=job.result["num_pins_skipped"],
                    pins=[AnalyzedPin(**pin) if not isinstance(pin, AnalyzedPin) else pin for pin in job.result["pins"]],
                )
            except Exception as e:
                logger.error(f"Failed to parse analyze job result for {job_id}: {e}")
    
    response_data = {
        "job_id": job.job_id,
        "status": job.status,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "error": job.error,
        "progress": progress,
        "result": result_model
    }
    
    return AnalyzeJobStatusResponse(**response_data)


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


@router.post("/extract-item-3d", response_model=ExtractItem3DJobStartResponse)
async def extract_item_3d(request: ExtractItem3DRequest):
    """
    Start an async job to extract an item and generate a 3D model.
    
    Takes a direct Pinterest image URL and item description, extracts a transparent PNG
    using Gemini Nano Banana, generates a .glb 3D model using Replicate Trellis,
    uploads both to Cloudflare R2, and returns a job_id for polling.
    
    Returns immediately with job_id. Poll /extract-item-3d/{job_id} for status.
    """
    logger.info(
        f"Starting 3D extraction job: image_url={request.image_url}, "
        f"item='{request.item_description}'"
    )
    
    # Validate image URL
    if not request.image_url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400,
            detail="image_url must be a valid HTTP(S) URL"
        )
    
    # Create job in store
    job_store = get_job_store()
    job_id = await job_store.create_job({
        "image_url": request.image_url,
        "item_description": request.item_description,
        "model_image": request.model_image,
        "max_output_pixels": request.max_output_pixels
    })
    
    # Start background processing
    asyncio.create_task(_process_3d_job(job_id, request))
    
    logger.info(f"Created 3D extraction job: {job_id}")
    
    return ExtractItem3DJobStartResponse(job_id=job_id)


@router.get("/extract-item-3d/{job_id}", response_model=ExtractItem3DJobStatusResponse)
async def get_extract_item_3d_status(job_id: str):
    """
    Get status of a 3D extraction job.
    
    Returns job status and result (if succeeded) or error (if failed).
    """
    job_store = get_job_store()
    job = await job_store.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    # Build response
    response_data = {
        "job_id": job.job_id,
        "status": job.status,
        "created_at": job.created_at,
        "updated_at": job.updated_at
    }
    
    if job.error:
        response_data["error"] = job.error
    
    if job.result:
        response_data["result"] = ExtractItem3DResult(**job.result)
    
    return ExtractItem3DJobStatusResponse(**response_data)


async def _process_3d_job(job_id: str, request: ExtractItem3DRequest):
    """
    Background task to process a 3D extraction job.
    
    Steps:
    1. Download Pinterest image
    2. Extract item PNG with Gemini
    3. Upload PNG to R2
    4. Generate .glb with Trellis
    5. Download .glb
    6. Upload .glb to R2
    7. Update job with result
    """
    job_store = get_job_store()
    
    try:
        # Acquire processing slot (concurrency control)
        await job_store.acquire_slot()
        
        # Update status to running
        await job_store.update_job_status(job_id, STATUS_RUNNING)
        logger.info(f"Job {job_id}: starting processing")
        
        # Step 1: Download Pinterest image
        logger.info(f"Job {job_id}: downloading image from {request.image_url}")
        async with create_http_client() as http_client:
            response = await http_client.get(request.image_url)
            response.raise_for_status()
            source_image_bytes = response.content
        
        logger.info(f"Job {job_id}: downloaded {len(source_image_bytes)} bytes")
        
        # Step 2: Extract item with Gemini
        logger.info(f"Job {job_id}: extracting item with Gemini")
        gemini_client = GeminiClient()
        extracted_image_bytes = await gemini_client.extract_item_transparent(
            image_bytes=source_image_bytes,
            item_description=request.item_description,
            model_override=request.model_image,
            max_output_pixels=request.max_output_pixels
        )
        
        logger.info(f"Job {job_id}: extracted {len(extracted_image_bytes)} bytes")
        
        # Step 3: Upload PNG to R2
        logger.info(f"Job {job_id}: uploading PNG to R2")
        r2_client = R2Client()
        png_object_key, png_public_url = r2_client.upload_image(
            image_bytes=extracted_image_bytes,
            content_type="image/png",
            key_prefix="items"
        )
        
        logger.info(f"Job {job_id}: PNG uploaded to {png_public_url}")
        
        # Step 4: Generate .glb with Trellis
        logger.info(f"Job {job_id}: generating 3D model with Trellis")
        model_url = await run_trellis_and_get_model_url(extracted_image_bytes)
        
        logger.info(f"Job {job_id}: model generated at {model_url}")
        
        # Step 5: Download .glb
        logger.info(f"Job {job_id}: downloading .glb from {model_url}")
        async with create_http_client(timeout=300) as http_client:  # 5 min timeout for large files
            response = await http_client.get(model_url)
            response.raise_for_status()
            glb_bytes = response.content
        
        logger.info(f"Job {job_id}: downloaded {len(glb_bytes)} bytes")
        
        # Step 6: Upload .glb to R2
        logger.info(f"Job {job_id}: uploading .glb to R2")
        glb_object_key, glb_public_url = r2_client.upload_bytes(
            data=glb_bytes,
            content_type="model/gltf-binary",
            extension="glb",
            key_prefix="models"
        )
        
        logger.info(f"Job {job_id}: .glb uploaded to {glb_public_url}")
        
        # Step 7: Update job with result
        result = {
            "source_image_url": request.image_url,
            "item_description": request.item_description,
            "result_image_url": png_public_url,
            "result_image_r2_key": png_object_key,
            "model_glb_url": glb_public_url,
            "model_glb_r2_key": glb_object_key
        }
        
        await job_store.update_job_status(job_id, STATUS_SUCCEEDED, result=result)
        logger.info(f"Job {job_id}: completed successfully")
        
    except Exception as e:
        logger.error(f"Job {job_id}: failed with error: {e}")
        await job_store.update_job_status(
            job_id,
            STATUS_FAILED,
            error=str(e)
        )
    
    finally:
        # Release processing slot
        job_store.release_slot()
        logger.info(f"Job {job_id}: released processing slot")


async def _process_analyze_job(job_id: str, request: AnalyzeRequest):
    """
    Background task to analyze a board's pins with bounded parallelism.
    """
    job_store = get_job_store()
    
    try:
        await job_store.acquire_slot()
        await job_store.update_job_status(job_id, STATUS_RUNNING)
        logger.info(f"Analyze job {job_id}: starting")
        
        # Initialize dependencies
        try:
            llm_provider = get_llm_provider()
        except Exception as e:
            logger.error(f"Analyze job {job_id}: LLM init failed: {e}")
            raise
        
        # Scrape pins
        scraped_pins = []
        try:
            async with PinterestScraper() as scraper:
                scraped_pins = await scraper.scrape_board(
                    board_url=request.board_url,
                    max_pins=request.max_pins
                )
        except Exception as e:
            logger.error(f"Analyze job {job_id}: scraping failed: {e}")
            raise HTTPException(
                status_code=502,
                detail=f"Failed to scrape board. Make sure it's a valid public Pinterest board URL. Error: {e}"
            )
        
        if not scraped_pins:
            empty_result = {
                "board_id": request.board_url,
                "num_pins_fetched": 0,
                "num_pins_analyzed": 0,
                "num_pins_skipped": 0,
                "pins": [],
                "progress": {"pins_completed": 0, "pins_total": 0}
            }
            await job_store.update_job_status(job_id, STATUS_SUCCEEDED, result=empty_result)
            logger.info(f"Analyze job {job_id}: no pins found, completed")
            return
        
        semaphore = asyncio.Semaphore(ANALYZE_CONCURRENCY)
        analyzed_pins: List[AnalyzedPin] = []
        num_analyzed = 0
        num_skipped = 0
        
        async def analyze_single(pin):
            nonlocal num_analyzed, num_skipped
            async with semaphore:
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
                except Exception as e:
                    logger.error(f"Analyze job {job_id}: failed to analyze pin {pin.pin_id}: {e}")
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
                finally:
                    # Emit progress update
                    progress = {
                        "pins_completed": num_analyzed + num_skipped,
                        "pins_total": len(scraped_pins)
                    }
                    partial_result = {
                        "board_id": request.board_url,
                        "num_pins_fetched": len(scraped_pins),
                        "num_pins_analyzed": num_analyzed,
                        "num_pins_skipped": num_skipped,
                        "pins": [pin.dict() for pin in analyzed_pins],
                        "progress": progress
                    }
                    await job_store.update_job_status(
                        job_id,
                        STATUS_RUNNING,
                        result=partial_result
                    )
        
        await asyncio.gather(*(analyze_single(pin) for pin in scraped_pins))
        
        final_progress = {
            "pins_completed": num_analyzed + num_skipped,
            "pins_total": len(scraped_pins)
        }
        final_result = {
            "board_id": request.board_url,
            "num_pins_fetched": len(scraped_pins),
            "num_pins_analyzed": num_analyzed,
            "num_pins_skipped": num_skipped,
            "pins": [pin.dict() for pin in analyzed_pins],
            "progress": final_progress
        }
        
        await job_store.update_job_status(job_id, STATUS_SUCCEEDED, result=final_result)
        logger.info(f"Analyze job {job_id}: completed successfully")
    
    except HTTPException as http_exc:
        await job_store.update_job_status(
            job_id,
            STATUS_FAILED,
            error=str(http_exc.detail)
        )
        logger.error(f"Analyze job {job_id}: failed with HTTP error {http_exc.detail}")
    except Exception as e:
        await job_store.update_job_status(
            job_id,
            STATUS_FAILED,
            error=str(e)
        )
        logger.error(f"Analyze job {job_id}: failed with error: {e}")
    finally:
        job_store.release_slot()
        logger.info(f"Analyze job {job_id}: released processing slot")
