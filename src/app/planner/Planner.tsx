"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import Markdown from "react-markdown";

import { VND } from "./mock-data";
import type { LngLat, Place, PlaceCategory, RouteResult } from "./types";
import {
  IconArrow,
  IconCafe,
  IconCamera,
  IconCharge,
  IconClock,
  IconFork,
  IconFuel,
  IconHotel,
  IconKeyboard,
  IconMic,
  IconParking,
  IconRestStop,
  IconShield,
  IconSparkle,
  IconStop,
  IconSummary,
  IconToll,
  IconWallet,
  IconWeather,
} from "./icons";
import { useVoice } from "./useVoice";

const PlannerMap = dynamic(() => import("./PlannerMap"), { ssr: false });

const CATEGORY_LABEL: Record<string, string> = {
  eat: "Quán ăn",
  cafe: "Cafe",
  fuel: "Trạm xăng",
  charge: "Trạm sạc",
  parking: "Bãi đỗ",
  hotel: "Khách sạn",
  rest_stop: "Trạm dừng chân",
  insurance: "Bảo hiểm",
};

const CATEGORY_ICON: Record<
  string,
  (p: { className?: string }) => React.ReactElement
> = {
  eat: IconFork,
  cafe: IconCafe,
  fuel: IconFuel,
  charge: IconCharge,
  parking: IconParking,
  hotel: IconHotel,
  rest_stop: IconRestStop,
  insurance: IconShield,
};

const CATEGORY_TILE: Record<string, string> = {
  eat: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  cafe: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  fuel: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  charge:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  parking:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  hotel:
    "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  rest_stop:
    "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
  insurance:
    "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
};

const QUICK_CHIPS = [
  { label: "Trạm sạc gần đây", icon: IconCharge },
  { label: "Đói bụng rồi", icon: IconFork },
  { label: "Đổ xăng", icon: IconFuel },
  { label: "Số dư ví VETC", icon: IconWallet },
  { label: "Thời tiết", icon: IconWeather },
  { label: "Chỗ đỗ xe", icon: IconParking },
  { label: "So sánh tuyến đường", icon: IconToll },
];

const INITIAL_MESSAGE: UIMessage = {
  id: "welcome",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Chào bạn! Nhấn giữ micro và nói bạn cần gì \u2014 mình tìm tuyến đường, quán ăn, trạm sạc, bảo hiểm\u2026 tất cả trong một câu.",
    },
  ],
};

export default function Planner() {
  const { messages, sendMessage, status, stop } = useChat({
    id: "planner",
    messages: [INITIAL_MESSAGE],
  });

  const [typed, setTyped] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number>(0);
  const [focusCoord, setFocusCoord] = useState<LngLat | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isLoading = status === "streaming" || status === "submitted";

  // Send a message via voice or keyboard
  const send = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t || isLoading) return;
      sendMessage({ text: t });
    },
    [sendMessage, isLoading],
  );

  // Handle image upload — convert to base64 and send as a text message with instructions
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || isLoading) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUri = reader.result as string;
        // Send the image data URI as a special message the LLM can use with analyze_image
        sendMessage({
          text: `Phân tích ảnh này: ${dataUri}`,
        });
      };
      reader.readAsDataURL(file);

      // Reset so user can upload same file again
      e.target.value = "";
    },
    [sendMessage, isLoading],
  );

  const voice = useVoice(send, "vi-VN");

  // Auto-scroll on new message
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, voice.transcript]);

  // Extract map data from the latest tool results
  const { mapPlaces, activeRoute } = useMemo(() => {
    const places: Place[] = [];
    let route: RouteResult | null = null;
    let tollVnd = 0;
    let tollStops = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;

      for (const part of msg.parts) {
        if (
          part.type.startsWith("tool-") &&
          "state" in part &&
          part.state === "output-available" &&
          "output" in part &&
          part.output
        ) {
          const output = part.output as Record<string, unknown>;
          const toolName = part.type.replace("tool-", "");

          // Places from search_places or get_nearby
          if (
            (toolName === "search_places" || toolName === "get_nearby") &&
            Array.isArray(output.places) &&
            output.places.length > 0 &&
            places.length === 0
          ) {
            for (const p of output.places) {
              places.push(p as Place);
            }
          }

          // Collect toll data from the same message
          if (toolName === "estimate_toll" && output.estimated) {
            tollVnd = output.toll_vnd as number ?? 0;
            tollStops = (output.gates as unknown[])?.length ?? 0;
          }

          // Route from plan_route
          if (toolName === "plan_route" && output.path && Array.isArray(output.path) && !route) {
            route = {
              id: `route-${i}`,
              label: `${(output.from as Record<string, unknown>)?.name ?? ""} → ${(output.to as Record<string, unknown>)?.name ?? ""}`,
              from: String(
                (output.from as Record<string, unknown>)?.name ?? "",
              ),
              to: String((output.to as Record<string, unknown>)?.name ?? ""),
              distanceKm: output.distanceKm as number,
              durationMin: output.durationMin as number,
              tollVnd: 0,
              tollStops: 0,
              tags: [],
              path: output.path as LngLat[],
            };
          }

          // Route from compare_routes — use selected route
          if (toolName === "compare_routes" && Array.isArray(output.routes) && !route) {
            const routes = output.routes as { path: LngLat[]; distance_km: number; duration_min: number; toll_vnd: number; label: string }[];
            const selected = routes[selectedRouteIdx] ?? routes[0];
            if (selected) {
              const from = output.from as Record<string, unknown>;
              const to = output.to as Record<string, unknown>;
              route = {
                id: `compare-${i}-${selectedRouteIdx}`,
                label: selected.label,
                from: String(from?.name ?? ""),
                to: String(to?.name ?? ""),
                distanceKm: selected.distance_km,
                durationMin: selected.duration_min,
                tollVnd: selected.toll_vnd,
                tollStops: 0,
                tags: [],
                path: selected.path,
              };
            }
          }

          // Route segments from multi_stop_trip — combine all leg paths
          if (toolName === "multi_stop_trip" && Array.isArray(output.legs) && !route) {
            const legs = output.legs as { from: string; to: string; path: LngLat[]; distance_km: number; duration_min: number }[];
            const allPaths = legs.flatMap((l) => l.path);
            const totals = output.totals as Record<string, number>;
            if (allPaths.length > 0 && totals) {
              route = {
                id: `multistop-${i}`,
                label: legs.map((l) => l.from).concat(legs[legs.length - 1]?.to ?? "").join(" → "),
                from: legs[0]?.from ?? "",
                to: legs[legs.length - 1]?.to ?? "",
                distanceKm: totals.distance_km,
                durationMin: totals.duration_min,
                tollVnd: totals.toll_vnd,
                tollStops: 0,
                tags: [],
                path: allPaths,
              };
            }
          }
        }
      }

      // Only scan last assistant message with tool results
      if (places.length > 0 || route) break;
    }

    // Populate toll info from adjacent tool call in same message
    if (route && tollVnd > 0 && route.tollVnd === 0) {
      route.tollVnd = tollVnd;
      route.tollStops = tollStops;
    }

    return { mapPlaces: places, activeRoute: route };
  }, [messages, selectedRouteIdx]);

  const handlePickMarker = (id: string) => {
    const hit = mapPlaces.find((p) => p.id === id);
    if (hit) setFocusCoord(hit.coord);
  };

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside
        className={[
          "z-20 flex flex-col bg-white/95 backdrop-blur-md shadow-xl ring-1 ring-black/5",
          "dark:bg-zinc-900/95 dark:ring-white/10",
          "md:static md:h-full md:w-[440px] md:shrink-0",
          "absolute inset-x-0 bottom-0 rounded-t-2xl md:rounded-none",
          "transition-[height] duration-300 ease-out",
          sheetOpen ? "h-[82dvh]" : "h-[180px]",
          "md:h-full",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => setSheetOpen((s) => !s)}
          className="md:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700"
          aria-label="Toggle panel"
        />

        {/* Header */}
        <header className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span
                className={`inline-block h-2 w-2 rounded-full ${isLoading ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`}
              />
              VETC Buddy
            </div>
            <h1 className="mt-0.5 flex items-center gap-1.5 text-lg font-semibold tracking-tight">
              <IconSparkle className="h-4 w-4 text-blue-500" />
              Trợ lý đi đường
            </h1>
          </div>
        </header>

        {/* Chat thread */}
        <div
          ref={threadRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
        >
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onPickPlace={(c) => setFocusCoord(c)}
                onSelectRoute={setSelectedRouteIdx}
                selectedRouteIdx={selectedRouteIdx}
              />
            ))}
            {voice.listening && voice.transcript && (
              <li className="self-end max-w-[85%] rounded-2xl bg-blue-500/10 px-3.5 py-2.5 text-sm italic text-blue-800 ring-1 ring-blue-500/20 dark:text-blue-200">
                {voice.transcript}...
              </li>
            )}
            {isLoading &&
              messages[messages.length - 1]?.role === "user" && (
                <li className="self-start">
                  <div className="flex items-center gap-1.5 rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
                  </div>
                </li>
              )}
          </ul>
        </div>

        {/* Quick chips */}
        <div
          className="-mx-1 flex gap-1.5 overflow-x-auto px-4 pb-2 pt-1"
          style={{ scrollbarWidth: "none" }}
        >
          {QUICK_CHIPS.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => send(label)}
              disabled={isLoading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Mic + keyboard fallback */}
        <div className="border-t border-zinc-200 bg-white/80 px-4 pb-5 pt-3 dark:border-zinc-800 dark:bg-zinc-900/80">
          {voice.error && (
            <p className="mb-2 text-center text-xs text-rose-600 dark:text-rose-400">
              {voice.error}
            </p>
          )}
          {/* Hidden file input for image upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageUpload}
            className="hidden"
          />

          {showKeyboard ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(typed);
                setTyped("");
              }}
              className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-2 py-1.5 focus-within:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-600"
            >
              <button
                type="button"
                onClick={() => setShowKeyboard(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Dùng giọng nói"
              >
                <IconMic className="h-5 w-5" />
              </button>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Ví dụ: tìm trạm sạc gần đây"
                className="flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-zinc-400"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
                aria-label="Chụp/tải ảnh"
              >
                <IconCamera className="h-5 w-5" />
              </button>
              <button
                type="submit"
                disabled={!typed.trim() || isLoading}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
                aria-label="Gửi"
              >
                <IconArrow className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setShowKeyboard(true)}
                className="grid h-12 w-12 place-items-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                aria-label="Gõ tin nhắn"
              >
                <IconKeyboard className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isLoading) {
                    stop();
                  } else if (voice.listening) {
                    voice.stop();
                  } else {
                    voice.start();
                  }
                }}
                disabled={!voice.supported && !isLoading}
                className={[
                  "relative grid h-20 w-20 place-items-center rounded-full text-white shadow-lg transition",
                  isLoading
                    ? "bg-amber-500 hover:bg-amber-600"
                    : voice.listening
                      ? "bg-rose-500 hover:bg-rose-600"
                      : "bg-blue-600 hover:bg-blue-700",
                  !voice.supported && !isLoading && "opacity-40",
                ].join(" ")}
                aria-label={
                  isLoading
                    ? "Dừng trả lời"
                    : voice.listening
                      ? "Dừng ghi âm"
                      : "Bắt đầu nói"
                }
              >
                {(voice.listening || isLoading) && (
                  <span
                    className={`pointer-events-none absolute inset-0 animate-ping rounded-full ${isLoading ? "bg-amber-500/40" : "bg-rose-500/40"}`}
                  />
                )}
                {isLoading ? (
                  <IconStop className="h-7 w-7" />
                ) : voice.listening ? (
                  <IconStop className="h-7 w-7" />
                ) : (
                  <IconMic className="h-8 w-8" />
                )}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="grid h-12 w-12 place-items-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                aria-label="Chụp/tải ảnh"
              >
                <IconCamera className="h-5 w-5" />
              </button>
            </div>
          )}
          <p className="mt-2 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
            {isLoading
              ? "Đang suy nghĩ... Nhấn để dừng."
              : voice.listening
                ? "Đang nghe... Nhấn để dừng."
                : voice.supported
                  ? "Nhấn micro và nói tự nhiên \u2014 tiếng Việt"
                  : "Trình duyệt chưa hỗ trợ giọng nói \u2014 hãy gõ nhé."}
          </p>
        </div>
      </aside>

      <main className="relative h-dvh flex-1 overflow-hidden">
        <PlannerMap
          places={mapPlaces}
          route={activeRoute}
          focusCoord={focusCoord}
          onPickPlace={handlePickMarker}
        />
        <div className="pointer-events-none absolute left-4 top-4 hidden md:block">
          <div className="pointer-events-auto rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow ring-1 ring-black/5 backdrop-blur dark:bg-zinc-900/90 dark:text-zinc-300 dark:ring-white/10">
            VETC Buddy · AI
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Message rendering ---------- */

function MessageBubble({
  message,
  onPickPlace,
  onSelectRoute,
  selectedRouteIdx,
}: {
  message: UIMessage;
  onPickPlace: (c: LngLat) => void;
  onSelectRoute: (idx: number) => void;
  selectedRouteIdx: number;
}) {
  if (message.role === "user") {
    const text = message.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
    return (
      <li className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-3.5 py-2.5 text-sm text-white shadow-sm">
        {text}
      </li>
    );
  }

  return (
    <li className="flex max-w-[92%] flex-col gap-2">
      {message.parts.map((part, idx) => {
        if (part.type === "text" && part.text) {
          return (
            <div
              key={idx}
              className="prose-chat self-start rounded-2xl rounded-bl-md bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <Markdown>{part.text}</Markdown>
            </div>
          );
        }

        if (part.type === "step-start" || part.type === "reasoning") return null;

        // Tool invocations (any tool-* part)
        if (part.type.startsWith("tool-") && "state" in part) {
          return (
            <ToolResultCard
              key={idx}
              part={part}
              onPickPlace={onPickPlace}
              onSelectRoute={onSelectRoute}
              selectedRouteIdx={selectedRouteIdx}
            />
          );
        }

        return null;
      })}
    </li>
  );
}

/* ---------- Tool result rendering ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolPart = any;

function ToolResultCard({
  part,
  onPickPlace,
  onSelectRoute,
  selectedRouteIdx,
}: {
  part: ToolPart;
  onPickPlace: (c: LngLat) => void;
  onSelectRoute: (idx: number) => void;
  selectedRouteIdx: number;
}) {
  // Loading state
  if (
    part.state === "input-available" ||
    part.state === "input-streaming" ||
    part.state === "submitted"
  ) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
        Đang tra cứu...
      </div>
    );
  }

  if (part.state === "output-error") {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
        Lỗi khi tra cứu. Vui lòng thử lại.
      </div>
    );
  }

  if (part.state !== "output-available" || !part.output) return null;

  const output = part.output as Record<string, unknown>;
  const toolType = part.type.replace("tool-", "");

  // search_places or get_nearby
  if (
    (toolType === "search_places" || toolType === "get_nearby") &&
    Array.isArray(output.places)
  ) {
    const places = output.places as Place[];
    if (places.length === 0) {
      return (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Không tìm thấy địa điểm nào gần đây.
        </div>
      );
    }

    const category = places[0]?.category ?? "eat";
    return (
      <PlaceCards
        category={category as PlaceCategory}
        places={places}
        onPick={onPickPlace}
      />
    );
  }

  // plan_route
  if (toolType === "plan_route" && output.path) {
    const from = output.from as Record<string, unknown>;
    const to = output.to as Record<string, unknown>;
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
        <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
          Tuyến đường
        </p>
        <p className="mt-1 text-sm font-medium">
          {String(from?.name ?? "").split(",")[0]} →{" "}
          {String(to?.name ?? "").split(",")[0]}
        </p>
        <div className="mt-1 flex gap-3 text-xs text-zinc-600 dark:text-zinc-300">
          <span className="inline-flex items-center gap-1">
            <IconClock className="h-3 w-3" />
            {output.durationMin as number} phút
          </span>
          <span>{output.distanceKm as number} km</span>
        </div>
      </div>
    );
  }

  // estimate_toll
  if (toolType === "estimate_toll") {
    if (!output.estimated) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Phí cầu đường VETC
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {output.message as string ?? "Chưa có dữ liệu phí cho tuyến này."}
          </p>
        </div>
      );
    }
    const gates = output.gates as { name: string; fee: number }[];
    const isEstimate = output.method === "per_km_estimate";
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Phí cầu đường VETC{isEstimate ? " (ước tính)" : ""}
        </p>
        <div className="mt-1.5 space-y-1">
          {gates.map((g: { name: string; fee: number }, i: number) => (
            <div
              key={i}
              className="flex justify-between text-xs text-zinc-700 dark:text-zinc-300"
            >
              <span>{g.name}</span>
              <span className="font-medium">{VND(g.fee)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-amber-200 pt-1 text-sm font-semibold dark:border-amber-800">
            <span>Tổng</span>
            <span>{VND(output.toll_vnd as number)}</span>
          </div>
          {isEstimate && typeof output.note === "string" && (
            <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80">
              {output.note}
            </p>
          )}
        </div>
      </div>
    );
  }

  // estimate_fuel
  if (toolType === "estimate_fuel" && output.cost_vnd) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
        <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          Chi phí nhiên liệu
        </p>
        <div className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">
          <p>
            {output.distance_km as number} km ·{" "}
            {output.fuel_type as string} ·{" "}
            {output.consumption_per_100km as number}
            {(output.fuel_type as string) === "electric" ? " kWh" : "L"}/100km
          </p>
          <p className="mt-0.5">
            {output.total_units as number} {output.unit as string} x{" "}
            {VND(output.price_per_unit as number)}/{output.unit as string}
          </p>
          <p className="mt-1 text-sm font-semibold">
            = {VND(output.cost_vnd as number)}
          </p>
        </div>
      </div>
    );
  }

  // trip_summary
  if (toolType === "trip_summary" && output.total_vnd != null) {
    const breakdown = output.breakdown as { label: string; amount_vnd: number }[];
    const total = output.total_vnd as number;
    return (
      <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-4 dark:border-purple-800 dark:from-purple-950/40 dark:to-indigo-950/40">
        <div className="flex items-center gap-2">
          <IconSummary className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <p className="text-[10px] font-medium uppercase tracking-wide text-purple-600 dark:text-purple-400">
            Tổng chi phí chuyến đi
          </p>
        </div>
        <p className="mt-1 text-sm font-medium">
          {output.from as string} → {output.to as string}
        </p>
        <div className="mt-1 flex gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{output.distance_km as number} km</span>
          <span>{output.duration_min as number} phút</span>
        </div>
        <div className="mt-2 space-y-1">
          {breakdown.map((b: { label: string; amount_vnd: number }, i: number) => (
            <div key={i} className="flex justify-between text-xs text-zinc-700 dark:text-zinc-300">
              <span>{b.label}</span>
              <span className="font-medium">{VND(b.amount_vnd)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-purple-200 pt-1.5 text-base font-bold text-purple-700 dark:border-purple-800 dark:text-purple-300">
            <span>Tổng cộng</span>
            <span>{VND(total)}</span>
          </div>
        </div>
        {typeof output.tip === "string" && (
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            {output.tip}
          </p>
        )}
      </div>
    );
  }

  // check_wallet
  if (toolType === "check_wallet" && output.balance_vnd != null) {
    const canAfford = output.can_afford_trip as boolean | null;
    return (
      <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-3 dark:border-cyan-800 dark:bg-cyan-950/30">
        <div className="flex items-center gap-2">
          <IconWallet className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <p className="text-[10px] font-medium uppercase tracking-wide text-cyan-600 dark:text-cyan-400">
            Ví VETC
          </p>
        </div>
        <p className="mt-1 text-lg font-bold text-cyan-700 dark:text-cyan-300">
          {VND(output.balance_vnd as number)}
        </p>
        {canAfford != null && (
          <div className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${canAfford ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            <span>{canAfford ? "✓" : "✗"}</span>
            <span>
              {canAfford
                ? "Đủ tiền cho chuyến đi"
                : output.top_up_suggestion as string ?? `Thiếu ${VND(output.shortfall_vnd as number)}`}
            </span>
          </div>
        )}
        {output.last_transaction != null && (
          <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            Giao dịch gần nhất: {String((output.last_transaction as Record<string, unknown>)?.location ?? "")}
          </p>
        )}
      </div>
    );
  }

  // get_weather
  if (toolType === "get_weather" && output.current) {
    const current = output.current as Record<string, unknown>;
    const forecast = output.forecast_today as Record<string, unknown>;
    const WEATHER_ICON: Record<string, string> = {
      sun: "☀️", "cloud-sun": "⛅", cloud: "☁️", fog: "🌫️",
      drizzle: "🌦️", rain: "🌧️", "rain-heavy": "⛈️", storm: "🌩️",
    };
    return (
      <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 p-3 dark:border-sky-800 dark:from-sky-950/40 dark:to-blue-950/40">
        <div className="flex items-center gap-2">
          <IconWeather className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          <p className="text-[10px] font-medium uppercase tracking-wide text-sky-600 dark:text-sky-400">
            Thời tiết · {output.location as string}
          </p>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <span className="text-2xl">{WEATHER_ICON[current.icon as string] ?? "🌤️"}</span>
          <div>
            <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
              {current.temp_c as number}°C
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              {current.description as string}
            </p>
          </div>
          <div className="ml-auto text-right text-[11px] text-zinc-500 dark:text-zinc-400">
            <p>H: {forecast?.high_c as number}° L: {forecast?.low_c as number}°</p>
            <p>Mưa: {forecast?.rain_chance_percent as number}%</p>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
          {output.driving_advisory as string}
        </p>
      </div>
    );
  }

  // compare_routes
  if (toolType === "compare_routes" && Array.isArray(output.routes) && (output.routes as unknown[]).length > 0) {
    const routes = output.routes as { label: string; distance_km: number; duration_min: number; toll_vnd: number; fuel_vnd: number; total_vnd: number; tags: string[] }[];
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          So sánh tuyến đường
        </p>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {routes.map((r, i) => {
            const isFastest = r.tags.includes("fastest");
            const isCheapest = r.tags.includes("cheapest");
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectRoute(i)}
                className={[
                  "flex min-w-[160px] shrink-0 flex-col rounded-xl border p-2.5 text-left transition",
                  selectedRouteIdx === i
                    ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/40"
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700",
                ].join(" ")}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold">{r.label}</span>
                  {isFastest && <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">NHANH</span>}
                  {isCheapest && <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">RẺ</span>}
                </div>
                <div className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                  <p>{r.distance_km} km · {r.duration_min} phút</p>
                  <p className="font-medium">Tổng: {VND(r.total_vnd)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // multi_stop_trip
  if (toolType === "multi_stop_trip" && output.totals) {
    const legs = output.legs as { from: string; to: string; distance_km: number; duration_min: number; toll_vnd: number; fuel_vnd: number }[];
    const totals = output.totals as { distance_km: number; duration_min: number; toll_vnd: number; fuel_vnd: number; total_cost_vnd: number };
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/30">
        <p className="text-[10px] font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400">
          Chuyến đi nhiều điểm dừng
        </p>
        <div className="mt-2 space-y-2">
          {legs.map((leg, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex flex-col items-center">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-200 text-[10px] font-bold text-violet-700 dark:bg-violet-800 dark:text-violet-300">
                  {i + 1}
                </span>
                {i < legs.length - 1 && <div className="h-full w-px bg-violet-200 dark:bg-violet-800" />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <p className="text-xs font-medium">{leg.from} → {leg.to}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {leg.distance_km} km · {leg.duration_min} phút · {VND(leg.toll_vnd + leg.fuel_vnd)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between border-t border-violet-200 pt-2 text-sm font-semibold dark:border-violet-800">
          <span>Tổng: {totals.distance_km} km · {totals.duration_min} phút</span>
          <span className="text-violet-700 dark:text-violet-300">{VND(totals.total_cost_vnd)}</span>
        </div>
      </div>
    );
  }

  // analyze_image
  if (toolType === "analyze_image" && output.analysis) {
    return (
      <div className="rounded-xl border border-pink-200 bg-pink-50/50 p-3 dark:border-pink-800 dark:bg-pink-950/30">
        <div className="flex items-center gap-2">
          <IconCamera className="h-4 w-4 text-pink-600 dark:text-pink-400" />
          <p className="text-[10px] font-medium uppercase tracking-wide text-pink-600 dark:text-pink-400">
            Phân tích ảnh
            {output.type !== "general" && ` · ${output.type === "toll_receipt" ? "Biên lai" : output.type === "license_plate" ? "Biển số" : "Biển báo"}`}
          </p>
        </div>
        <p className="mt-1.5 text-xs text-zinc-700 dark:text-zinc-300">
          {output.analysis as string}
        </p>
      </div>
    );
  }

  return null;
}

/* ---------- Place & Route cards ---------- */

function PlaceCards({
  category,
  places,
  onPick,
}: {
  category: PlaceCategory | string;
  places: Place[];
  onPick: (c: LngLat) => void;
}) {
  const Icon = CATEGORY_ICON[category] ?? IconFork;
  const tile = CATEGORY_TILE[category] ?? CATEGORY_TILE.eat;
  const label = CATEGORY_LABEL[category] ?? category;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <ul className="flex flex-col gap-1.5">
        {places.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p.coord)}
              className="group flex w-full items-start gap-2.5 rounded-xl border border-zinc-200 bg-white p-2.5 text-left transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
            >
              <div
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tile}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                {p.address && (
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {p.address}
                  </p>
                )}
                {p.meta && (
                  <p className="mt-0.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                    {p.meta}
                  </p>
                )}
              </div>
              <IconArrow className="mt-1 h-3.5 w-3.5 text-zinc-400 transition group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
