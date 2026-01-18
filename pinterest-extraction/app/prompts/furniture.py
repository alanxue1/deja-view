"""Prompt and schema for furniture extraction from pin images."""

FURNITURE_ANALYSIS_PROMPT = """You are an expert interior designer and furniture analyst. Analyze this Pinterest pin image and extract detailed information about the single main furniture or decor item visible.

Context from Pinterest:
- Title: {title}
- Description: {description}
- Alt text: {alt_text}
- Link: {link}

Your task:
1. Identify the single main furniture/decor item in the image.
2. Generate a simple "main_item" identifier (color + category, e.g., "beige sofa", "black coffee table").
3. Write a detailed description suitable for Shopify product search.

Return your analysis as a JSON object with this exact structure:
{{
  "main_item": "beige sofa",
  "description": "Contemporary beige upholstered fabric sofa with low profile, rounded back, plush seat cushions, and neutral throw pillows. Modern minimalist style with soft, comfortable seating.",
  "style": "contemporary minimalist",
  "materials": ["upholstered fabric"],
  "colors": ["beige", "taupe"],
  "confidence": 0.92
}}

IMPORTANT: 
- The "main_item" should be simple: just primary color + category (e.g., "brown sofa", "orange office chair", "white lamp")
- The "description" should be detailed and specific enough to search for similar products on Shopify

Be specific and accurate. If you're uncertain about an attribute, reduce the confidence score or omit the attribute.
"""


FURNITURE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "main_item": {
            "type": "string",
            "description": "Simple main item identifier (e.g., 'brown sofa', 'orange office chair')"
        },
        "description": {
            "type": "string",
            "description": "Detailed description for Shopify product search"
        },
        "style": {
            "type": ["string", "null"]
        },
        "materials": {
            "type": "array",
            "items": {"type": "string"}
        },
        "colors": {
            "type": "array",
            "items": {"type": "string"}
        },
        "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
        }
    },
    "required": ["main_item", "description", "confidence"]
}


def format_prompt(
    title: str = None,
    description: str = None,
    alt_text: str = None,
    link: str = None
) -> str:
    """
    Format the furniture analysis prompt with context.
    
    Args:
        title: Pin title
        description: Pin description
        alt_text: Pin alt text
        link: Pin link
        
    Returns:
        Formatted prompt string
    """
    return FURNITURE_ANALYSIS_PROMPT.format(
        title=title or "N/A",
        description=description or "N/A",
        alt_text=alt_text or "N/A",
        link=link or "N/A"
    )
