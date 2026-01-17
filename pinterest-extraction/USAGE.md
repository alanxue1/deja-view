# Pinterest Extraction API - Usage Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   cd pinterest-extraction
   pip3 install -r requirements.txt
   ```

2. **Create `.env` file:**
   ```bash
   cat > .env << 'EOF'
   LLM_PROVIDER=openai
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o
   OPENAI_TEMPERATURE=0.7
   MAX_PINS_DEFAULT=50
   PAGE_SIZE_DEFAULT=50
   PINTEREST_API_BASE_URL=https://api.pinterest.com/v5
   REQUEST_TIMEOUT_SECONDS=30
   MAX_RETRIES=3
   EOF
   ```

3. **Run the service:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

4. **Check health:**
   ```bash
   curl http://localhost:8000/health
   ```

## API Endpoints

### Analyze Board Pins

**Endpoint:** `POST /v1/boards/{board_id}/pins/analyze`

**Headers:**
- `Authorization: Bearer <PINTEREST_ACCESS_TOKEN>` (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "max_pins": 50,
  "page_size": 50,
  "include_pinterest_raw": false,
  "llm_model": "gpt-4o",
  "llm_temperature": 0.7
}
```

**Example:**
```bash
curl -X POST "http://localhost:8000/v1/boards/YOUR_BOARD_ID/pins/analyze" \
  -H "Authorization: Bearer YOUR_PINTEREST_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "max_pins": 10,
    "page_size": 10
  }'
```

**Response:**
```json
{
  "board_id": "123456789",
  "num_pins_fetched": 10,
  "num_pins_analyzed": 9,
  "num_pins_skipped": 1,
  "pins": [
    {
      "pin_id": "abc123",
      "board_id": "123456789",
      "image_url": "https://...",
      "pinterest_description": "Beautiful modern living room",
      "title": "Modern Living Room Ideas",
      "alt_text": null,
      "link": "https://...",
      "created_at": "2024-01-01T12:00:00Z",
      "analysis": {
        "description": "Modern minimalist living room featuring a light gray L-shaped sectional sofa with wooden legs positioned along two walls. A large brass arc floor lamp stands in the corner, casting warm light over a white oak coffee table...",
        "room_type": "living_room",
        "items": [
          {
            "category": "sofa",
            "style": "modern minimalist",
            "materials": ["fabric", "wood"],
            "colors": ["light gray", "natural wood"],
            "notes": "L-shaped sectional with clean lines",
            "confidence": 0.95
          },
          {
            "category": "lamp",
            "style": "mid-century modern",
            "materials": ["brass", "metal"],
            "colors": ["brass gold"],
            "notes": "Arc floor lamp",
            "confidence": 0.9
          }
        ]
      },
      "skipped": false,
      "skip_reason": null,
      "pinterest_raw": null
    }
  ]
}
```

## How to Get a Pinterest Access Token

You'll need to:

1. Create a Pinterest app at https://developers.pinterest.com/
2. Request OAuth scopes: `boards:read`, `pins:read`
3. Complete the OAuth flow to get an access token
4. Use that token in the `Authorization` header

For hackathon purposes, you can also use Pinterest's API Playground or generate a token manually through their developer console.

## Architecture

```
pinterest-extraction/
├── app/
│   ├── main.py                    # FastAPI app entry point
│   ├── settings.py                # Environment config
│   ├── api/
│   │   ├── routes.py              # HTTP endpoints
│   │   └── schemas.py             # Pydantic models
│   ├── clients/
│   │   ├── pinterest.py           # Pinterest API client
│   │   └── llm/
│   │       ├── base.py            # LLM provider interface
│   │       ├── openai_provider.py # OpenAI implementation
│   │       └── registry.py        # Provider selection
│   ├── prompts/
│   │   └── furniture.py           # LLM prompt templates
│   └── utils/
│       ├── http.py                # HTTP client + retries
│       ├── images.py              # Image URL extraction
│       └── logging_config.py      # Logging setup
├── requirements.txt
└── README.md
```

## Features

✅ **Pass-through auth** - No token storage, client provides Pinterest token  
✅ **Pluggable LLM** - Swap providers by changing `LLM_PROVIDER` env var  
✅ **Retry logic** - Exponential backoff for transient errors  
✅ **Structured logging** - Clear logs with request/error tracking  
✅ **Partial results** - Returns successfully analyzed pins even if some fail  
✅ **3D-ready output** - LLM generates descriptions optimized for 3D generation  

## Adding a New LLM Provider

1. Create `app/clients/llm/your_provider.py`:
   ```python
   from app.clients.llm.base import LLMProvider
   
   class YourProvider(LLMProvider):
       async def analyze_pin(self, image_url, ...):
           # Your implementation
           pass
   ```

2. Register in `app/clients/llm/registry.py`:
   ```python
   PROVIDERS = {
       "openai": OpenAIProvider,
       "your_provider": YourProvider,
   }
   ```

3. Update `.env`:
   ```
   LLM_PROVIDER=your_provider
   ```

## Troubleshooting

**Error: Invalid or expired Pinterest access token**
- Check your token is valid
- Ensure scopes include `boards:read` and `pins:read`

**Error: Rate limit exceeded**
- Wait for the retry-after period
- Reduce `max_pins` or add delays between requests

**Error: No image URL found**
- Some pins may not have accessible images
- These pins are skipped with `skip_reason`

**Error: LLM analysis failed**
- Check your OpenAI API key
- Ensure you have credits/quota
- Check the model name is correct
