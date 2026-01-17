import logging
from fastapi import APIRouter, Header, HTTPException
from typing import Optional

from app.api.schemas import AnalyzeRequest, AnalyzeResponse, AnalyzedPin, PinAnalysis, ScrapeAnalyzeRequest
from app.clients.pinterest import PinterestClient, PinterestAuthError, PinterestRateLimitError, PinterestAPIError
from app.clients.scraper import PinterestScraper
from app.clients.llm.registry import get_llm_provider
from app.settings import settings


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1")


@router.post("/boards/{board_id}/pins/analyze", response_model=AnalyzeResponse)
async def analyze_board_pins(
    board_id: str,
    request: AnalyzeRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Analyze pins from a Pinterest board.
    
    Requires a valid Pinterest OAuth access token in the Authorization header.
    Fetches up to max_pins from the board and analyzes each with an LLM to extract
    furniture and decor information suitable for 3D model generation.
    """
    # Validate authorization
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header. Expected: 'Bearer <pinterest_token>'"
        )
    
    pinterest_token = authorization.replace("Bearer ", "").strip()
    
    if not pinterest_token:
        raise HTTPException(status_code=401, detail="Empty access token")
    
    logger.info(
        f"Starting analysis for board {board_id}, "
        f"max_pins={request.max_pins}, page_size={request.page_size}"
    )
    
    # Initialize LLM provider
    try:
        llm_provider = get_llm_provider()
    except ValueError as e:
        logger.error(f"Failed to initialize LLM provider: {e}")
        raise HTTPException(status_code=500, detail=f"LLM provider error: {e}")
    
    # Fetch pins from Pinterest
    pins_data = []
    try:
        async with PinterestClient(pinterest_token) as pinterest_client:
            pins_data = await pinterest_client.fetch_all_pins(
                board_id=board_id,
                max_pins=request.max_pins,
                page_size=request.page_size
            )
    except PinterestAuthError as e:
        logger.error(f"Pinterest auth error: {e}")
        raise HTTPException(status_code=403, detail=str(e))
    except PinterestRateLimitError as e:
        logger.error(f"Pinterest rate limit: {e}")
        raise HTTPException(status_code=429, detail=str(e))
    except PinterestAPIError as e:
        logger.error(f"Pinterest API error: {e}")
        raise HTTPException(status_code=502, detail=f"Pinterest API error: {e}")
    
    if not pins_data:
        logger.info(f"No pins found for board {board_id}")
        return AnalyzeResponse(
            board_id=board_id,
            num_pins_fetched=0,
            num_pins_analyzed=0,
            num_pins_skipped=0,
            pins=[]
        )
    
    logger.info(f"Fetched {len(pins_data)} pins, starting analysis")
    
    # Analyze each pin
    analyzed_pins = []
    num_analyzed = 0
    num_skipped = 0
    
    for pin_data in pins_data:
        # Check if we have an image URL
        if not pin_data.image_url:
            logger.warning(f"Pin {pin_data.pin_id} has no image URL, skipping")
            analyzed_pins.append(AnalyzedPin(
                pin_id=pin_data.pin_id,
                board_id=pin_data.board_id,
                image_url="",
                pinterest_description=pin_data.description,
                title=pin_data.title,
                alt_text=pin_data.alt_text,
                link=pin_data.link,
                created_at=pin_data.created_at,
                skipped=True,
                skip_reason="No image URL found",
                pinterest_raw=pin_data.raw_data if request.include_pinterest_raw else None
            ))
            num_skipped += 1
            continue
        
        # Analyze with LLM
        try:
            analysis = await llm_provider.analyze_pin(
                image_url=pin_data.image_url,
                title=pin_data.title,
                description=pin_data.description,
                alt_text=pin_data.alt_text,
                link=pin_data.link,
                model_override=request.llm_model,
                temperature_override=request.llm_temperature,
                reasoning_effort_override=request.llm_reasoning_effort,
                verbosity_override=request.llm_verbosity,
                max_output_tokens_override=request.llm_max_output_tokens
            )
            
            analyzed_pins.append(AnalyzedPin(
                pin_id=pin_data.pin_id,
                board_id=pin_data.board_id,
                image_url=pin_data.image_url,
                pinterest_description=pin_data.description,
                title=pin_data.title,
                alt_text=pin_data.alt_text,
                link=pin_data.link,
                created_at=pin_data.created_at,
                analysis=analysis,
                skipped=False,
                pinterest_raw=pin_data.raw_data if request.include_pinterest_raw else None
            ))
            num_analyzed += 1
            logger.info(f"Successfully analyzed pin {pin_data.pin_id}")
            
        except Exception as e:
            logger.error(f"Failed to analyze pin {pin_data.pin_id}: {e}")
            analyzed_pins.append(AnalyzedPin(
                pin_id=pin_data.pin_id,
                board_id=pin_data.board_id,
                image_url=pin_data.image_url,
                pinterest_description=pin_data.description,
                title=pin_data.title,
                alt_text=pin_data.alt_text,
                link=pin_data.link,
                created_at=pin_data.created_at,
                skipped=True,
                skip_reason=f"LLM analysis failed: {str(e)}",
                pinterest_raw=pin_data.raw_data if request.include_pinterest_raw else None
            ))
            num_skipped += 1
    
    logger.info(
        f"Analysis complete: {num_analyzed} analyzed, {num_skipped} skipped "
        f"out of {len(pins_data)} total"
    )
    
    return AnalyzeResponse(
        board_id=board_id,
        num_pins_fetched=len(pins_data),
        num_pins_analyzed=num_analyzed,
        num_pins_skipped=num_skipped,
        pins=analyzed_pins
    )


@router.post("/scrape/analyze", response_model=AnalyzeResponse)
async def scrape_and_analyze(request: ScrapeAnalyzeRequest):
    """
    Scrape pins from a PUBLIC Pinterest board and analyze them.
    
    NO API TOKEN REQUIRED - uses web scraping to extract pin images.
    Works with public boards when API access is unavailable.
    
    Limitations vs API mode:
    - Only works with public boards
    - Limited metadata (no descriptions, titles from Pinterest)
    - May break if Pinterest changes their page structure
    """
    logger.info(f"Starting scrape analysis for board: {request.board_url}, max_pins={request.max_pins}")
    
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
    
    logger.info(f"Scraped {len(scraped_pins)} pins, starting analysis")
    
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
                temperature_override=request.llm_temperature,
                reasoning_effort_override=request.llm_reasoning_effort,
                verbosity_override=request.llm_verbosity,
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
        f"Scrape analysis complete: {num_analyzed} analyzed, {num_skipped} skipped "
        f"out of {len(scraped_pins)} total"
    )
    
    return AnalyzeResponse(
        board_id=request.board_url,
        num_pins_fetched=len(scraped_pins),
        num_pins_analyzed=num_analyzed,
        num_pins_skipped=num_skipped,
        pins=analyzed_pins
    )
