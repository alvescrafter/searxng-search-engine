# SearXNG Search Engine

A modern, privacy-respecting search engine frontend powered by SearXNG, running in Docker with a custom card-based dashboard UI.

## Features

- **8 Search Categories**: General, Images, Videos, News, Maps, Science/IT, Music, Files
- **Multiple Instance Support**: Local Docker, public searx.space instances, or custom URLs
- **Modern UI**: Card-based results with dark/light themes
- **Privacy-First**: All searches proxied through SearXNG — no direct requests to search engines
- **Autocomplete**: Real-time search suggestions from SearXNG
- **Search History**: Local history with search and delete
- **Responsive**: Works on desktop, tablet, and mobile
- **No Frameworks**: Pure vanilla HTML/CSS/JS

## Quick Start

### 1. Start with Docker Compose

```bash
docker compose up -d
```

This starts three services:
- **SearXNG** on port 8080 (internal)
- **Valkey** (Redis-compatible cache) on port 6379 (internal)
- **Nginx** on port 3000 (frontend + API proxy)

### 2. Open in Browser

Navigate to: **http://localhost:3000**

Nginx serves the frontend and proxies `/api/` requests to SearXNG, eliminating CORS issues.

### 3. Configure (Optional)

Edit `.env` to change ports:
```env
SEARXNG_PORT=8080
FRONTEND_PORT=3000
SEARXNG_SECRET=change-this-to-a-random-string
```

## Architecture

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
| **Local Docker** | Default — uses the SearXNG instance running in Docker (via nginx proxy) |
| **Public** | Browse and select from public instances listed on searx.space |
| **Custom** | Enter any SearXNG instance URL manually |

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
├── nginx.conf              # Nginx config (static + API proxy)
├── searxng/
│   └── settings.yml        # SearXNG configuration
├── index.html              # Main HTML shell
├── css/
│   └── style.css           # Full styling with dark/light themes
├── js/
│   ├── config.js           # Category definitions, defaults, API config
│   ├── storage.js          # localStorage persistence
│   ├── searx-api.js        # SearXNG JSON API client
│   ├── instances.js         # Instance management (searx.space, custom)
│   ├── ui.js               # DOM helpers, card rendering, modals
│   └── app.js              # Main app logic, event handlers
└── icons/
    └── favicon.svg          # Search icon favicon
```

## SearXNG API

The frontend uses SearXNG's JSON API:

- **Search**: `GET /api/search?q={query}&format=json&categories={cat}&language={lang}&pageno={page}&time_range={range}&safesearch={level}`
- **Autocomplete**: `GET /api/autocompleter?q={partial}`

All requests go through nginx proxy (`/api/` → SearXNG) to avoid CORS.

## Customization

### Adding Engines

Edit `searxng/settings.yml` to enable/disable search engines. SearXNG supports 100+ engines.

### Changing Theme

Click the theme toggle button in the header, or set `data-theme="light"` on the `<html>` element in `index.html`.

### Changing Default Instance

Edit `CONFIG.defaultInstance` in `js/config.js`.

## License

MIT