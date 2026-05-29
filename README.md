# SearXNG Search Engine

A modern, privacy-respecting search engine frontend powered by SearXNG, with AI-powered summaries and chat.

## Features

- **8 Search Categories**: General, Images, Videos, News, Maps, Science/IT, Music, Files
- **AI Summary Sidebar**: Auto-detects Ollama/LM Studio, summarizes results, chat with context
- **Multiple Instance Support**: Local Docker, public searx.space instances, or custom URLs
- **Auto-Fallback**: If the current instance is unreachable, automatically tries fallback instances
- **CORS Proxy Fallback**: If a public instance blocks CORS, automatically tries CORS proxies
- **Modern UI**: Card-based results with dark/light themes
- **Privacy-First**: All searches proxied through SearXNG — no direct requests to search engines
- **Autocomplete**: Real-time search suggestions from SearXNG
- **Search History**: Local history with search and delete
- **Responsive**: Works on desktop, tablet, and mobile
- **No Frameworks**: Pure vanilla HTML/CSS/JS

## Quick Start

### Option A: Run with Docker (Recommended)

```bash
docker compose up -d
```

This starts three services:
- **SearXNG** on port 8080 (internal)
- **Valkey** (Redis-compatible cache) on port 6379 (internal)
- **Nginx** on port 3000 (frontend + API proxy)

Then navigate to: **http://localhost:3000**

Nginx serves the frontend and proxies `/api/` requests to SearXNG, eliminating CORS issues.

The app defaults to `http://localhost:8080` (local Docker). If Docker is down, it automatically falls back to public SearXNG instances.

### Option B: Use Without Docker

Open `index.html` in a browser or use VS Code Live Server. The app will try `localhost:8080` first, then automatically fall back to public instances if Docker isn't running.

### Configure (Optional)

Edit `.env` to change ports:
```env
SEARXNG_PORT=8080
FRONTEND_PORT=3000
SEARXNG_SECRET=change-this-to-a-random-string
```

## Architecture

### Without Docker (Live Server / Direct)
```
Browser → Public SearXNG instance (direct JSON API calls)
         ↳ Falls back to CORS proxy if needed
```

### With Docker
```
Browser → Nginx (:3000) → SearXNG (:8080)
                ↓
         Static Frontend (HTML/CSS/JS)
```

- **Nginx** serves the static frontend and proxies API calls to SearXNG
- **SearXNG** handles all search queries and aggregates results from 30+ search engines
- **Valkey** provides caching for SearXNG to improve performance

## Instance Modes

| Mode | Description |
|------|-------------|
| **Local Docker** | Default — uses SearXNG at `localhost:8080` (via nginx proxy or direct) |
| **Public** | Browse and select from public instances listed on searx.space |
| **Custom** | Enter any SearXNG instance URL manually |

The app automatically:
1. Detects if nginx proxy is available (Docker mode)
2. Falls back to direct API calls (Live Server / development mode)
3. Tests the current instance on startup and switches to a fallback if unreachable
4. Uses CORS proxies if a public instance blocks cross-origin requests

## Search Categories

| Tab | SearXNG Category | Result Style |
|-----|-------------------|-------------|
| General | general | Standard cards with URL, title, snippet |
| Images | images | Grid of image thumbnails |
| Videos | videos | Cards with thumbnails, duration, channel |
| News | news | Cards with source, date, snippet |
| Maps | map | OpenStreetMap embed + location info |
| Science/IT | science,it | Standard cards (academic/tech sources) |
| Music | music | Cards with album art, artist, duration |
| Files | files | Cards with file type icon, size, seeds |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Search |
| `/` | Focus search bar |
| `Esc` | Close modals / autocomplete |
| `↑` / `↓` | Navigate autocomplete suggestions |

## File Structure

```
├── docker-compose.yml      # Docker services (searxng, valkey, nginx)
├── .env                    # Environment variables
├── nginx.conf              # Nginx config (static + API proxy + AI proxy)
├── searxng/
│   └── settings.yml        # SearXNG configuration (CORS headers enabled)
├── index.html              # Main HTML shell (search + AI sidebar)
├── css/
│   └── style.css           # Full styling with dark/light themes
├── js/
│   ├── config.js           # Category definitions, defaults, API config, fallback instances
│   ├── storage.js          # localStorage persistence (settings, history, AI settings)
│   ├── searx-api.js        # SearXNG JSON API client (with CORS proxy fallback)
│   ├── instances.js         # Instance management (searx.space, custom)
│   ├── ai-api.js           # AI provider module (Ollama/LM Studio detection, streaming)
│   ├── ai-summary.js       # AI summary generation, chat, markdown rendering
│   ├── ui.js               # DOM helpers, card rendering, modals, AI sidebar
│   └── app.js              # Main app logic, event handlers, auto-fallback
└── icons/
    └── favicon.svg          # Search icon favicon
```

## SearXNG API

The frontend uses SearXNG's JSON API:

- **Search**: `GET /search?q={query}&format=json&categories={cat}&language={lang}&pageno={page}&time_range={range}&safesearch={level}`
- **Autocomplete**: `GET /autocompleter?q={partial}`

When behind nginx (Docker), requests go through `/api/` proxy prefix.
When running directly (Live Server), requests go directly to the SearXNG instance URL.
If CORS is blocked, requests fall back to CORS proxy services.

## Customization

### Adding Engines

Edit `searxng/settings.yml` to enable/disable search engines. SearXNG supports 100+ engines.

### Changing Theme

Click the theme toggle button in the header, or set `data-theme="light"` on the `<html>` element in `index.html`.

### Changing Default Instance

Edit `CONFIG.defaultInstance` in `js/config.js`.

## License

MIT