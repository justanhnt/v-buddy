# VETC Buddy

AI-powered driving companion layered on top of [VETC](https://vetc.com.vn) — Vietnam's non-stop toll-road payment platform. Built for the **Qwen-VL hackathon**.

VETC Buddy adds a conversational trip-planning experience on top of VETC's existing wallet, toll history, and vehicle registration capabilities. Think of it as a Vietnamese "Tesla × Grok" for the road.

## Features

- **Voice-first interface** — press the mic and speak naturally in Vietnamese; Web Speech API handles recognition.
- **Smart intent parsing** — understands requests for EV charging stations, fuel, food, parking, insurance, route planning, and trip planning.
- **Route comparison** — ranks routes by preference (fastest, cheapest, fewest tolls, scenic, coastal, highway) with toll cost and duration breakdowns.
- **Interactive map** — MapLibre GL map centered on Ho Chi Minh City with place markers, route lines, and geolocation.
- **Quick chips** — one-tap shortcuts for common queries (charging, food, fuel, tolls, parking, insurance).
- **Mobile-friendly** — bottom-sheet panel on mobile, side panel on desktop, dark mode support.

## Tech stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**, TypeScript (strict)
- **Tailwind CSS v4**
- **MapLibre GL JS** (OpenFreeMap vector tiles, OSM raster fallback)
- **Qwen-VL via DashScope** (planned — AI provider for multimodal LLM calls)

## Getting started

```bash
# Install dependencies
pnpm install

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
src/app/
  layout.tsx          # Root layout (Geist font, global styles)
  page.tsx            # Redirects to /planner
  globals.css         # Tailwind v4 CSS-first config
  planner/
    page.tsx          # Trip planner route (server component w/ metadata)
    Planner.tsx       # Main client component — chat, voice, quick chips
    PlannerMap.tsx     # MapLibre GL map with markers and route lines
    useVoice.ts       # Web Speech API hook (Vietnamese)
    intent.ts         # Regex-based intent parser for Vietnamese input
    types.ts          # Shared types (Route, Place, LngLat, etc.)
    mock-data.ts      # HCMC mock data (routes, restaurants, fuel, EV, parking, insurance)
    icons.tsx         # SVG icon components
```

## License

Private — hackathon project.
