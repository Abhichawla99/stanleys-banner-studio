# Stanley's Post — Banner Automation POC

## Quick Setup (5 minutes)

```bash
# 1. Install dependencies
npm run install-all

# 2. Set your Gemini API key
export GEMINI_API_KEY="your-key-here"
# Get one free at: https://aistudio.google.com/apikey

# 3. Run both server + client
npm run dev
```

Open **http://localhost:3000**

## How It Works

1. **Upload** any key art image (PNG/JPG)
2. **Select** which Amazon Prime banner formats to generate
3. **Click Generate** — watch real-time progress as:
   - AI regenerates the art at each aspect ratio (no stretching/cropping)
   - Each regenerated art is composited into its Prime banner template
4. **View results** — toggle between final banners, regenerated art, and templates
5. **Download** any banner directly

## Architecture

```
client/          → React frontend (Vite)
  src/App.jsx    → Main UI component
server/          → Express API backend
  index.mjs      → Handles uploads, Gemini API calls, compositing
templates/       → Generated Amazon Prime banner templates
outputs/         → Generated banners per run
```

## API Endpoints

- `GET /api/banners` — List all banner configurations
- `POST /api/generate` — Upload art + selected banner IDs → SSE stream of progress + results
- `GET /api/runs/:id` — Get past run results

## Banner Formats (Amazon Prime)

| Format | Dimensions | Ratio | Category |
|--------|-----------|-------|----------|
| 6 Sheet | 1200×1800 | 2:3 | OOH |
| Extreme Portrait | 800×2400 | 1:3 | OOH |
| 26 x 24 | 1560×1440 | 1:1 | Display |
| 48 Sheet | 2400×1200 | 16:9 | OOH |
| 96 Sheet | 3000×1000 | 3:1 | OOH |
| Extreme Landscape | 3200×800 | 4:1 | OOH |
| Press Landscape | 1800×1200 | 3:2 | Press |
| Press Portrait | 1200×1600 | 3:4 | Press |
