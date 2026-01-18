import json
import logging
from typing import Optional, Any
from openai import AsyncOpenAI

from app.api.schemas import PinAnalysis
from app.clients.llm.base import LLMProvider
from app.prompts.furniture import format_prompt, FURNITURE_JSON_SCHEMA
from app.settings import settings


logger = logging.getLogger(__name__)


class OpenAIProvider(LLMProvider):
    """OpenAI-based LLM provider for pin analysis using the Responses API."""
    
    def __init__(self):
        """Initialize OpenAI client."""
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY not configured")
        
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.default_model = settings.openai_model
        self.default_reasoning_effort = settings.openai_reasoning_effort
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
        Analyze a pin image using OpenAI's Responses API with vision.
        """
        model = model_override or self.default_model
        reasoning_effort = reasoning_effort_override or self.default_reasoning_effort
        max_output_tokens = max_output_tokens_override or self.default_max_output_tokens
        
        # Format prompt with JSON schema embedded
        base_prompt = format_prompt(
            title=title,
            description=description,
            alt_text=alt_text,
            link=link
        )
        
        # Add explicit JSON schema requirement to the prompt
        json_prompt = f"""{base_prompt}

You MUST respond with valid JSON matching this exact schema:
{json.dumps(FURNITURE_JSON_SCHEMA, indent=2)}

Respond ONLY with the JSON object, no markdown, no explanation."""
        
        logger.info(
            "Analyzing image with OpenAI Responses API: model=%s, reasoning_effort=%s",
            model,
            reasoning_effort,
        )
        
        try:
            # Build request for Responses API (no temperature param supported)
            response = await self.client.responses.create(
                model=model,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": json_prompt},
                            {"type": "input_image", "image_url": image_url},
                        ],
                    }
                ],
                reasoning={"effort": reasoning_effort},
                max_output_tokens=max_output_tokens,
            )
            
            # Extract response text
            content = self._get_response_text(response)
            
            if not content:
                raise ValueError("Empty response from OpenAI")
            
            # Clean up response (remove markdown code fences if present)
            content = self._clean_json_response(content)
            
            # Parse JSON
            data = json.loads(content)
            
            # Validate and convert to PinAnalysis
            return self._parse_analysis(data)
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from OpenAI: {e}")
            logger.debug(f"Raw content: {content[:500] if content else 'None'}")
            # Retry with a correction prompt
            return await self._retry_with_correction(
                content,
                model,
                reasoning_effort,
                max_output_tokens
            )
        
        except Exception as e:
            logger.error(f"OpenAI analysis failed: {e}")
            raise
    
    def _clean_json_response(self, content: str) -> str:
        """Remove markdown code fences and whitespace from JSON response."""
        content = content.strip()
        # Remove ```json ... ``` wrapper
        if content.startswith("```"):
            lines = content.split("\n")
            # Remove first line (```json) and last line (```)
            if lines[-1].strip() == "```":
                lines = lines[1:-1]
            else:
                lines = lines[1:]
            content = "\n".join(lines)
        return content.strip()
    
    def _parse_analysis(self, data: dict) -> PinAnalysis:
        """Parse and validate the JSON response into a PinAnalysis object."""
        main_item = data.get("main_item")
        description = data.get("description")
        confidence = data.get("confidence")

        if not main_item or not description or confidence is None:
            raise ValueError(f"Missing required fields in analysis: {data}")

        return PinAnalysis(
            main_item=main_item,
            description=description,
            style=data.get("style"),
            materials=data.get("materials", []),
            colors=data.get("colors", []),
            confidence=float(confidence)
        )
    
    async def _retry_with_correction(
        self,
        invalid_content: str,
        model: str,
        reasoning_effort: str,
        max_output_tokens: int
    ) -> PinAnalysis:
        """Retry analysis with a correction prompt if JSON parsing failed."""
        logger.info("Retrying with JSON correction prompt")
        
        correction_prompt = f"""The following text was supposed to be valid JSON but isn't.
Please fix it to match this exact schema:

{json.dumps(FURNITURE_JSON_SCHEMA, indent=2)}

Invalid content:
{invalid_content[:1000]}

Return ONLY the corrected JSON, no markdown, no explanation."""
        
        try:
            response = await self.client.responses.create(
                model=model,
                input=correction_prompt,
                reasoning={"effort": "low"},
                max_output_tokens=max_output_tokens,
            )
            
            content = self._get_response_text(response)
            if not content:
                raise ValueError("Empty response on retry")
            
            content = self._clean_json_response(content)
            data = json.loads(content)
            return self._parse_analysis(data)
            
        except Exception as e:
            logger.error(f"Retry failed: {e}")
            raise ValueError(f"Failed to get valid JSON after retry: {e}")

    def _get_response_text(self, response: Any) -> str:
        """Extract text content from a Responses API response."""
        # Prefer the convenience property if available
        if hasattr(response, "output_text") and response.output_text:
            return response.output_text
        
        # Fallback to parsing output content
        try:
            if response.output and len(response.output) > 0:
                output_item = response.output[0]
                if hasattr(output_item, "content") and output_item.content:
                    for content_item in output_item.content:
                        if hasattr(content_item, "text") and content_item.text:
                            return content_item.text
        except Exception as e:
            logger.debug(f"Failed to extract response text: {e}")
        
        return ""
