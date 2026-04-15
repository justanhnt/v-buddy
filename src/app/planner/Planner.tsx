"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import {
  MOCK_CHARGE,
  MOCK_EAT,
  MOCK_FUEL,
  MOCK_INSURANCE,
  MOCK_PARKING,
  MOCK_ROUTES,
  VND,
} from "./mock-data";
import type {
  LngLat,
  Place,
  PlaceCategory,
  RoutePref,
  RouteResult,
} from "./types";
import {
  IconArrow,
  IconCharge,
  IconClock,
  IconFork,
  IconFuel,
  IconKeyboard,
  IconMic,
  IconParking,
  IconShield,
  IconSparkle,
  IconStop,
  IconToll,
} from "./icons";
import { parseIntent, type Intent } from "./intent";
import { useVoice } from "./useVoice";

const PlannerMap = dynamic(() => import("./PlannerMap"), { ssr: false });

const PLACE_SOURCE: Record<PlaceCategory, Place[]> = {
  eat: MOCK_EAT,
  fuel: MOCK_FUEL,
  charge: MOCK_CHARGE,
  parking: MOCK_PARKING,
  insurance: MOCK_INSURANCE,
};

const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  eat: "Quán ăn",
  fuel: "Trạm xăng",
  charge: "Trạm sạc",
  parking: "Bãi đỗ",
  insurance: "Bảo hiểm",
};

const CATEGORY_ICON: Record<
  PlaceCategory,
  (p: { className?: string }) => React.ReactElement
> = {
  eat: IconFork,
  fuel: IconFuel,
  charge: IconCharge,
  parking: IconParking,
  insurance: IconShield,
};

const CATEGORY_TILE: Record<PlaceCategory, string> = {
  eat: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  fuel: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  charge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  parking: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  insurance: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
};

type Message =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      result?:
        | { kind: "places"; category: PlaceCategory; places: Place[] }
        | { kind: "routes"; routes: RouteResult[] };
    };

const QUICK_CHIPS = [
  { label: "Trạm sạc gần đây", icon: IconCharge },
  { label: "Đói bụng rồi", icon: IconFork },
  { label: "Đổ xăng", icon: IconFuel },
  { label: "Tránh trạm thu phí", icon: IconToll },
  { label: "Chỗ đỗ xe", icon: IconParking },
  { label: "Mua bảo hiểm", icon: IconShield },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function scoreRoute(r: RouteResult, pref: RoutePref): number {
  switch (pref) {
    case "fast": return r.durationMin;
    case "cheap": return r.tollVnd;
    case "few-tolls": return r.tollStops * 1000 + r.durationMin;
    case "coast": return (r.tags.includes("coast") ? 0 : 10_000) + r.durationMin;
    case "highway": return (r.tags.includes("highway") ? 0 : 10_000) + r.durationMin;
    case "scenic": return (r.tags.includes("scenic") ? 0 : 10_000) + r.durationMin;
  }
}

export default function Planner() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uid(),
      role: "assistant",
      text:
        "Chào bạn! Nhấn giữ micro và nói bạn cần gì — mình tìm tuyến đường, quán ăn, trạm sạc, bảo hiểm… tất cả trong một câu.",
    },
  ]);
  const [mapPlaces, setMapPlaces] = useState<Place[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteResult | null>(null);
  const [focusCoord, setFocusCoord] = useState<LngLat | null>(null);
  const [typed, setTyped] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const threadRef = useRef<HTMLDivElement | null>(null);

  // Handle an utterance (voice or typed).
  const handle = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const intent = parseIntent(text);
    const userMsg: Message = { id: uid(), role: "user", text };
    const assistantMsg = buildAssistantMessage(intent);

    setMessages((m) => [...m, userMsg, assistantMsg]);

    // Side-effects on map.
    if (intent.kind === "places") {
      const places = PLACE_SOURCE[intent.category];
      setMapPlaces(places);
      setSelectedRoute(null);
      if (places[0]) setFocusCoord(places[0].coord);
    } else if (intent.kind === "route") {
      const sorted = [...MOCK_ROUTES].sort(
        (a, b) => scoreRoute(a, intent.pref) - scoreRoute(b, intent.pref),
      );
      setMapPlaces([]);
      setSelectedRoute(sorted[0] ?? null);
    } else if (intent.kind === "trip") {
      setMapPlaces([]);
      setSelectedRoute(null);
    }
  }, []);

  const voice = useVoice(handle, "vi-VN");

  // Auto-scroll on new message.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, voice.transcript]);

  const onSelectRoute = (r: RouteResult) => setSelectedRoute(r);
  const onPickPlace = (c: LngLat) => setFocusCoord(c);

  const handlePickMarker = (id: string) => {
    const all = [
      ...MOCK_EAT,
      ...MOCK_FUEL,
      ...MOCK_CHARGE,
      ...MOCK_PARKING,
      ...MOCK_INSURANCE,
    ];
    const hit = all.find((p) => p.id === id);
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
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
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
                selectedRouteId={selectedRoute?.id ?? null}
                onSelectRoute={onSelectRoute}
                onPickPlace={onPickPlace}
              />
            ))}
            {voice.listening && voice.transcript && (
              <li className="self-end max-w-[85%] rounded-2xl bg-blue-500/10 px-3.5 py-2.5 text-sm italic text-blue-800 ring-1 ring-blue-500/20 dark:text-blue-200">
                {voice.transcript}…
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
              onClick={() => handle(label)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
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
          {showKeyboard ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handle(typed);
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
                type="submit"
                disabled={!typed.trim()}
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
                onClick={() => (voice.listening ? voice.stop() : voice.start())}
                disabled={!voice.supported}
                className={[
                  "relative grid h-20 w-20 place-items-center rounded-full text-white shadow-lg transition",
                  voice.listening
                    ? "bg-rose-500 hover:bg-rose-600"
                    : "bg-blue-600 hover:bg-blue-700",
                  !voice.supported && "opacity-40",
                ].join(" ")}
                aria-label={voice.listening ? "Dừng ghi âm" : "Bắt đầu nói"}
              >
                {voice.listening && (
                  <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-rose-500/40" />
                )}
                {voice.listening ? (
                  <IconStop className="h-7 w-7" />
                ) : (
                  <IconMic className="h-8 w-8" />
                )}
              </button>

              <div className="w-12" />
            </div>
          )}
          <p className="mt-2 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
            {voice.listening
              ? "Đang nghe… Nhấn để dừng."
              : voice.supported
                ? "Nhấn micro và nói tự nhiên — tiếng Việt"
                : "Trình duyệt chưa hỗ trợ giọng nói — hãy gõ nhé."}
          </p>
        </div>
      </aside>

      <main className="relative flex-1">
        <PlannerMap
          places={mapPlaces}
          route={selectedRoute}
          focusCoord={focusCoord}
          onPickPlace={handlePickMarker}
        />
        <div className="pointer-events-none absolute left-4 top-4 hidden md:block">
          <div className="pointer-events-auto rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow ring-1 ring-black/5 backdrop-blur dark:bg-zinc-900/90 dark:text-zinc-300 dark:ring-white/10">
            TP. Hồ Chí Minh · Demo
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Message rendering ---------- */

function buildAssistantMessage(intent: Intent): Message {
  if (intent.kind === "places") {
    return {
      id: uid(),
      role: "assistant",
      text: intent.reply,
      result: {
        kind: "places",
        category: intent.category,
        places: PLACE_SOURCE[intent.category].slice(0, 3),
      },
    };
  }
  if (intent.kind === "route") {
    const sorted = [...MOCK_ROUTES].sort(
      (a, b) => scoreRoute(a, intent.pref) - scoreRoute(b, intent.pref),
    );
    return {
      id: uid(),
      role: "assistant",
      text: intent.reply,
      result: { kind: "routes", routes: sorted.slice(0, 3) },
    };
  }
  return { id: uid(), role: "assistant", text: intent.reply };
}

function MessageBubble({
  message,
  selectedRouteId,
  onSelectRoute,
  onPickPlace,
}: {
  message: Message;
  selectedRouteId: string | null;
  onSelectRoute: (r: RouteResult) => void;
  onPickPlace: (c: LngLat) => void;
}) {
  if (message.role === "user") {
    return (
      <li className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-3.5 py-2.5 text-sm text-white shadow-sm">
        {message.text}
      </li>
    );
  }

  return (
    <li className="flex max-w-[92%] flex-col gap-2">
      <div className="self-start rounded-2xl rounded-bl-md bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
        {message.text}
      </div>
      {message.result?.kind === "places" && (
        <PlaceCards
          category={message.result.category}
          places={message.result.places}
          onPick={onPickPlace}
        />
      )}
      {message.result?.kind === "routes" && (
        <RouteCards
          routes={message.result.routes}
          selectedId={selectedRouteId}
          onSelect={onSelectRoute}
        />
      )}
    </li>
  );
}

function PlaceCards({
  category,
  places,
  onPick,
}: {
  category: PlaceCategory;
  places: Place[];
  onPick: (c: LngLat) => void;
}) {
  const Icon = CATEGORY_ICON[category];
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {CATEGORY_LABEL[category]}
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
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${CATEGORY_TILE[category]}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {p.address}
                </p>
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

function RouteCards({
  routes,
  selectedId,
  onSelect,
}: {
  routes: RouteResult[];
  selectedId: string | null;
  onSelect: (r: RouteResult) => void;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {routes.map((r, i) => {
        const active = selectedId === r.id;
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r)}
              className={[
                "flex w-full flex-col gap-1 rounded-xl border p-2.5 text-left transition",
                active
                  ? "border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-500/10"
                  : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span
                  className={[
                    "inline-grid h-4 w-4 place-items-center rounded-full text-[9px]",
                    i === 0
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                  ].join(" ")}
                >
                  {i + 1}
                </span>
                {i === 0 ? "Tốt nhất" : i === 1 ? "Thay thế" : "Dự phòng"}
              </div>
              <p className="text-sm font-medium leading-snug">{r.label}</p>
              <div className="flex flex-wrap gap-2 text-[12px] text-zinc-600 dark:text-zinc-300">
                <span className="inline-flex items-center gap-1">
                  <IconClock className="h-3 w-3" />
                  {r.durationMin} phút
                </span>
                <span>•</span>
                <span>{r.distanceKm} km</span>
                <span className="inline-flex items-center gap-1">
                  <IconToll className="h-3 w-3" />
                  {VND(r.tollVnd)} · {r.tollStops} trạm
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
