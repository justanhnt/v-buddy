# Architecture: AI-Powered Trip Planner

VETC Buddy is a voice-first Vietnamese trip planner built for the **Qwen-VL hackathon**. It layers AI-powered experiences on top of VETC's existing toll-road payment platform. This document covers the current prototype architecture and the planned AI integration.

## System Overview

```mermaid
graph TD
    subgraph Browser["Browser (Client)"]
        Planner["Planner.tsx<br/>Chat UI · Voice · Quick Chips"]
        Voice["useVoice.ts<br/>Web Speech API (vi-VN)"]
        Intent["intent.ts<br/>Regex NLP (19 rules)"]
        Map["PlannerMap.tsx<br/>MapLibre GL · Markers · Routes"]
        Mock["mock-data.ts<br/>HCMC routes & places"]
    end

    subgraph Server["Next.js Server"]
        Page["planner/page.tsx<br/>Server Component + Metadata"]
        Layout["layout.tsx<br/>Root Shell · Geist Font"]
    end

    subgraph External["External Services"]
        WSA["Web Speech API<br/>Google / OS STT"]
        Tiles["OpenFreeMap<br/>Vector Tiles (OSM fallback)"]
    end

    Layout --> Page
    Page -->|renders| Planner
    Planner --> Voice
    Planner -->|parseIntent| Intent
    Planner -->|reads| Mock
    Planner -->|props| Map
    Voice <-->|audio / transcript| WSA
    Map <-->|tiles + events| Tiles
```

Everything currently runs **client-side** except the server component shell. No API routes, no backend calls, no secrets needed. The app works offline (minus map tiles and speech recognition).

---

## Current Data Flow (Regex Intent)

The current prototype uses regex-based Vietnamese NLP — no LLM calls.

```mermaid
sequenceDiagram
    actor User
    participant Mic as useVoice.ts
    participant STT as Web Speech API
    participant P as Planner.tsx
    participant I as intent.ts
    participant M as mock-data.ts
    participant Map as PlannerMap.tsx

    User->>Mic: Press mic button
    Mic->>STT: SpeechRecognition.start()
    User->>STT: "Tìm trạm sạc gần đây"
    STT-->>Mic: interim transcript (italic bubble)
    STT->>Mic: final transcript
    Mic->>P: onFinal("Tìm trạm sạc gần đây")
    P->>I: parseIntent(raw)
    Note over I: strip() removes diacritics<br/>đ → d, lowercase, NFD
    I->>I: Match regex: /sac|tram sac|charger.../
    I-->>P: { kind: "places", category: "charge" }
    P->>M: PLACE_SOURCE["charge"]
    M-->>P: 4 EV charging stations
    P->>P: setMessages() + setMapPlaces()
    P->>Map: places={chargeStations}
    Map->>Map: Render markers on map
```

**Key characteristic:** Zero network calls (except browser speech-to-text and map tiles). Fast, but limited to 19 hardcoded regex patterns.

---

## Intent System

`intent.ts` normalizes Vietnamese input via `strip()` (lowercase, NFD diacritic removal, `d` for `d`), then matches against rules top-to-bottom. First match wins.

### Place intents

| Category | Keywords (stripped) | Example input |
|----------|-------------------|---------------|
| EV Charging | `sac, tram sac, charger, xe dien, ev, vinfast` | "tìm trạm sạc" |
| Fuel | `xang, do xang, ron, petrol, nhien lieu` | "đổ xăng" |
| Parking | `do xe, bai xe, parking, cho dau` | "chỗ đỗ xe" |
| Insurance | `bao hiem, insurance, tnds, 2 chieu` | "mua bảo hiểm" |
| Food | `an, quan an, doi, nha hang, pho, com, bun, banh mi` | "đói bụng rồi" |

### Route preference intents

| Preference | Keywords (stripped) | Example input |
|-----------|-------------------|---------------|
| Few tolls | `tranh tram, it tram, khong phi, mien phi` | "tránh trạm thu phí" |
| Highway | `cao toc, highway, duong cao toc` | "đi cao tốc" |
| Coastal | `bien, ven bien, duong bien` | "đường ven biển" |
| Scenic | `rung, phong canh, scenic, ngam canh` | "ngắm cảnh" |
| Fastest | `nhanh, gap, voi, ket xe` | "đi nhanh nhất" |
| Cheapest | `re, tiet kiem, it tien, budget` | "tuyến tiết kiệm" |
| General route | `ve nha, toi, den, di tu, chi duong` | "chỉ đường về nhà" |

### Other intents

| Kind | Keywords (stripped) | Example input |
|------|-------------------|---------------|
| Trip plan | `ke hoach, len ke hoach, chuyen di, du lich, phuot` | "lên kế hoạch đi Đà Lạt" |
| Unknown | _(no match)_ | Fallback with help text |

Route results are scored by preference — `scoreRoute()` in `Planner.tsx` ranks mock routes by duration, toll cost, toll stops, or tag match.

---

## Planned AI Architecture (DashScope / Qwen)

The regex intent parser will be replaced with Qwen LLM calls via Alibaba Cloud DashScope. Qwen-VL adds multimodal capabilities (photo recognition).

```mermaid
graph LR
    subgraph Browser["Browser"]
        P["Planner.tsx"]
        V["useVoice.ts"]
        M["PlannerMap.tsx"]
    end

    subgraph Server["Next.js Server"]
        Chat["/api/chat<br/>Route Handler"]
        Vision["/api/vision<br/>Route Handler"]
        DS["lib/dashscope.ts<br/>DashScope Client"]
    end

    subgraph Alibaba["Alibaba Cloud DashScope"]
        Qwen["Qwen 3.x<br/>Text LLM"]
        QwenVL["Qwen-VL<br/>Vision + Text"]
    end

    subgraph VETC["VETC Platform"]
        Wallet["Wallet API"]
        Toll["Toll / Trip API"]
        Vehicle["Vehicle API"]
    end

    subgraph Ext["External"]
        STT["Web Speech API"]
        Tiles["OpenFreeMap"]
    end

    V <--> STT
    M <--> Tiles
    P -->|POST text| Chat
    P -->|POST image| Vision
    Chat --> DS
    Vision --> DS
    DS --> Qwen
    DS --> QwenVL
    Chat --> Wallet
    Chat --> Toll
    Chat --> Vehicle
    Chat -->|SSE stream| P
    Vision -->|JSON| P
```

### Key design decisions

- **Server-side only**: `DASHSCOPE_API_KEY` never reaches the browser. All LLM calls go through Route Handlers.
- **Single client module**: `src/lib/dashscope.ts` wraps DashScope's OpenAI-compatible API. All routes import from there.
- **Regional endpoint**: `dashscope-intl.aliyuncs.com` (Singapore) by default.
- **Streaming**: Route Handlers re-stream SSE from DashScope to the browser. No direct DashScope exposure.
- **Regex fallback**: `intent.ts` stays as an offline fallback when the API is unreachable.

---

## Planned Data Flow (AI-Powered)

```mermaid
sequenceDiagram
    actor User
    participant STT as Web Speech API
    participant P as Planner.tsx
    participant API as /api/chat
    participant DS as lib/dashscope.ts
    participant Qwen as Qwen 3.x (DashScope)
    participant VETC as VETC APIs
    participant Map as PlannerMap.tsx

    User->>STT: "Đi Long Thành tránh trạm thu phí, ví còn bao nhiêu?"
    STT->>P: final transcript
    P->>API: POST { message, history }

    API->>DS: buildMessages(system prompt + user message)
    DS->>Qwen: /chat/completions (stream: true)
    Qwen-->>DS: Structured JSON intent + reply

    API->>VETC: GET /wallet/balance
    VETC-->>API: { balance: 250000 }

    API-->>P: SSE stream: intent + routes + wallet info
    P->>P: Update chat + map state
    P->>Map: route={bestRoute}, places=[]
    Map->>Map: Draw route polyline + fit bounds
```

### Multimodal flow (Qwen-VL)

```
User takes photo of toll receipt
  → POST /api/vision { image: base64 }
  → DashScope Qwen-VL: messages with image_url content part
  → Extracted data: { tollGate: "Long Thành", amount: 80000, plate: "51A-123.45" }
  → Client displays parsed receipt in chat
```

---

## Server / Client Boundary

```mermaid
graph TD
    subgraph Client["Client ('use client')"]
        C1["Planner.tsx — Chat UI, state, handlers"]
        C2["PlannerMap.tsx — MapLibre GL (dynamic import, SSR off)"]
        C3["useVoice.ts — Web Speech API hook"]
        C4["intent.ts — Regex fallback (runs client-side)"]
    end

    subgraph RSC["Server Components"]
        S1["layout.tsx — Root layout, fonts, global CSS"]
        S2["planner/page.tsx — Metadata, renders Planner"]
    end

    subgraph Routes["Route Handlers (planned)"]
        R1["api/chat/route.ts — LLM intent + response"]
        R2["api/vision/route.ts — Qwen-VL multimodal"]
    end

    subgraph Lib["Server Libs (planned)"]
        L1["lib/dashscope.ts — DashScope client"]
        L2["lib/vetc.ts — VETC API client"]
    end

    S1 --> S2
    S2 -->|renders| C1
    C1 --> C2
    C1 --> C3
    C1 -.->|fallback| C4
    C1 -->|fetch| R1
    C1 -->|fetch| R2
    R1 --> L1
    R1 --> L2
    R2 --> L1

    style Routes fill:#fef3c7,stroke:#f59e0b
    style Lib fill:#fef3c7,stroke:#f59e0b
```

Yellow = planned, not yet implemented.

**Rule**: API keys (`DASHSCOPE_API_KEY`, `VETC_API_KEY`) live only in server code. Never prefix with `NEXT_PUBLIC_`.

---

## Planned Module Structure

```
src/
  lib/
    dashscope.ts          # OpenAI-compatible DashScope client (fetch-based)
    vetc.ts               # VETC platform API client
  app/
    api/
      chat/route.ts       # POST — LLM intent classification + response (SSE)
      vision/route.ts     # POST — Qwen-VL multimodal (image → structured data)
    planner/
      page.tsx            # Server component (unchanged)
      Planner.tsx         # Updated: calls /api/chat instead of parseIntent()
      PlannerMap.tsx       # Unchanged
      useVoice.ts         # Unchanged
      intent.ts           # Kept as offline/fallback parser
      mock-data.ts        # Kept for demo mode
      types.ts            # Extended with AI response types
      icons.tsx           # Unchanged
```

### DashScope client pattern (from reference project)

```typescript
// src/lib/dashscope.ts — server-only
const BASE_URL = process.env.DASHSCOPE_BASE_URL
  ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

export async function chatCompletion(messages: Message[], opts?: { stream?: boolean }) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.DASHSCOPE_MODEL ?? "qwen3.5-flash",
      messages,
      stream: opts?.stream ?? false,
    }),
  });
  return res;
}
```
