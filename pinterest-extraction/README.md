# Pinterest Extraction Microservice

This FastAPI service fetches pins from a Pinterest board and returns **3D-generator-ready JSON**, including an LLM-generated `analysis.description` plus structured furniture metadata.

### What you need
- **OpenAI API key** (for GPT‑5.x)
- **Pinterest OAuth access token** with scopes: `boards:read`, `pins:read`
- A **Pinterest `board_id`**

### Install + run (local)

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

### API (what to call)

**POST** `/v1/boards/{board_id}/pins/analyze`

- **Auth**: pass the Pinterest token through:
  - `Authorization: Bearer <PINTEREST_ACCESS_TOKEN>`

Example:

```bash
curl -X POST "http://localhost:8000/v1/boards/YOUR_BOARD_ID/pins/analyze" \
  -H "Authorization: Bearer YOUR_PINTEREST_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "max_pins": 10,
    "page_size": 10,
    "llm_model": "gpt-5.2",
    "llm_reasoning_effort": "low",
    "llm_verbosity": "low"
  }'
```

### Request body (only what matters)
- **`max_pins`**: max pins to process (1–200)
- **`page_size`**: Pinterest page size (1–100)
- **`include_pinterest_raw`**: include raw Pinterest payload (debugging)
- **`llm_model`**: `gpt-5.2` (default), `gpt-5.2-pro` for higher quality
- **`llm_reasoning_effort`**: `minimal|low|medium|high`
- **`llm_verbosity`**: `low|medium|high`
- **`llm_max_output_tokens`**: cap response size (64–4000)

### Response (what your 3D pipeline consumes)
For each pin:
- **`pinterest_description`**: the pin’s caption (if present)
- **`analysis.description`**: **LLM-generated description for 3D model generation**
- **`analysis.items[]`**: structured furniture list (`category/style/materials/colors/confidence`)
- Failures are returned as `skipped=true` with `skip_reason` (partial success is normal).

### Troubleshooting (fast)
- **401 from our API**: missing `Authorization: Bearer ...`
- **403 from our API**: Pinterest token invalid/expired or missing scopes
- **429 from our API**: Pinterest rate-limited you; retry later / lower `max_pins`