from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    """Request body for analyzing Pinterest pins."""
    board_url: str = Field(..., description="Full Pinterest board URL (e.g., https://pinterest.com/user/board-name/)")
    max_pins: int = Field(default=50, ge=1, le=100, description="Maximum number of pins to analyze")
    llm_model: Optional[str] = Field(default=None, description="Override default LLM model (e.g., gpt-5.2)")
    llm_reasoning_effort: Optional[str] = Field(
        default=None,
        description="Override LLM reasoning effort (low|medium|high)"
    )
    llm_max_output_tokens: Optional[int] = Field(
        default=None,
        ge=64,
        le=8000,
        description="Override LLM max output tokens"
    )


class FurnitureItem(BaseModel):
    """A detected furniture item in the pin."""
    category: str = Field(..., description="chair/sofa/table/lamp/bed/shelving/decor/other")
    identifier: str = Field(..., description="Simple search term for Shopify (e.g., 'brown sofa', 'orange office chair')")
    description: str = Field(..., description="Detailed description for Shopify product search")
    style: Optional[str] = Field(None, description="Style description")
    materials: List[str] = Field(default_factory=list, description="Detected materials")
    colors: List[str] = Field(default_factory=list, description="Detected colors")
    notes: Optional[str] = Field(None, description="Additional observations")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")


class PinAnalysis(BaseModel):
    """LLM-generated analysis of a pin."""
    room_type: Optional[str] = Field(None, description="Detected room type")
    items: List[FurnitureItem] = Field(default_factory=list, description="Detected furniture items")


class AnalyzedPin(BaseModel):
    """A pin with metadata and analysis."""
    # Pinterest metadata
    pin_id: str
    board_id: str
    image_url: str
    pinterest_description: Optional[str] = None
    title: Optional[str] = None
    alt_text: Optional[str] = None
    link: Optional[str] = None
    created_at: Optional[datetime] = None
    
    # Analysis results (present if analysis succeeded)
    analysis: Optional[PinAnalysis] = None
    
    # Failure handling
    skipped: bool = False
    skip_reason: Optional[str] = None
    
    # Raw Pinterest data (if requested)
    pinterest_raw: Optional[dict] = None


class AnalyzeResponse(BaseModel):
    """Response from the analyze endpoint."""
    board_id: str
    num_pins_fetched: int
    num_pins_analyzed: int
    num_pins_skipped: int
    pins: List[AnalyzedPin]


class ExtractItemImageRequest(BaseModel):
    """Request body for extracting an item from a Pinterest image."""
    image_url: str = Field(..., description="Direct Pinterest image URL (e.g., https://i.pinimg.com/...)")
    item_description: str = Field(..., description="Description of the item to extract (e.g., 'red handbag', 'wooden chair')")
    model_image: Optional[str] = Field(default=None, description="Override Gemini image model (e.g., gemini-2.5-flash-image)")
    max_output_pixels: Optional[int] = Field(default=None, ge=256, le=4096, description="Max output image dimension")


class ExtractItemImageResponse(BaseModel):
    """Response from the extract-item-image endpoint."""
    source_image_url: str = Field(..., description="Original Pinterest image URL")
    item_description: str = Field(..., description="Item description that was extracted")
    result_image_url: str = Field(..., description="Public R2 URL to the extracted item image")
    r2_object_key: str = Field(..., description="R2 object key for reference")
    mime_type: Optional[str] = Field(default="image/png", description="MIME type of generated image")
    width: Optional[int] = Field(None, description="Width of generated image in pixels")
    height: Optional[int] = Field(None, description="Height of generated image in pixels")


class ExtractItem3DRequest(BaseModel):
    """Request body for extracting an item and generating a 3D model."""
    image_url: str = Field(..., description="Direct Pinterest image URL (e.g., https://i.pinimg.com/...)")
    item_description: str = Field(..., description="Description of the item to extract (e.g., 'red handbag', 'wooden chair')")
    model_image: Optional[str] = Field(default=None, description="Override Gemini image model (e.g., gemini-2.5-flash-image)")
    max_output_pixels: Optional[int] = Field(default=None, ge=256, le=4096, description="Max output image dimension")


class ExtractItem3DJobStartResponse(BaseModel):
    """Response from starting a 3D extraction job."""
    job_id: str = Field(..., description="Unique job identifier for polling status")


class ExtractItem3DResult(BaseModel):
    """Result data for a successful 3D extraction job."""
    source_image_url: str = Field(..., description="Original Pinterest image URL")
    item_description: str = Field(..., description="Item description that was extracted")
    result_image_url: str = Field(..., description="Public R2 URL to the extracted item PNG")
    result_image_r2_key: str = Field(..., description="R2 object key for the PNG")
    model_glb_url: str = Field(..., description="Public R2 URL to the generated .glb model")
    model_glb_r2_key: str = Field(..., description="R2 object key for the .glb model")


class ExtractItem3DJobStatusResponse(BaseModel):
    """Response from polling a 3D extraction job status."""
    job_id: str = Field(..., description="Unique job identifier")
    status: str = Field(..., description="Job status: queued | running | succeeded | failed | expired")
    created_at: datetime = Field(..., description="Job creation timestamp")
    updated_at: datetime = Field(..., description="Job last update timestamp")
    error: Optional[str] = Field(None, description="Error message if status is failed")
    result: Optional[ExtractItem3DResult] = Field(None, description="Result data if status is succeeded")
