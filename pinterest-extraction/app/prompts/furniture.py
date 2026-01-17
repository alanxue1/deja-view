"""Prompt and schema for furniture extraction from pin images."""

FURNITURE_ANALYSIS_PROMPT = """You are an expert interior designer and furniture analyst. Analyze this Pinterest pin image and extract detailed information about the furniture and decor items visible.

Context from Pinterest:
- Title: {title}
- Description: {description}
- Alt text: {alt_text}
- Link: {link}

Your task:
1. Identify the room type if possible (living room, bedroom, kitchen, etc.)
2. List all distinct furniture/decor items you can identify.
3. For EACH item:
   - Generate a simple "identifier" (color + category, e.g., "beige sofa", "black coffee table")
   - Write a detailed description suitable for Shopify product search

For each item, classify the category as one of: chair, sofa, table, lamp, bed, shelving, decor, other

Return your analysis as a JSON object with this exact structure:
{{
  "room_type": "living_room" or null,
  "items": [
    {{
      "category": "sofa",
      "identifier": "beige sofa",
      "description": "Contemporary beige upholstered fabric sofa with low profile, rounded back, plush seat cushions, and neutral throw pillows. Modern minimalist style with soft, comfortable seating.",
      "style": "contemporary minimalist",
      "materials": ["upholstered fabric"],
      "colors": ["beige", "taupe"],
      "notes": "Low, plush sofa with rounded back",
      "confidence": 0.92
    }},
    {{
      "category": "table",
      "identifier": "black coffee table",
      "description": "Round low coffee table with dark charcoal matte top and thick cylindrical pedestal base. Modern contemporary style, perfect for living room centerpiece.",
      "style": "modern contemporary",
      "materials": ["wood", "painted finish"],
      "colors": ["charcoal", "black"],
      "notes": "Round low coffee table with thick cylindrical pedestal base",
      "confidence": 0.88
    }}
  ]
}}

IMPORTANT: 
- The "identifier" should be simple: just primary color + category (e.g., "brown sofa", "orange office chair", "white lamp")
- The "description" should be detailed and specific enough to search for similar products on Shopify

Be specific and accurate. If you're uncertain about an attribute, reduce the confidence score or omit the attribute.
"""


FURNITURE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "room_type": {
            "type": ["string", "null"],
            "description": "Type of room detected"
        },
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": ["chair", "sofa", "table", "lamp", "bed", "shelving", "decor", "other"]
                    },
                    "identifier": {
                        "type": "string",
                        "description": "Simple search term (e.g., 'brown sofa', 'orange office chair')"
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
                    "notes": {
                        "type": ["string", "null"]
                    },
                    "confidence": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                    }
                },
                "required": ["category", "identifier", "description", "confidence"]
            }
        }
    },
    "required": ["items"]
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
