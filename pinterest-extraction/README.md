# Pinterest Extraction API

Extracts pins from a **public Pinterest board** and returns 3D-generator-ready JSON with furniture/decor metadata.

## Quick Start

### 1. Install
```bash
cd pinterest-extraction
python3 -m venv venv
source venv/bin/activate
pip3 install -r requirements.txt
```

### 2. Configure
Create `.env` file:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Run
```bash
uvicorn app.main:app --reload --port 8000
```

Check it's running:
```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy"}
```

---

## Usage

### Endpoint
**POST** `/v1/analyze`

### Request
```bash
curl -X POST "http://localhost:8000/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "board_url": "https://pinterest.com/username/board-name/",
    "max_pins": 10
  }'
```

### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `board_url` | string | ✅ Yes | - | Full Pinterest board URL |
| `max_pins` | integer | No | 50 | Max pins to analyze (1-100) |
| `llm_model` | string | No | `gpt-5.2` | Override LLM model |
| `llm_reasoning_effort` | string | No | `low` | Reasoning effort: `low`, `medium`, `high` |
| `llm_max_output_tokens` | integer | No | 4000 | Max tokens in response |

### Response
```json
{
  "board_id": "https://pinterest.com/username/board-name/",
  "num_pins_fetched": 10,
  "num_pins_analyzed": 10,
  "num_pins_skipped": 0,
  "pins": [
    {
      "pin_id": "1097a0d6069851bf03d37bb076a447f9",
      "image_url": "https://i.pinimg.com/736x/10/97/a0/1097a0d6069851bf03d37bb076a447f9.jpg",
      "analysis": {
        "description": "Contemporary open-plan living area with beige sofa, round coffee table...",
        "room_type": "living room",
        "items": [
          {
            "category": "sofa",
            "style": "contemporary",
            "materials": ["upholstered fabric"],
            "colors": ["beige", "taupe"],
            "confidence": 0.92
          }
        ]
      },
      "skipped": false
    }
  ]
}
```

### Key Fields for 3D Generation
- **`analysis.description`**: Detailed room description → feed to 3D model generator
- **`analysis.items[]`**: Structured furniture list with categories, materials, colors
- **`analysis.room_type`**: Detected room type (living_room, bedroom, etc.)

---

## Real Example

Using the test board at https://ca.pinterest.com/jlaxman2/home-decor/:

```bash
curl -X POST "http://localhost:8000/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "board_url": "https://ca.pinterest.com/jlaxman2/home-decor/",
    "max_pins": 5
  }'
```

---

## Requirements

- **Python 3.8+**
- **OpenAI API key** (for GPT-5.x)
- **Public Pinterest board** (private boards won't work)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `502 Failed to scrape board` | Make sure the board URL is correct and the board is **public** |
| `500 LLM provider error` | Check your `OPENAI_API_KEY` in `.env` |
| Some pins skipped | Normal — complex images may fail, check `skip_reason` in response |
| Empty `pins` array | Board has no accessible pins or all are filtered out |

---

## Notes

- **No Pinterest API token needed** — uses web scraping
- Works with **public boards only**
- Some pins may be skipped if LLM analysis fails (partial success is normal)
- Response time: ~2-5 seconds per pin
