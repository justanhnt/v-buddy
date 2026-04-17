# VETC Buddy

AI-powered driving companion layered on top of [VETC](https://vetc.com.vn) — Vietnam's non-stop toll-road payment platform. Built for the **Qwen-VL hackathon**.

VETC Buddy adds a conversational trip-planning experience on top of VETC's existing wallet, toll history, and vehicle registration capabilities.

## Features

- **AI chat with 13+ tools** — route planning, toll/fuel cost estimation, POI search, weather forecasts, wallet check, image analysis, and web search — all powered by Qwen via DashScope.
- **Voice-first interface** — press the mic and speak naturally in Vietnamese; Web Speech API handles recognition.
- **Route comparison** — compare up to 3 routes with toll cost, fuel cost, and duration breakdowns. Multi-stop trip planning with per-leg details.
- **Interactive map** — MapLibre GL with OpenFreeMap vector tiles, native GeoJSON layers for places and routes, geolocation dot, and Vietnamese island sovereignty labels.
- **Real data** — OSRM for routing, Nominatim for geocoding, Overpass/OSM for POI search, Open-Meteo for weather. Intelligent Vietnam-specific routing (corridor waypoints to prevent routing through Laos/Cambodia).
- **Vision analysis** — Qwen-VL for toll receipt extraction, license plate reading, and traffic sign analysis.
- **Mobile-friendly** — bottom-sheet panel on mobile, side panel on desktop, dark mode support.

## Tech stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**, TypeScript (strict)
- **Tailwind CSS v4**
- **Vercel AI SDK** (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) for tool-use streaming
- **MapLibre GL JS** (OpenFreeMap vector tiles)
- **Qwen via DashScope** (Qwen 3.5-flash for text, Qwen-VL-max for vision)

## Getting started

```bash
# Install dependencies
pnpm install

# Copy env template and add your DashScope key
cp .env.example .env

# Start dev server (Turbopack)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the trip planner.

## Scripts

```bash
pnpm dev        # next dev (Turbopack) — http://localhost:3000
pnpm build      # next build
pnpm start      # next start (production)
pnpm lint       # eslint (flat config)
```

## Project structure

```
src/
├── app/                    # Routing only (page.tsx, layout.tsx, route.ts)
│   ├── api/chat/           # AI chat endpoint
│   ├── api/vision/         # Image analysis endpoint
│   └── planner/            # Trip planner page
├── components/
│   ├── ui/                 # Shared UI primitives (badge, button, card, etc.)
│   └── planner/            # Planner feature components
│       ├── planner.tsx     # Main orchestrator (chat + map + voice)
│       ├── map/            # MapLibre map module
│       ├── tool-results/   # AI tool output renderers (by domain)
│       └── *.tsx           # Chat UI (composer, message-list, etc.)
├── hooks/                  # Custom hooks (use-voice, use-user-location, etc.)
├── lib/                    # Server-side utilities
│   ├── chat/               # System prompt + message trimming
│   ├── geo/                # Geocoding, routing, POI search
│   └── tools/              # AI tool definitions (by domain)
└── types/                  # Shared TypeScript types
```

See [docs/architecture.md](docs/architecture.md) for detailed architecture diagrams.

## License

Private — hackathon project.
