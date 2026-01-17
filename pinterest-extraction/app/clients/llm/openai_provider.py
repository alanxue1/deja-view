import json
import logging
from typing import Optional, Any
from openai import AsyncOpenAI

from app.api.schemas import PinAnalysis, FurnitureItem
from app.clients.llm.base import LLMProvider
from app.prompts.furniture import format_prompt, FURNITURE_JSON_SCHEMA
from app.settings import settings


logger = logging.getLogger(__name__)


class OpenAIProvider(LLMProvider):
    """OpenAI-based LLM provider for pin analysis."""
    
    def __init__(self):
        """Initialize OpenAI client."""
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY not configured")
        
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.default_model = settings.openai_model
        self.default_temperature = settings.openai_temperature
        self.default_reasoning_effort = settings.openai_reasoning_effort
        self.default_verbosity = settings.openai_verbosity
        self.default_max_output_tokens = settings.openai_max_output_tokens
    
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
        Analyze a pin image using OpenAI's vision capabilities.
        
        Args:
            image_url: URL of the pin image
            title, description, alt_text, link: Optional context
            model_override: Override default model
            temperature_override: Override default temperature
            
        Returns:
            PinAnalysis with structured furniture data
            
        Raises:
            Exception: If OpenAI API call fails or JSON parsing fails
        """
        model = model_override or self.default_model
        temperature = temperature_override if temperature_override is not None else self.default_temperature
        reasoning_effort = reasoning_effort_override or self.default_reasoning_effort
        verbosity = verbosity_override or self.default_verbosity
        max_output_tokens = max_output_tokens_override or self.default_max_output_tokens
        
        # Format the prompt with context
        prompt = format_prompt(
            title=title,
            description=description,
            alt_text=alt_text,
            link=link
        )
        
        logger.info(f"Analyzing image with OpenAI model={model}, temp={temperature}")
        
        try:
            # Call OpenAI with Responses API (modern practice)
            response = await self.client.responses.create(
                model=model,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": prompt},
                            {"type": "input_image", "image_url": image_url},
                        ],
                    }
                ],
                temperature=temperature,
                reasoning_effort=reasoning_effort,
                verbosity=verbosity,
                max_output_tokens=max_output_tokens,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "furniture_analysis",
                        "schema": FURNITURE_JSON_SCHEMA,
                        "strict": True,
                    },
                },
            )
            
            # Extract the response content
            content = self._get_response_text(response)
            
            if not content:
                raise ValueError("Empty response from OpenAI")
            
            # Parse JSON
            data = json.loads(content)
            
            # Validate and convert to PinAnalysis
            return self._parse_analysis(data)
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from OpenAI: {e}")
            # Retry with a correction prompt
            return await self._retry_with_correction(
                content,
                model,
                temperature,
                reasoning_effort,
                verbosity,
                max_output_tokens
            )
        
        except Exception as e:
            logger.error(f"OpenAI analysis failed: {e}")
            raise
    
    def _parse_analysis(self, data: dict) -> PinAnalysis:
        """
        Parse and validate the JSON response into a PinAnalysis object.
        
        Args:
            data: Parsed JSON dict from LLM
            
        Returns:
            Validated PinAnalysis
            
        Raises:
            ValueError: If required fields are missing or invalid
        """
        # Extract description (required)
        description = data.get("description")
        if not description or not isinstance(description, str):
            raise ValueError("Missing or invalid 'description' field")
        
        # Extract room_type (optional)
        room_type = data.get("room_type")
        
        # Extract items (required, but can be empty list)
        items_data = data.get("items", [])
        items = []
        
        for item_data in items_data:
            try:
                # Required fields
                category = item_data.get("category")
                confidence = item_data.get("confidence")
                
                if not category or confidence is None:
                    logger.warning(f"Skipping item with missing required fields: {item_data}")
                    continue
                
                # Optional fields with defaults
                item = FurnitureItem(
                    category=category,
                    style=item_data.get("style"),
                    materials=item_data.get("materials", []),
                    colors=item_data.get("colors", []),
                    notes=item_data.get("notes"),
                    confidence=float(confidence)
                )
                items.append(item)
                
            except Exception as e:
                logger.warning(f"Failed to parse item: {e}, data: {item_data}")
                continue
        
        return PinAnalysis(
            description=description,
            room_type=room_type,
            items=items
        )
    
    async def _retry_with_correction(
        self,
        invalid_content: str,
        model: str,
        temperature: float,
        reasoning_effort: str,
        verbosity: str,
        max_output_tokens: int
    ) -> PinAnalysis:
        """
        Retry analysis with a correction prompt if JSON parsing failed.
        
        Args:
            invalid_content: The invalid JSON string
            model: Model to use
            temperature: Temperature setting
            
        Returns:
            PinAnalysis
            
        Raises:
            ValueError: If retry also fails
        """
        logger.info("Retrying with JSON correction prompt")
        
        correction_prompt = f"""The following JSON is invalid or doesn't match the required schema. 
Please fix it to match this exact structure:

{json.dumps(FURNITURE_JSON_SCHEMA, indent=2)}

Invalid JSON:
{invalid_content}

Return only the corrected JSON, nothing else."""
        
        try:
            response = await self.client.responses.create(
                model=model,
                input=correction_prompt,
                temperature=0.3,
                reasoning_effort=reasoning_effort,
                verbosity=verbosity,
                max_output_tokens=max_output_tokens,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "furniture_analysis",
                        "schema": FURNITURE_JSON_SCHEMA,
                        "strict": True,
                    },
                },
            )
            
            content = self._get_response_text(response)
            if not content:
                raise ValueError("Empty response on retry")
            
            data = json.loads(content)
            return self._parse_analysis(data)
            
        except Exception as e:
            logger.error(f"Retry failed: {e}")
            raise ValueError(f"Failed to get valid JSON after retry: {e}")

    def _get_response_text(self, response: Any) -> str:
        """
        Extract text content from a Responses API response.
        
        Args:
            response: OpenAI Responses API response
            
        Returns:
            Response text content
        """
        # Prefer the convenience property if available
        if hasattr(response, "output_text") and response.output_text:
            return response.output_text
        
        # Fallback to parsing output content
        try:
            if response.output and len(response.output) > 0:
                output_item = response.output[0]
                if output_item.content and len(output_item.content) > 0:
                    content_item = output_item.content[0]
                    return getattr(content_item, "text", "") or ""
        except Exception:
            pass
        
        return ""
