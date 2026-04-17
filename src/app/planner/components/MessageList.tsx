"use client";

import * as React from "react";
import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

import type { LngLat } from "../types";
import { EmptyState } from "./EmptyState";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
  voiceTranscript: string;
  voiceListening: boolean;
  onPickPlace: (c: LngLat) => void;
  onSelectRoute: (idx: number) => void;
  selectedRouteIdx: number;
  onSuggestion: (text: string) => void;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export function MessageList({
  messages,
  isLoading,
  voiceTranscript,
  voiceListening,
  onPickPlace,
  onSelectRoute,
  selectedRouteIdx,
  onSuggestion,
}: MessageListProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [messages, voiceTranscript, prefersReducedMotion]);

  const showEmpty = messages.length <= 1 && messages[0]?.id === "welcome";

  return (
    <div
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Nhật ký trò chuyện"
      className="min-h-0 flex-1 overflow-y-auto px-4 py-3 [overflow-anchor:auto]"
    >
      <ul className="flex flex-col gap-3">
        {showEmpty ? (
          <EmptyState onPick={onSuggestion} />
        ) : (
          messages.map((m) =>
            m.id === "welcome" ? null : (
              <MessageBubble
                key={m.id}
                message={m}
                onPickPlace={onPickPlace}
                onSelectRoute={onSelectRoute}
                selectedRouteIdx={selectedRouteIdx}
              />
            ),
          )
        )}

        {voiceListening && voiceTranscript && (
          <li
            className="self-end max-w-[85%] rounded-2xl bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] px-3.5 py-2.5 text-sm italic text-primary ring-1 ring-primary/25"
            aria-label="Bản ghi đang nói"
          >
            {voiceTranscript}…
          </li>
        )}

        {isLoading && <StreamingIndicator messages={messages} />}
      </ul>
    </div>
  );
}

/* ── Streaming progress indicator ── */

const TOOL_STEP_LABELS: Record<string, string> = {
  plan_route: "Tìm đường",
  estimate_toll: "Tính phí cầu đường",
  estimate_fuel: "Tính chi phí nhiên liệu",
  trip_summary: "Tổng hợp chi phí",
  search_places: "Tìm địa điểm",
  get_nearby: "Tìm dịch vụ",
  compare_routes: "So sánh tuyến đường",
  multi_stop_trip: "Lên kế hoạch chuyến đi",
  check_wallet: "Kiểm tra ví VETC",
  get_weather: "Xem thời tiết",
  analyze_image: "Phân tích ảnh",
  web_search: "Tìm kiếm web",
};

function StreamingIndicator({ messages }: { messages: UIMessage[] }) {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  if (!lastAssistant) {
    return <ThinkingDots />;
  }

  // Collect tool steps, deduplicating by name with counts
  const stepMap = new Map<string, { total: number; done: number }>();
  for (const part of lastAssistant.parts) {
    if (
      typeof part.type === "string" &&
      part.type.startsWith("tool-") &&
      "state" in part
    ) {
      const name = part.type.replace("tool-", "");
      const isDone =
        part.state === "output-available" || part.state === "output-error";
      const entry = stepMap.get(name) ?? { total: 0, done: 0 };
      entry.total++;
      if (isDone) entry.done++;
      stepMap.set(name, entry);
    }
  }

  if (stepMap.size > 0) {
    const allDone = [...stepMap.values()].every((e) => e.done === e.total);
    if (allDone) return null;

    // Find the currently active step (first one not fully done)
    let activeLabel = "";
    for (const [name, entry] of stepMap) {
      if (entry.done < entry.total) {
        activeLabel = TOOL_STEP_LABELS[name] ?? name;
        break;
      }
    }

    const totalSteps = stepMap.size;
    const doneSteps = [...stepMap.values()].filter((e) => e.done === e.total).length;

    return (
      <li className="self-start max-w-[85%]" aria-label="Đang xử lý">
        <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-primary motion-reduce:animate-none shrink-0"
            aria-hidden
          />
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-medium text-foreground/80">
              {activeLabel}…
            </span>
            {totalSteps > 1 && (
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.round((doneSteps / totalSteps) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums shrink-0">
                  {doneSteps}/{totalSteps}
                </span>
              </div>
            )}
          </div>
        </div>
      </li>
    );
  }

  if (messages[messages.length - 1]?.role === "user") {
    return <ThinkingDots />;
  }

  return null;
}

function ThinkingDots() {
  return (
    <li className="self-start" aria-label="Đang trả lời">
      <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:0ms] motion-reduce:animate-none" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:150ms] motion-reduce:animate-none" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:300ms] motion-reduce:animate-none" />
      </div>
    </li>
  );
}
