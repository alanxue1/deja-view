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
    style: Optional[str] = Field(None, description="Style description")
    materials: List[str] = Field(default_factory=list, description="Detected materials")
    colors: List[str] = Field(default_factory=list, description="Detected colors")
    notes: Optional[str] = Field(None, description="Additional observations")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")


class PinAnalysis(BaseModel):
    """LLM-generated analysis of a pin."""
    description: str = Field(..., description="LLM-generated description for 3D model generation")
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
