"use client";

import { AlertTriangle, Camera, Clock, Cloud, Globe, Loader2, Receipt, Route, Sun, Wallet } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { LngLat } from "@/types/planner";

import { PlanRouteResult, CompareRoutesResult, MultiStopTripResult } from "./routing";
import { SearchPlacesResult, SearchAlongRouteResult } from "./places";
import { EstimateTollResult, EstimateFuelResult, TripSummaryResult, CheckWalletResult } from "./costs";
import { GetWeatherResult, WeatherAlongRouteResult } from "./weather";
import { AnalyzeImageResult, WebSearchResult } from "./misc";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ToolPart = any;

interface ToolResultProps {
  part: ToolPart;
  onPickPlace: (c: LngLat) => void;
  onSelectRoute: (idx: number) => void;
  selectedRouteIdx: number;
}

const TOOL_LOADING_LABELS: Record<string, { label: string; icon?: typeof Sun }> = {
  plan_route: { label: "Đang tìm đường…", icon: Clock },
  estimate_toll: { label: "Đang tính phí cầu đường…", icon: Receipt },
  estimate_fuel: { label: "Đang tính chi phí nhiên liệu…" },
  trip_summary: { label: "Đang tổng hợp chi phí…", icon: Receipt },
  search_places: { label: "Đang tìm địa điểm…" },
  get_nearby: { label: "Đang tìm dịch vụ gần đây…" },
  compare_routes: { label: "Đang so sánh tuyến đường…", icon: Clock },
  multi_stop_trip: { label: "Đang lên kế hoạch chuyến đi…", icon: Clock },
  check_wallet: { label: "Đang kiểm tra ví VETC…", icon: Wallet },
  get_weather: { label: "Đang xem thời tiết…", icon: Cloud },
  analyze_image: { label: "Đang phân tích ảnh…", icon: Camera },
  web_search: { label: "Đang tìm kiếm trên web…", icon: Globe },
  search_along_route: { label: "Đang tìm dọc đường…", icon: Route },
  weather_along_route: { label: "Đang xem thời tiết dọc đường…", icon: Cloud },
};

export function ToolResult({
  part,
  onPickPlace,
  onSelectRoute,
  selectedRouteIdx,
}: ToolResultProps) {
  if (
    part.state === "input-available" ||
    part.state === "input-streaming" ||
    part.state === "submitted"
  ) {
    const toolName = String(part.type).replace("tool-", "");
    const meta = TOOL_LOADING_LABELS[toolName];
    return <ToolLoadingSkeleton label={meta?.label} />;
  }

  if (part.state === "output-error") {
    return (
      <Card
        role="alert"
        className="flex items-center gap-2 border-danger/40 bg-[color-mix(in_oklch,var(--danger)_10%,var(--card))] p-3 text-xs text-[var(--danger)]"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        Lỗi khi tra cứu. Vui lòng thử lại.
      </Card>
    );
  }

  if (part.state !== "output-available" || !part.output) return null;

  const output = part.output as Record<string, unknown>;
  const toolType = String(part.type).replace("tool-", "");

  switch (toolType) {
    /* ---- Places ---- */
    case "search_places":
    case "get_nearby":
      if (Array.isArray(output.places))
        return <SearchPlacesResult output={output} onPickPlace={onPickPlace} />;
      break;

    case "search_along_route":
      if (Array.isArray(output.rest_stops))
        return <SearchAlongRouteResult output={output} onPickPlace={onPickPlace} />;
      break;

    /* ---- Routing ---- */
    case "plan_route":
      if (output.path)
        return <PlanRouteResult output={output} />;
      break;

    case "compare_routes":
      if (Array.isArray(output.routes) && (output.routes as unknown[]).length > 0)
        return (
          <CompareRoutesResult
            output={output}
            onSelectRoute={onSelectRoute}
            selectedRouteIdx={selectedRouteIdx}
          />
        );
      break;

    case "multi_stop_trip":
      if (output.totals)
        return <MultiStopTripResult output={output} />;
      break;

    /* ---- Costs ---- */
    case "estimate_toll":
      return <EstimateTollResult output={output} />;

    case "estimate_fuel":
      if (output.cost_vnd)
        return <EstimateFuelResult output={output} />;
      break;

    case "trip_summary":
      if (output.total_vnd != null)
        return <TripSummaryResult output={output} />;
      break;

    case "check_wallet":
      if (output.balance_vnd != null)
        return <CheckWalletResult output={output} />;
      break;

    /* ---- Weather ---- */
    case "get_weather":
      if (output.current)
        return <GetWeatherResult output={output} />;
      break;

    case "weather_along_route":
      if (Array.isArray(output.points) && (output.points as unknown[]).length > 0)
        return <WeatherAlongRouteResult output={output} />;
      break;

    /* ---- Misc ---- */
    case "analyze_image":
      if (output.analysis)
        return <AnalyzeImageResult output={output} />;
      break;

    case "web_search":
      if (Array.isArray(output.results))
        return <WebSearchResult output={output} />;
      break;
  }

  return null;
}

function ToolLoadingSkeleton({ label }: { label?: string }) {
  return (
    <Card
      aria-busy
      aria-live="polite"
      className={cn("flex items-center gap-2 p-3 text-xs text-muted-foreground")}
    >
      <Loader2
        className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none"
        aria-hidden
      />
      <span>{label ?? "Đang tra cứu…"}</span>
      <div className="ml-auto flex flex-col gap-1">
        <Skeleton className="h-2 w-24" />
        <Skeleton className="h-2 w-16" />
      </div>
    </Card>
  );
}
