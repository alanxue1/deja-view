# Pinterest → 3D Room Sync

Add a pin to your Pinterest board → it automatically appears as a 3D model in your room (~30-120s).

## Setup (One Time)

### 1. MongoDB Atlas
- Create free cluster at [MongoDB Atlas](https://cloud.mongodb.com/)
- Get connection string (replace `<password>`)
- Whitelist IP: "Allow Access from Anywhere"

### 2. Install & Configure

```bash
cd pinterest-extraction
python3 -m venv venv
source venv/bin/activate
pip3 install -r requirements.txt
```

Create `pinterest-extraction/.env`:
```env
MONGODB_ATLAS_URI=mongodb+srv://user:pass@cluster.mongodb.net/
MONGODB_DB=deja-view
DEMO_ROOM_ID=
PINTEREST_BOARD_URL=https://ca.pinterest.com/your-username/your-board/
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
REPLICATE_API_TOKEN=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ACCOUNT_ID=...
R2_ENDPOINT=https://...r2.cloudflarestorage.com
R2_PUBLIC_BASE_URL=https://pub-...r2.dev
R2_BUCKET=deja-view
```

Update root `.env.local`:
```env
MONGODB_DEV_URI=mongodb+srv://user:pass@cluster.mongodb.net/
```

### 3. Initialize Database

```bash
python3 -m app.db_setup
```

**Copy `DEMO_ROOM_ID` from output to `.env`**

## Run (3 Terminals)

**Terminal 1:**
```bash
cd pinterest-extraction && source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2:**
```bash
cd pinterest-extraction && source venv/bin/activate
python3 run_watcher.py
```

**Terminal 3:**
```bash
npm run dev
```

## Test

1. Open `http://localhost:3000/room?roomId=<DEMO_ROOM_ID>`
2. Add furniture image to Pinterest board
3. Watch Terminal 2 logs → model appears in ~30-120s

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "DEMO_ROOM_ID not configured" | Run `python3 -m app.db_setup` and copy ID |
| "Failed to scrape board" | Board must be **public** |
| Items stuck "running" | Check Terminal 2 for API errors |
| Models not appearing | Verify R2 URLs accessible, check browser console |

## How It Works

```
Pinterest Board (poll 30s)
  → MongoDB (queued)
  → Worker (OpenAI → Gemini → Replicate → R2)
  → MongoDB (ready + glbUrl)
  → Room UI (poll 3s) → Load .glb
```

**Note:** Board must be public. First pin takes ~30-120s, subsequent pins detected within 30s.
