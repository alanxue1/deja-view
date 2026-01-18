from abc import ABC, abstractmethod
from typing import Optional
from app.api.schemas import PinAnalysis


class LLMProvider(ABC):
    """
    Abstract base class for LLM providers.
    
    Implementations must analyze pin images and return structured furniture data.
    """
    
    @abstractmethod
    async def analyze_pin(
        self,
        image_url: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        alt_text: Optional[str] = None,
        link: Optional[str] = None,
        model_override: Optional[str] = None,
        temperature_override: Optional[float] = None,
        reasoning_effort_override: Optional[str] = None,
        verbosity_override: Optional[str] = None,
        max_output_tokens_override: Optional[int] = None
    ) -> PinAnalysis:
        """
        Analyze a pin image and extract furniture information.
        
        Args:
            image_url: URL of the pin image to analyze
            title: Pin title (optional context)
            description: Pin description (optional context)
            alt_text: Pin alt text (optional context)
            link: Pin link (optional context)
            model_override: Override default model
            temperature_override: Override default temperature
            reasoning_effort_override: Override reasoning effort
            verbosity_override: Override verbosity
            max_output_tokens_override: Override max output tokens
            
        Returns:
            PinAnalysis with the main item and its details
            
        Raises:
            Exception: If analysis fails
        """
        pass
