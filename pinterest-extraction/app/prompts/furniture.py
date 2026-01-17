"""Prompt and schema for furniture extraction from pin images."""

FURNITURE_ANALYSIS_PROMPT = """You are an expert interior designer and furniture analyst. Analyze this Pinterest pin image and extract detailed information about the furniture and decor items visible.

Context from Pinterest:
- Title: {title}
- Description: {description}
- Alt text: {alt_text}
- Link: {link}

Your task:
1. Generate a concise but detailed description suitable for a 3D model generator. Focus on furniture/decor items, their style, materials, colors, and spatial relationships.
2. Identify the room type if possible (living room, bedroom, kitchen, etc.)
3. List all distinct furniture/decor items you can identify with their attributes.

For each item, classify the category as one of: chair, sofa, table, lamp, bed, shelving, decor, other

Return your analysis as a JSON object with this exact structure:
{{
  "description": "A detailed description for 3D generation, e.g., 'Modern mid-century living room featuring a teal velvet sofa with wooden legs, positioned against a white wall. A brass arc floor lamp stands to the left...'",
  "room_type": "living_room" or null,
  "items": [
    {{
      "category": "sofa",
      "style": "mid-century modern",
      "materials": ["velvet", "wood"],
      "colors": ["teal", "natural wood"],
      "notes": "Three-seater with button tufting",
      "confidence": 0.95
    }}
  ]
}}

Be specific and accurate. If you're uncertain about an attribute, reduce the confidence score or omit the attribute. Focus on items that would be useful for 3D room generation.
"""


FURNITURE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "description": {
            "type": "string",
            "description": "Detailed description for 3D model generation"
        },
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
                "required": ["category", "confidence"]
            }
        }
    },
    "required": ["description", "items"]
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
