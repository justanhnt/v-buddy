# Architecture: AI-Powered Trip Planner

VETC Buddy is a voice-first Vietnamese trip planner built for the **Qwen-VL hackathon**. It layers AI-powered experiences on top of VETC's existing toll-road payment platform.

## System Overview

```mermaid
graph TD
    subgraph Browser["Browser (Client)"]
        Planner["planner.tsx<br/>Chat UI + Voice + Quick Chips"]
        Voice["use-voice.ts<br/>Web Speech API (vi-VN)"]
        MapData["use-extract-map-data.ts<br/>Route/Place extraction"]
        Map["map/planner-map.tsx<br/>MapLibre GL + Overlays"]
        ToolResults["tool-results/<br/>Domain-grouped renderers"]
    end

    subgraph Server["Next.js Server"]
        ChatRoute["/api/chat<br/>Route Handler (streaming)"]
        VisionRoute["/api/vision<br/>Route Handler"]
        SystemPrompt["lib/chat/<br/>System prompt + trimming"]
        Tools["lib/tools/<br/>13+ AI tools (5 domains)"]
        Geo["lib/geo/<br/>Geocoding, routing, POI"]
    end

    subgraph External["External Services"]
        DashScope["DashScope<br/>Qwen 3.5-flash / Qwen-VL"]
        OSRM["OSRM<br/>Driving routes"]
        Nominatim["Nominatim<br/>Geocoding"]
        Overpass["Overpass API<br/>POI search (OSM)"]
        OpenMeteo["Open-Meteo<br/>Weather forecasts"]
        WSA["Web Speech API"]
        Tiles["OpenFreeMap<br/>Vector tiles"]
    end

    Planner --> Voice
    Planner --> MapData
    Planner --> Map
    Planner --> ToolResults
    Voice <--> WSA
    Map <--> Tiles
    Planner -->|POST /api/chat| ChatRoute
    Planner -->|POST /api/vision| VisionRoute
    ChatRoute --> SystemPrompt
    ChatRoute --> Tools
    Tools --> Geo
    Geo --> OSRM
    Geo --> Nominatim
    Geo --> Overpass
    Tools --> OpenMeteo
    ChatRoute --> DashScope
    VisionRoute --> DashScope
    ChatRoute -->|SSE stream| Planner
```

---

## Data Flow

### Chat flow (tool-use streaming)

```mermaid
sequenceDiagram
    actor User
    participant STT as Web Speech API
    participant P as planner.tsx
    participant API as /api/chat
    participant Qwen as Qwen 3.5-flash
    participant Tools as lib/tools/
    participant Ext as OSRM / Nominatim / Overpass
    participant Map as planner-map.tsx

    User->>STT: "Đi Đà Lạt hết bao nhiêu?"
    STT->>P: final transcript
    P->>API: POST { messages, userLocation }

    API->>Qwen: streamText (system prompt + messages + tools)
    Qwen-->>API: tool_call: plan_route("Đà Lạt")
    API->>Tools: execute plan_route
    Tools->>Ext: geocode + OSRM route
    Ext-->>Tools: route geometry
    Tools-->>API: { distanceKm, durationMin, path }

    Qwen-->>API: tool_call: estimate_toll(distance)
    API->>Tools: execute estimate_toll
    Tools-->>API: { toll_vnd, gates }

    Qwen-->>API: tool_call: estimate_fuel(distance)
    Qwen-->>API: tool_call: trip_summary(all costs)

    API-->>P: SSE stream (text + tool outputs)
    P->>P: useExtractMapData extracts route + places
    P->>Map: route + places props
    Map->>Map: Render route polyline + place markers
```

The system prompt instructs Qwen to chain tools: a route query must trigger `plan_route` -> `estimate_toll` -> `estimate_fuel` -> `trip_summary` (up to 8 tool steps per response).

### Vision flow

```
User captures photo of toll receipt
  -> POST /api/vision { image: base64 }
  -> DashScope Qwen-VL: messages with image_url content part
  -> Extracted: { tollGate, amount, licensePlate, timestamp }
  -> Client displays parsed receipt in chat
```

---

## AI Tools (13 tools, 5 domains)

Tools are defined in `src/lib/tools/` using the Vercel AI SDK `tool()` builder with Zod schemas.

| Domain | File | Tools | External APIs |
|--------|------|-------|---------------|
| **Routing** | `tools/routing.ts` | `plan_route`, `compare_routes`, `multi_stop_trip` | OSRM, Nominatim |
| **Places** | `tools/places.ts` | `search_places`, `get_nearby`, `search_along_route` | Overpass (OSM), Nominatim |
| **Costs** | `tools/costs.ts` | `estimate_toll`, `estimate_fuel`, `trip_summary` | Curated toll data |
| **Weather** | `tools/weather.ts` | `get_weather`, `weather_along_route` | Open-Meteo |
| **Misc** | `tools/misc.ts` | `check_wallet`, `analyze_image`, `web_search` | DashScope (vision), DuckDuckGo |

Shared helpers (vehicle multipliers, fuel prices, fuzzy city matching) live in `tools/helpers.ts`.

---

## Server / Client Boundary

```mermaid
graph TD
    subgraph Client["Client ('use client')"]
        C1["components/planner/planner.tsx — Orchestrator"]
        C2["components/planner/map/ — MapLibre GL"]
        C3["components/planner/tool-results/ — Tool renderers"]
        C4["components/planner/*.tsx — Chat UI components"]
        C5["hooks/ — use-voice, use-user-location, use-extract-map-data"]
    end

    subgraph RSC["Server Components"]
        S1["app/layout.tsx — Root layout, fonts"]
        S2["app/planner/page.tsx — Metadata, renders Planner"]
    end

    subgraph Routes["Route Handlers"]
        R1["app/api/chat/route.ts — AI chat (streaming)"]
        R2["app/api/vision/route.ts — Image analysis"]
    end

    subgraph Lib["Server-only Libraries"]
        L1["lib/dashscope.ts — Qwen model client"]
        L2["lib/tools/ — AI tool definitions"]
        L3["lib/geo/ — Geocoding, routing, POI"]
        L4["lib/chat/ — System prompt, message trimming"]
        L5["lib/weather.ts — Open-Meteo API"]
    end

    S1 --> S2
    S2 -->|renders| C1
    C1 --> C2
    C1 --> C3
    C1 --> C4
    C1 --> C5
    C1 -->|fetch| R1
    C1 -->|fetch| R2
    R1 --> L1
    R1 --> L2
    R1 --> L4
    L2 --> L3
    L2 --> L5
    R2 --> L1
```

**Rules:**
- `"use client"` only on components that need browser APIs, hooks, or event handlers. Child imports inherit the client boundary.
- All `lib/` files are server-only — no `"use client"` directive.
- API keys (`DASHSCOPE_API_KEY`) live only in server code. Never prefix with `NEXT_PUBLIC_`.

---

## Geo Module (`lib/geo/`)

Handles all geographic operations via a barrel export (`index.ts`).

| File | Responsibility | External API |
|------|---------------|--------------|
| `constants.ts` | VN_CENTER, corridor waypoints, Overpass endpoints, OSM category mappings | — |
| `math.ts` | `haversineKm`, `simplifyPath`, `computeCumulativeDistances` | — |
| `geocoding.ts` | `geocode`, `reverseGeocode`, `nearestCityName`, `buildAddress` | Nominatim |
| `routing.ts` | `route`, `buildOsrmCoords` (with Vietnam corridor waypoints) | OSRM |
| `poi.ts` | `searchPOI`, `deduplicatePlaces`, chain extraction, category detection | Overpass |
| `rest-stops.ts` | `findRestStopsAlongRoute` (batched Overpass queries along route) | Overpass |

Vietnam-specific: long-distance routes inject corridor waypoints to keep OSRM domestic (prevents routing through Laos/Cambodia). POI deduplication normalizes chain/brand names ("Highland Coffee - Q1" and "Highland Coffee - Nguyen Hue" collapse to one entry).

---

## Message Context Management

The chat endpoint (`api/chat/route.ts`) manages context size:

- Keeps last 20 messages (10 conversation turns)
- For older messages: strips `path` arrays, keeps only first 2-3 search results
- System prompt injects today's date and user's current location
- Up to 8 tool-call steps per response (`stopWhen: stepCountIs(8)`)

Logic lives in `lib/chat/system-prompt.ts` and `lib/chat/trim-messages.ts`.
