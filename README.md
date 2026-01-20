<h1 align="center">
    Déjà View
</h1>
<p align="center">
    <strong>From inspiration to identity.</strong><br>
    Turn your Pinterest saves into 3D objects in your room — keep what you touch, let the rest fade.
</p>

<p align="center">
    <!-- ADD DEMO LINK: <a href="https://your-demo-url.com"><img src="https://img.shields.io/badge/Try%20Demo-Live-orange?style=for-the-badge" alt="Try Demo"></a> -->
</p>

<p align="center">
    <a href="https://www.youtube.com/watch?v=jmkodGzbENg">
        <img src="https://img.youtube.com/vi/jmkodGzbENg/maxresdefault.jpg" alt="Déjà View Demo" width="600">
    </a>
    <br>
    <em>Click to watch the demo</em>
</p>

<br>

<table>
  <tr>
    <td align="center" width="50%">
      <img src="docs/ui-landing.png" alt="Landing Page" width="100%">
      <br>
      <em>Landing Page</em>
    </td>
    <td align="center" width="50%">
      <img src="docs/ui-room.png" alt="Room View" width="100%">
      <br>
      <em>3D Room View</em>
    </td>
  </tr>
</table>

<br>

## The Pipeline

See how Déjà View transforms your Pinterest inspiration into interactive 3D objects:

<table>
  <tr>
    <th align="center" width="33%">Pinterest</th>
    <th align="center" width="33%">2D Render</th>
    <th align="center" width="33%">3D Model</th>
  </tr>
  <tr>
    <td align="center">
      <img src="docs/pipeline-pinterest.png" alt="Pinterest" width="100%">
    </td>
    <td align="center">
      <img src="docs/pipeline-2d.png" alt="2D Render" width="100%">
    </td>
    <td align="center">
      <img src="docs/pipeline-3d.gif" alt="3D Model" width="100%">
    </td>
  </tr>
  <tr>
    <td align="center"><em>Source inspiration</em></td>
    <td align="center"><em>AI-extracted product</em></td>
    <td align="center"><em>Generated 3D model</em></td>
  </tr>
</table>

<br>

## How It Works

1. **Save**: Collect inspiration on a public Pinterest board
2. **Import**: Paste your board URL — we analyze each pin and extract the main item
3. **Generate**: AI creates a realistic 2D render, then converts it to a 3D `.glb` model
4. **Place**: Objects appear naturally in your virtual room
5. **Interact**: Click items to inspect, adjust placement, or shop similar products
6. **Curate**: What you touch stays; what you ignore fades — your space reflects you

<br>

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- API keys: Clerk, Gemini, Replicate, Cloudflare R2, Google CSE

### Frontend (Next.js)

```bash
cd deja-view
npm install
cp env.example .env.local
# Fill in your API keys
npm run dev
```

App runs at `http://localhost:3000`

### Backend (FastAPI)

```bash
cd pinterest-extraction
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp env.example .env
# Fill in your API keys
uvicorn app.main:app --reload --port 8000
```

API docs at `http://localhost:8000/docs`

<br>

## Architecture

```mermaid
flowchart LR
  U[User] --> W[Next.js App]

  subgraph Frontend["Next.js App Router"]
    W --> A1[/api/pinterest-board/]
    W --> A2[/api/items/]
    W --> A3[/api/get-placement/]
    W --> A4[/api/match-cache/]
  end

  subgraph Backend["FastAPI :8000"]
    P1[/v1/analyze-job/]
    P2[/v1/extract-item-3d/]
  end

  A1 -->|start + poll| P1
  A1 -->|start + poll| P2

  P1 -->|LLM analysis| LLM[OpenAI]
  P2 -->|item extraction| G[Gemini]
  P2 -->|3D generation| R[Replicate Trellis]
  P2 -->|store assets| R2[Cloudflare R2]

  A2 --> DB[(MongoDB)]
  A3 -->|placement inference| GV[Gemini Vision]
```

### Tech Stack

<table>
  <tr>
    <td valign="top" width="50%">
      <strong>Frontend</strong>
      <ul>
        <li>Next.js 14 & React</li>
        <li>Three.js for 3D rendering</li>
        <li>Clerk for authentication</li>
        <li>Framer Motion & GSAP for animations</li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <strong>Backend</strong>
      <ul>
        <li>FastAPI with async job polling</li>
        <li>Gemini for item extraction & placement</li>
        <li>Replicate Trellis for 3D <code>.glb</code> generation</li>
        <li>MongoDB for data persistence</li>
        <li>Cloudflare R2 for asset storage</li>
      </ul>
    </td>
  </tr>
</table>

<br>

## Inspiration

University students express identity through their space, but buying furniture from flat images leads to regret and costly returns. Inspiration stays trapped in static Pinterest boards — disconnected from the real constraints of your room.

Déjà View bridges that gap: discover → visualize in 3D → decide with context → shop what truly belongs.

<br>

## Team

| Name | Role |
|:-----|:-----|
| **David Liu** | Web app, UI/UX, product, video/LiDAR → 3D room model |
| **Julian Laxman** | Pinterest integration, Pinterest → 2D → 3D pipeline, backend integration |
| **Alan Xue** | Shopify integration, search query generation from item tags |
| **Charles Bae** | 3D room modeling & object placement logic, Three.js integration, system components integration|

---

<p align="center">
    Built at UofTHacks 13
</p>
