@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

`vetc-buddy` is a Next.js **companion / hackathon add-on** layered on top of VETC — an established Vietnamese mobility app whose core product already ships non-stop (ETC) toll-road payment and a built-in wallet. This repo does **not** reimplement those features; it prototypes new AI-powered experiences that call into VETC's existing capabilities (wallet, trip/toll history, vehicle registration).

### What's built

The app ships a **voice-first AI trip planner** at `/planner` (root `/` redirects there):
- **AI chat** with 13+ tools (route planning, toll/fuel cost estimation, POI search, weather, wallet check, image analysis, web search) powered by Qwen via DashScope.
- **Voice input** via Web Speech API (`hooks/use-voice.ts`) with Vietnamese (`vi-VN`) recognition. Fallback to keyboard input.
- **Interactive MapLibre GL map** (`components/planner/map/`) with OpenFreeMap vector tiles, place markers by category, route polylines, and user geolocation dot. Centered on HCMC.
- **Chat-style UI** (`components/planner/planner.tsx`) with message bubbles, place cards, route comparison cards, and quick-action chips.
- **Real data** from OSRM (routing), Nominatim (geocoding), Overpass/OSM (POI search), Open-Meteo (weather). Wallet balance is mock.
- **Vision analysis** via Qwen-VL for toll receipts, license plates, and traffic signs.

### What's next

- Integrate VETC APIs for real wallet balance, toll costs, and vehicle data.
- Add more Qwen-VL multimodal features (photo of toll gate, plate recognition, receipt scanning).
- Expand toll route database beyond the current curated Vietnamese expressways.

When reasoning about product behavior, assume VETC's core domain (accounts, wallet, tolls, vehicles) is an **upstream system this app integrates with**, not something to design from scratch. Flows that touch money or toll transactions should be designed as VETC API calls, not local state.

## Stack & versions (read before coding)

- **Next.js 16.2.3** with Turbopack, App Router, React 19.2.
- **This is not the Next.js in your training data.** `AGENTS.md` (imported above) is explicit: APIs, conventions, and file structure may differ. Before writing or modifying Next.js-specific code (routing, `use client`/`use server`, caching, `fetch` behavior, middleware, metadata, config), consult `node_modules/next/dist/docs/` for the installed version. Heed deprecation notices shown at build/dev time.
- TypeScript strict mode, Tailwind CSS v4 (via `@tailwindcss/postcss`), ESLint 9 flat config (`eslint.config.mjs`) extending `eslint-config-next`.
- **MapLibre GL JS** (`maplibre-gl` v5) for interactive maps — no Mapbox token needed.
- Path alias: `@/*` → `./src/*`.
- Package manager: **pnpm** (lockfile present, `pnpm-workspace.yaml` exists mainly to pin `ignoredBuiltDependencies`).

## Commands

```bash
pnpm dev        # next dev (Turbopack) — http://localhost:3000
pnpm build      # next build
pnpm start      # next start (serve the production build)
pnpm lint       # eslint (flat config)
```

No test runner is configured yet. If you add tests, wire the script into `package.json` and document the single-test invocation here.

## Architecture notes

### Project structure

The project follows Next.js Strategy 1 ("store project files outside `app/`") + Bulletproof React conventions. `app/` is routing-only; all code is organized by technical concern in sibling directories.

```
src/
├── app/                    # ROUTING ONLY — page.tsx, layout.tsx, route.ts
│   ├── api/chat/           # AI chat endpoint (thin handler)
│   ├── api/vision/         # Image analysis endpoint
│   └── planner/            # page.tsx imports <Planner> from components/
├── components/             # ALL components
│   ├── ui/                 # Shared primitives (badge, button, card, chip, skeleton, tooltip)
│   └── planner/            # Planner feature components
│       ├── planner.tsx     # Main orchestrator
│       ├── map/            # MapLibre map (planner-map.tsx + overlays, constants, utils)
│       ├── tool-results/   # AI tool output renderers grouped by domain
│       └── *.tsx           # Chat UI components (composer, message-list, etc.)
├── hooks/                  # Custom React hooks (use-voice, use-user-location, use-extract-map-data)
├── lib/                    # Server-side utilities (no "use client" here)
│   ├── chat/               # System prompt + message trimming
│   ├── geo/                # Geocoding, routing, POI search, math (barrel re-export via index.ts)
│   ├── tools/              # AI tool definitions grouped by domain (routing, places, costs, weather, misc)
│   ├── dashscope.ts        # Qwen model client
│   ├── format.ts           # VND formatter
│   ├── toll-data.ts        # Vietnamese expressway toll data
│   ├── wallet-mock.ts      # Mock VETC wallet
│   └── weather.ts          # Open-Meteo weather API
└── types/                  # Shared TypeScript types (planner.ts)
```

### File naming

All filenames use **kebab-case** (`planner-map.tsx`, `use-voice.ts`, `route-compare-card.tsx`). Component export names stay PascalCase. This matches Next.js conventions and avoids case-sensitivity issues across macOS/Linux.

### Key patterns

- **`app/` is thin.** Route files (`page.tsx`) only import and render components. All logic lives outside `app/`.
- **Planner page** — `app/planner/page.tsx` is a server component that renders `<Planner />` (client). The map is loaded via `next/dynamic` (SSR disabled) because MapLibre needs the DOM.
- **AI tools** — 13+ tools defined in `lib/tools/` grouped by domain (routing, places, costs, weather, misc). Each tool uses the Vercel AI SDK `tool()` builder with Zod schemas.
- **Tool result rendering** — `components/planner/tool-results/` mirrors the tool domain grouping. The dispatcher (`index.tsx`) handles loading/error states and delegates to domain renderers.
- **Voice hook** (`hooks/use-voice.ts`) — wraps Web Speech API for push-to-talk Vietnamese recognition. Degrades to keyboard on unsupported browsers.
- **Map data extraction** (`hooks/use-extract-map-data.ts`) — derives routes and places from chat messages for the map.
- **Server vs client boundary.** Default to Server Components; only add `"use client"` when a component needs browser APIs, state, or event handlers. `"use client"` marks a boundary — child imports don't need the directive. All `lib/` files are server-only.
- **Secrets & VETC integration.** Credentials and API keys come from env vars, read only in server code. Do not prefix with `NEXT_PUBLIC_`.
- **Styling:** Tailwind v4 (CSS-first config in `src/app/globals.css`). Prefer utility classes; reach for CSS only when Tailwind can't express it.

## AI provider: Qwen-VL via Alibaba DashScope (hackathon track)

This project is built for the **Qwen-VL hackathon**, so all LLM / vision-LLM calls go through Alibaba Cloud **DashScope**, not OpenAI/Anthropic. Default to Qwen models (Qwen-VL for multimodal image+text, Qwen3.x text/flash for routing/extraction). A sibling project at `../tocky` is the reference implementation for DashScope usage — consult it before inventing a new pattern.

### What to build where

- **Server-side only.** DashScope API key must never reach the browser. Call Qwen from Route Handlers (`src/app/api/*/route.ts`) or Server Actions. The DashScope client is at `src/lib/dashscope.ts` — import from there, don't sprinkle `fetch(dashscope...)` across routes.
- **Multimodal inputs** (photos of toll gates, vehicle plates, receipts, maps) — use Qwen-VL with image URLs or base64 data URIs per the DashScope OpenAI-compatible `messages` → `content` (text + image_url parts) shape.
- **Streaming** — use the OpenAI-compatible SSE streaming; surface to clients via a Route Handler that re-streams, not by exposing DashScope directly.
- Regional endpoint matters: use `dashscope-intl.aliyuncs.com` for Singapore, `dashscope.aliyuncs.com` for Beijing. Default to intl unless told otherwise.

## When a library/framework question comes up

Use the context7 MCP tools to pull current docs for Next.js 16, React 19, Tailwind v4, or any SDK — training data is likely stale for all of these. For Next.js specifically, also cross-check `node_modules/next/dist/docs/` since that's pinned to the installed version. For DashScope / Qwen specifics, prefer mirroring `../tocky`'s working code over guessing from docs.
