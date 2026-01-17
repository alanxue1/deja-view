# Pinterest Pin Extraction Microservice

A FastAPI microservice that extracts pins from Pinterest boards and analyzes them using LLM for furniture extraction.

## Setup

1. Create a `.env` file with the following variables:

```env
# LLM Provider Selection
LLM_PROVIDER=openai

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o
OPENAI_TEMPERATURE=0.7

# Service Configuration
MAX_PINS_DEFAULT=50
PAGE_SIZE_DEFAULT=50
PINTEREST_API_BASE_URL=https://api.pinterest.com/v5

# HTTP Client Configuration
REQUEST_TIMEOUT_SECONDS=30
MAX_RETRIES=3
```

2. Install dependencies:

```bash
pip3 install -r requirements.txt
```

3. Run the service:

```bash
cd pinterest-extraction
uvicorn app.main:app --reload --port 8000
```

## Usage

### Analyze Pins from a Board

```bash
curl -X POST "http://localhost:8000/v1/boards/{board_id}/pins/analyze" \
  -H "Authorization: Bearer YOUR_PINTEREST_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "max_pins": 50,
    "page_size": 50
  }'
```

## Architecture

- **Pass-through auth**: Client provides Pinterest OAuth token; service forwards it
- **Pluggable LLM**: Easily swap providers by changing `LLM_PROVIDER` env var
- **Stateless**: No database; returns results directly
