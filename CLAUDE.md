@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

`vetc-buddy` is a Next.js **companion / hackathon add-on** layered on top of VETC — an established Vietnamese mobility app whose core product already ships non-stop (ETC) toll-road payment and a built-in wallet. This repo does **not** reimplement those features; it prototypes new AI-powered experiences that call into VETC's existing capabilities (wallet, trip/toll history, vehicle registration).

Planned add-on features (hackathon scope, inspired by the Tesla × Grok viral demos):
- Conversational AI trip planning that understands wallet balance, toll costs along a route, and vehicle type.
- Other mobility-AI experiments layered on the same wallet + toll primitives.

When reasoning about product behavior, assume VETC's core domain (accounts, wallet, tolls, vehicles) is an **upstream system this app integrates with**, not something to design from scratch. Flows that touch money or toll transactions should be designed as VETC API calls, not local state.

## Stack & versions (read before coding)

- **Next.js 16.2.3** with Turbopack, App Router, React 19.2.
- **This is not the Next.js in your training data.** `AGENTS.md` (imported above) is explicit: APIs, conventions, and file structure may differ. Before writing or modifying Next.js-specific code (routing, `use client`/`use server`, caching, `fetch` behavior, middleware, metadata, config), consult `node_modules/next/dist/docs/` for the installed version. Heed deprecation notices shown at build/dev time.
- TypeScript strict mode, Tailwind CSS v4 (via `@tailwindcss/postcss`), ESLint 9 flat config (`eslint.config.mjs`) extending `eslint-config-next`.
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

- **App Router under `src/app/`.** `layout.tsx` is the root shell; `page.tsx` is the landing route. New features should be added as route segments (e.g. `src/app/trip-planner/`) or grouped routes, not a separate `pages/` tree.
- **Server vs client boundary matters.** Default to Server Components; only add `"use client"` when a component actually needs browser APIs, state, or event handlers. AI streaming endpoints and any VETC API calls that need secrets belong in Route Handlers (`app/**/route.ts`) or Server Actions — never in client components.
- **Secrets & VETC integration.** Any VETC API credentials, LLM provider keys, or signing secrets must come from env vars and only be read in server code. Do not prefix them with `NEXT_PUBLIC_`.
- **Styling:** Tailwind v4 (CSS-first config in `src/app/globals.css`). Prefer utility classes; reach for CSS only when Tailwind can't express it.

## AI provider: Qwen-VL via Alibaba DashScope (hackathon track)

This project is built for the **Qwen-VL hackathon**, so all LLM / vision-LLM calls go through Alibaba Cloud **DashScope**, not OpenAI/Anthropic. Default to Qwen models (Qwen-VL for multimodal image+text, Qwen3.x text/flash for routing/extraction). A sibling project at `../tocky` is the reference implementation for DashScope usage — consult it before inventing a new pattern.

### What to build where

- **Server-side only.** DashScope API key must never reach the browser. Call Qwen from Route Handlers (`src/app/**/route.ts`) or Server Actions. Keep a single `dashscope` client module under `src/lib/` and import from there — don't sprinkle `fetch(dashscope...)` across routes.
- **Multimodal inputs** (photos of toll gates, vehicle plates, receipts, maps) — use Qwen-VL with image URLs or base64 data URIs per the DashScope OpenAI-compatible `messages` → `content` (text + image_url parts) shape.
- **Streaming** — use the OpenAI-compatible SSE streaming; surface to clients via a Route Handler that re-streams, not by exposing DashScope directly.
- Regional endpoint matters: use `dashscope-intl.aliyuncs.com` for Singapore, `dashscope.aliyuncs.com` for Beijing. Default to intl unless told otherwise.

## When a library/framework question comes up

Use the context7 MCP tools to pull current docs for Next.js 16, React 19, Tailwind v4, or any SDK — training data is likely stale for all of these. For Next.js specifically, also cross-check `node_modules/next/dist/docs/` since that's pinned to the installed version. For DashScope / Qwen specifics, prefer mirroring `../tocky`'s working code over guessing from docs.
