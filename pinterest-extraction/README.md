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
# OpenAI (for board analysis)
OPENAI_API_KEY=your_openai_api_key_here

# Gemini (for item extraction)
GEMINI_API_KEY=your_gemini_api_key_here

# Cloudflare R2 (for storing extracted images)
R2_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_id_here
R2_SECRET_ACCESS_KEY=your_secret_access_key_here
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_BUCKET=deja-view
R2_PUBLIC_BASE_URL=https://pub-16db5fa34f6c44358a6ad41118051522.r2.dev
```

**Getting R2 credentials:**
1. Go to [R2 Overview](https://dash.cloudflare.com/?to=/:account/r2/overview)
2. Click **Manage R2 API Tokens** → **Create API token** → Select **Object Read & Write** permissions
3. Copy **Access Key ID** and **Secret Access Key** (save immediately - can't view again!)
4. Find your **Account ID** in the same R2 page sidebar
5. For **Public Development URL**: Go to your bucket → **Settings** → **Public Development URL** → **Enable**

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

### Endpoint 1: Analyze Board
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
        "room_type": "living room",
        "items": [
          {
            "category": "sofa",
            "identifier": "beige sofa",
            "description": "Contemporary beige upholstered fabric sofa with low profile, rounded back, plush seat cushions, and neutral throw pillows. Modern minimalist style.",
            "style": "contemporary",
            "materials": ["upholstered fabric"],
            "colors": ["beige", "taupe"],
            "confidence": 0.92
          },
          {
            "category": "table",
            "identifier": "black coffee table",
            "description": "Round low coffee table with dark charcoal matte top and thick cylindrical pedestal base. Modern contemporary style.",
            "style": "modern contemporary",
            "materials": ["wood", "painted finish"],
            "colors": ["charcoal", "black"],
            "confidence": 0.88
          }
        ]
      },
      "skipped": false
    }
  ]
}
```

### Key Fields for Shopify Product Search
- **`analysis.items[].identifier`**: Simple search term (e.g., "brown sofa", "orange office chair") → use for quick Shopify searches
- **`analysis.items[].description`**: Detailed item description → use for advanced Shopify API product search
- **`analysis.items[].category`**: Furniture category (sofa, chair, table, lamp, bed, shelving, decor, other)
- **`analysis.items[].style`**: Style classification (contemporary, modern, etc.)
- **`analysis.items[].materials`**: Detected materials
- **`analysis.items[].colors`**: Detected colors
- **`analysis.room_type`**: Detected room type (living_room, bedroom, etc.)

---

### Endpoint 2: Extract Item Image
**POST** `/v1/extract-item-image`

Extracts a single item from a Pinterest image using Gemini Nano Banana and returns a transparent PNG stored in Cloudflare R2.

### Request
```bash
curl -X POST "http://localhost:8000/v1/extract-item-image" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://i.pinimg.com/736x/10/97/a0/1097a0d6069851bf03d37bb076a447f9.jpg",
    "item_description": "wooden chair"
  }'
```

### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `image_url` | string | ✅ Yes | - | Direct Pinterest image URL (e.g., `https://i.pinimg.com/...`) |
| `item_description` | string | ✅ Yes | - | Description of item to extract (e.g., "red handbag", "wooden chair") |
| `model_image` | string | No | `gemini-2.5-flash-image` | Override Gemini image model |
| `max_output_pixels` | integer | No | - | Max output image dimension (256-4096) |

### Response
```json
{
  "source_image_url": "https://i.pinimg.com/736x/10/97/a0/1097a0d6069851bf03d37bb076a447f9.jpg",
  "item_description": "wooden chair",
  "result_image_url": "https://pub-16db5fa34f6c44358a6ad41118051522.r2.dev/items/abc123def456.png",
  "r2_object_key": "items/abc123def456.png",
  "mime_type": "image/png",
  "width": null,
  "height": null
}
```

### Key Fields
- **`result_image_url`**: Public R2 URL to the extracted item image (transparent PNG) - use this for 3D model generation
- **`r2_object_key`**: Internal R2 object key for reference
- **`mime_type`**: Always `image/png` (with transparent background)

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
- **OpenAI API key** (for board analysis with GPT-5.x)
- **Gemini API key** (for item extraction with Nano Banana)
- **Cloudflare R2 account** (for storing extracted images)
- **Public Pinterest board** (private boards won't work)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `502 Failed to scrape board` | Make sure the board URL is correct and the board is **public** |
| `500 LLM provider error` | Check your `OPENAI_API_KEY` in `.env` |
| `500 Gemini client initialization failed` | Check your `GEMINI_API_KEY` in `.env` |
| `500 R2 client initialization failed` | Check your R2 credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`) in `.env` |
| `500 Failed to generate image` | Gemini may have failed to extract the item - try a more specific `item_description` |
| `500 R2 upload failed` | Verify R2 bucket exists and credentials are correct |
| Some pins skipped | Normal — complex images may fail, check `skip_reason` in response |
| Empty `pins` array | Board has no accessible pins or all are filtered out |

---

## Notes

- **No Pinterest API token needed** — uses web scraping
- Works with **public boards only**
- Some pins may be skipped if LLM analysis fails (partial success is normal)
- Response time: ~2-5 seconds per pin (analyze endpoint)
- Response time: ~5-15 seconds per item extraction (extract-item-image endpoint)
- Extracted images are stored in Cloudflare R2 with transparent backgrounds (PNG)
- R2 public URLs are rate-limited for development use (`r2.dev` subdomain)
