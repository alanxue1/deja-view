# Pinterest Extraction Microservice

This FastAPI service fetches pins from a Pinterest board and returns **3D-generator-ready JSON**, including an LLM-generated `analysis.description` plus structured furniture metadata.

## What you need
- **OpenAI API key** (for GPT‑5.x)
- A **public Pinterest board URL** (scrape mode — NO API token needed!)

## Install + run (local)

```bash
cd pinterest-extraction
python3 -m venv venv
source venv/bin/activate
pip3 install -r requirements.txt
```

Create `.env` in `pinterest-extraction/`:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.2
OPENAI_TEMPERATURE=0.7
OPENAI_REASONING_EFFORT=low
OPENAI_VERBOSITY=low
OPENAI_MAX_OUTPUT_TOKENS=800
```

Start the server:

```bash
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

---

## Option 1: Scrape Mode (recommended — no API token needed)

**POST** `/v1/scrape/analyze`

Works with any **public** Pinterest board. No Pinterest API approval required!

```bash
curl -X POST "http://localhost:8000/v1/scrape/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "board_url": "https://pinterest.com/jlaxman2/home-decor/",
    "max_pins": 10
  }'
```

### Request body
- **`board_url`** (required): Full Pinterest board URL
- **`max_pins`**: max pins to process (1–100, default: 50)
- **`llm_model`**: `gpt-5.2` (default), `gpt-5.2-pro` for higher quality
- **`llm_reasoning_effort`**: `minimal|low|medium|high`
- **`llm_verbosity`**: `low|medium|high`
- **`llm_max_output_tokens`**: cap response size (64–4000)

---

## Option 2: API Mode (requires Pinterest API approval)

**POST** `/v1/boards/{board_id}/pins/analyze`

Requires a valid Pinterest OAuth access token.

```bash
curl -X POST "http://localhost:8000/v1/boards/YOUR_BOARD_ID/pins/analyze" \
  -H "Authorization: Bearer YOUR_PINTEREST_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "max_pins": 10,
    "page_size": 10
  }'
```

---

## Response (what your 3D pipeline consumes)

For each pin:
- **`pin_id`**: unique identifier
- **`image_url`**: high-res image URL
- **`analysis.description`**: **LLM-generated description for 3D model generation**
- **`analysis.items[]`**: structured furniture list (`category/style/materials/colors/confidence`)
- Failures are returned as `skipped=true` with `skip_reason`

Example response:
```json
{
  "board_id": "https://pinterest.com/user/board/",
  "num_pins_fetched": 4,
  "num_pins_analyzed": 4,
  "num_pins_skipped": 0,
  "pins": [
    {
      "pin_id": "1097a0d6069851bf03d37bb076a447f9",
      "image_url": "https://i.pinimg.com/originals/10/97/a0/1097a0d6069851bf03d37bb076a447f9.jpg",
      "analysis": {
        "description": "Modern minimalist living room with floor-to-ceiling windows...",
        "room_type": "living_room",
        "items": [
          {
            "category": "sofa",
            "style": "modern minimalist",
            "materials": ["fabric", "metal"],
            "colors": ["gray", "black"],
            "confidence": 0.95
          }
        ]
      }
    }
  ]
}
```

---

## Troubleshooting

**Scrape mode issues:**
- "Failed to scrape board" → Make sure the board URL is correct and the board is public
- Board must be publicly visible (not private/secret)

**API mode issues:**
- 401/403 → Pinterest token invalid/expired or API not approved yet
- If your app shows "trial access pending", you cannot use the API — use scrape mode instead
