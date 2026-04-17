"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ChevronDown, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/cn";

import { Composer } from "./components/Composer";
import { MessageList } from "./components/MessageList";
import { QuickChips } from "./components/QuickChips";
import type { LngLat, Place, RouteResult } from "./types";
import { useUserLocation } from "./useUserLocation";
import { useVoice } from "./useVoice";

const PlannerMap = dynamic(() => import("./PlannerMap"), { ssr: false });

const INITIAL_MESSAGE: UIMessage = {
  id: "welcome",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Chào bạn! Nhấn giữ micro và nói bạn cần gì — mình tìm tuyến đường, quán ăn, trạm sạc, bảo hiểm… tất cả trong một câu.",
    },
  ],
};

export default function Planner() {
  const userLocation = useUserLocation();
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => {
          const loc = userLocationRef.current;
          return loc
            ? { userLocation: { lat: loc.lat, lng: loc.lng, name: loc.name } }
            : {};
        },
      }),
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: "planner",
    messages: [INITIAL_MESSAGE],
    transport,
  });

  const [sheetOpen, setSheetOpen] = useState(true);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [focusCoord, setFocusCoord] = useState<LngLat | null>(null);

  const isLoading = status === "streaming" || status === "submitted";

  const send = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t || isLoading) return;
      sendMessage({ text: t });
    },
    [sendMessage, isLoading],
  );

  const handleUploadImage = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUri = reader.result as string;
        sendMessage({ text: `Phân tích ảnh này: ${dataUri}` });
      };
      reader.readAsDataURL(file);
    },
    [sendMessage],
  );

  const voice = useVoice(send, "vi-VN");

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

          if (
            (toolName === "search_places" || toolName === "get_nearby") &&
            Array.isArray(output.places) &&
            output.places.length > 0 &&
            places.length === 0
          ) {
            for (const p of output.places) places.push(p as Place);
          }

          if (toolName === "estimate_toll" && output.estimated) {
            tollVnd = (output.toll_vnd as number) ?? 0;
            tollStops = (output.gates as unknown[])?.length ?? 0;
          }

          if (
            toolName === "plan_route" &&
            output.path &&
            Array.isArray(output.path) &&
            !route
          ) {
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

          if (
            toolName === "compare_routes" &&
            Array.isArray(output.routes) &&
            !route
          ) {
            const routes = output.routes as {
              path: LngLat[];
              distance_km: number;
              duration_min: number;
              toll_vnd: number;
              label: string;
            }[];
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

          if (
            toolName === "multi_stop_trip" &&
            Array.isArray(output.legs) &&
            !route
          ) {
            const legs = output.legs as {
              from: string;
              to: string;
              path: LngLat[];
              distance_km: number;
              duration_min: number;
            }[];
            const allPaths = legs.flatMap((l) => l.path);
            const totals = output.totals as Record<string, number>;
            if (allPaths.length > 0 && totals) {
              route = {
                id: `multistop-${i}`,
                label: legs
                  .map((l) => l.from)
                  .concat(legs[legs.length - 1]?.to ?? "")
                  .join(" → "),
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

      if (places.length > 0 || route) break;
    }

    if (route && tollVnd > 0 && route.tollVnd === 0) {
      route.tollVnd = tollVnd;
      route.tollStops = tollStops;
    }

    return { mapPlaces: places, activeRoute: route };
  }, [messages, selectedRouteIdx]);

  const handlePickMarker = useCallback(
    (id: string) => {
      const hit = mapPlaces.find((p) => p.id === id);
      if (hit) setFocusCoord(hit.coord);
    },
    [mapPlaces],
  );

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <aside
        id="planner-sheet"
        aria-label="Trợ lý và lịch sử"
        className={cn(
          "z-20 flex flex-col bg-background/95 backdrop-blur-md shadow-xl ring-1 ring-border",
          "md:static md:h-full md:w-[440px] md:shrink-0 md:bg-background md:shadow-none",
          "absolute inset-x-0 bottom-0 rounded-t-2xl md:rounded-none",
          "transition-[height] duration-300 ease-out motion-reduce:transition-none",
          sheetOpen ? "h-[82dvh]" : "h-[164px]",
          "md:h-full",
        )}
      >
        <button
          type="button"
          onClick={() => setSheetOpen((s) => !s)}
          aria-expanded={sheetOpen}
          aria-controls="planner-sheet"
          aria-label={sheetOpen ? "Thu gọn bảng" : "Mở rộng bảng"}
          className={cn(
            "md:hidden mx-auto mt-2 flex h-6 w-16 items-center justify-center rounded-full",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden />
        </button>

        <header className="flex items-center justify-between px-5 pt-3 pb-2">
          <div className="min-w-0">
            <div
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
              aria-live="polite"
            >
              <span
                aria-hidden
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  isLoading
                    ? "animate-pulse bg-warning motion-reduce:animate-none"
                    : "bg-success",
                )}
              />
              <span>
                {isLoading ? "Đang xử lý" : "Sẵn sàng"} · VETC Buddy
              </span>
            </div>
            <h1 className="mt-0.5 flex items-center gap-1.5 text-lg font-semibold tracking-tight">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              Trợ lý đi đường
            </h1>
          </div>
          <ThemeToggle />
        </header>

        <MessageList
          messages={messages}
          isLoading={isLoading}
          voiceTranscript={voice.transcript}
          voiceListening={voice.listening}
          onPickPlace={(c) => setFocusCoord(c)}
          onSelectRoute={setSelectedRouteIdx}
          selectedRouteIdx={selectedRouteIdx}
          onSuggestion={send}
        />

        <QuickChips disabled={isLoading} onSelect={send} />

        <Composer
          voice={voice}
          isLoading={isLoading}
          onSend={send}
          onStop={stop}
          onUploadImage={handleUploadImage}
        />
      </aside>

      <main className="relative h-dvh flex-1 overflow-hidden">
        <PlannerMap
          places={mapPlaces}
          route={activeRoute}
          focusCoord={focusCoord}
          onPickPlace={handlePickMarker}
        />
        <div className="pointer-events-none absolute left-4 top-4 hidden md:block">
          <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-medium text-card-foreground shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            VETC Buddy · AI
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-4 right-4 hidden md:block">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="pointer-events-auto rounded-full bg-card/90 shadow-sm backdrop-blur"
            onClick={() => {
              const el = document.getElementById("planner-sheet");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            Cuộn về chat
          </Button>
        </div>
      </main>
    </div>
  );
}
