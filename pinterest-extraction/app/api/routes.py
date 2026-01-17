import logging
from fastapi import APIRouter, HTTPException

from app.api.schemas import AnalyzeRequest, AnalyzeResponse, AnalyzedPin
from app.clients.scraper import PinterestScraper
from app.clients.llm.registry import get_llm_provider


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
