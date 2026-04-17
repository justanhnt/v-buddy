"use client";

import {
  AlertTriangle,
  Camera,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  Receipt,
  Sun,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

import { VND } from "../mock-data";
import type { LngLat, Place, PlaceCategory } from "../types";
import { PlaceCards } from "./PlaceCards";
import { RouteCompareCard } from "./RouteCompareCard";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ToolPart = any;

interface ToolResultProps {
  part: ToolPart;
  onPickPlace: (c: LngLat) => void;
  onSelectRoute: (idx: number) => void;
  selectedRouteIdx: number;
}

const WEATHER_ICON: Record<string, typeof Sun> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  "rain-heavy": CloudRain,
  storm: CloudLightning,
};

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

  if (
    (toolType === "search_places" || toolType === "get_nearby") &&
    Array.isArray(output.places)
  ) {
    const places = output.places as Place[];
    if (places.length === 0) {
      return (
        <Card className="p-3 text-xs text-muted-foreground">
          Không tìm thấy địa điểm nào gần đây.
        </Card>
      );
    }
    const category = (places[0]?.category ?? "eat") as PlaceCategory;
    return (
      <PlaceCards
        category={category}
        places={places}
        onPick={onPickPlace}
      />
    );
  }

  if (toolType === "plan_route" && output.path) {
    const from = output.from as Record<string, unknown>;
    const to = output.to as Record<string, unknown>;
    return (
      <Card className="p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Tuyến đường
        </p>
        <p className="mt-1 text-sm font-medium">
          {String(from?.name ?? "").split(",")[0]} →{" "}
          {String(to?.name ?? "").split(",")[0]}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {output.durationMin as number} phút
          </span>
          <span>{output.distanceKm as number} km</span>
        </div>
      </Card>
    );
  }

  if (toolType === "estimate_toll") {
    if (!output.estimated) {
      return (
        <Card className="p-3">
          <div className="flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 text-warning" aria-hidden />
            <p className="text-xs font-medium uppercase tracking-wide text-warning-foreground dark:text-warning">
              Phí cầu đường VETC
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {(output.message as string) ?? "Chưa có dữ liệu phí cho tuyến này."}
          </p>
        </Card>
      );
    }
    const gates = output.gates as { name: string; fee: number }[];
    const isEstimate = output.method === "per_km_estimate";
    return (
      <Card className="p-3">
        <div className="flex items-center gap-1.5">
          <Receipt className="h-3.5 w-3.5 text-warning" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wide text-warning-foreground dark:text-warning">
            Phí cầu đường VETC
            {isEstimate ? " (ước tính)" : ""}
          </p>
        </div>
        <div className="mt-1.5 space-y-1">
          {gates.map((g, i) => (
            <div
              key={i}
              className="flex justify-between text-xs text-foreground/80"
            >
              <span>{g.name}</span>
              <span className="font-medium">{VND(g.fee)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-1 text-sm font-semibold">
            <span>Tổng</span>
            <span>{VND(output.toll_vnd as number)}</span>
          </div>
          {isEstimate && typeof output.note === "string" && (
            <p className="text-xs text-muted-foreground">{output.note}</p>
          )}
        </div>
      </Card>
    );
  }

  if (toolType === "estimate_fuel" && output.cost_vnd) {
    return (
      <Card className="p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--cat-charge)]">
          Chi phí nhiên liệu
        </p>
        <div className="mt-1 text-xs text-foreground/80">
          <p>
            {output.distance_km as number} km · {output.fuel_type as string} ·{" "}
            {output.consumption_per_100km as number}
            {(output.fuel_type as string) === "electric" ? " kWh" : "L"}/100km
          </p>
          <p className="mt-0.5">
            {output.total_units as number} {output.unit as string} ×{" "}
            {VND(output.price_per_unit as number)}/{output.unit as string}
          </p>
          <p className="mt-1 text-sm font-semibold">
            = {VND(output.cost_vnd as number)}
          </p>
        </div>
      </Card>
    );
  }

  if (toolType === "trip_summary" && output.total_vnd != null) {
    const breakdown = output.breakdown as {
      label: string;
      amount_vnd: number;
    }[];
    const total = output.total_vnd as number;
    return (
      <Card className="p-4 bg-gradient-to-br from-[color-mix(in_oklch,var(--primary)_12%,var(--card))] to-[color-mix(in_oklch,var(--cat-parking)_12%,var(--card))]">
        <div className="flex items-center gap-1.5">
          <Receipt className="h-4 w-4 text-primary" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Tổng chi phí chuyến đi
          </p>
        </div>
        <p className="mt-1 text-sm font-medium">
          {output.from as string} → {output.to as string}
        </p>
        <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
          <span>{output.distance_km as number} km</span>
          <span>{output.duration_min as number} phút</span>
        </div>
        <div className="mt-2 space-y-1">
          {breakdown.map((b, i) => (
            <div
              key={i}
              className="flex justify-between text-xs text-foreground/80"
            >
              <span>{b.label}</span>
              <span className="font-medium">{VND(b.amount_vnd)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-1.5 text-base font-bold text-primary">
            <span>Tổng cộng</span>
            <span>{VND(total)}</span>
          </div>
        </div>
        {typeof output.tip === "string" && (
          <p className="mt-2 text-xs text-muted-foreground">{output.tip}</p>
        )}
      </Card>
    );
  }

  if (toolType === "check_wallet" && output.balance_vnd != null) {
    const canAfford = output.can_afford_trip as boolean | null;
    return (
      <Card className="p-3">
        <div className="flex items-center gap-1.5">
          <Wallet className="h-4 w-4 text-info" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wide text-info">
            Ví VETC
          </p>
        </div>
        <p className="mt-1 text-lg font-bold text-info">
          {VND(output.balance_vnd as number)}
        </p>
        {canAfford != null && (
          <Badge
            variant={canAfford ? "success" : "danger"}
            className="mt-1.5"
          >
            {canAfford ? "✓" : "✗"}
            <span>
              {canAfford
                ? "Đủ tiền cho chuyến đi"
                : ((output.top_up_suggestion as string) ??
                  `Thiếu ${VND(output.shortfall_vnd as number)}`)}
            </span>
          </Badge>
        )}
        {output.last_transaction != null && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Giao dịch gần nhất:{" "}
            {String(
              (output.last_transaction as Record<string, unknown>)?.location ??
                "",
            )}
          </p>
        )}
      </Card>
    );
  }

  if (toolType === "get_weather" && output.current) {
    const current = output.current as Record<string, unknown>;
    const forecast = output.forecast_today as Record<string, unknown>;
    const WIcon = WEATHER_ICON[current.icon as string] ?? CloudSun;
    return (
      <Card className="p-3 bg-gradient-to-br from-[color-mix(in_oklch,var(--cat-fuel)_12%,var(--card))] to-[color-mix(in_oklch,var(--primary)_10%,var(--card))]">
        <p className="text-xs font-medium uppercase tracking-wide text-info">
          Thời tiết · {output.location as string}
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          <WIcon className="h-7 w-7 text-info" aria-hidden />
          <div>
            <p className="text-lg font-bold">{current.temp_c as number}°C</p>
            <p className="text-xs text-foreground/80">
              {current.description as string}
            </p>
          </div>
          <div className="ml-auto text-right text-xs text-muted-foreground">
            <p>
              H: {forecast?.high_c as number}° L: {forecast?.low_c as number}°
            </p>
            <p>Mưa: {forecast?.rain_chance_percent as number}%</p>
          </div>
        </div>
        <p className="mt-1.5 text-xs font-medium text-info">
          {output.driving_advisory as string}
        </p>
      </Card>
    );
  }

  if (
    toolType === "compare_routes" &&
    Array.isArray(output.routes) &&
    (output.routes as unknown[]).length > 0
  ) {
    return (
      <RouteCompareCard
        routes={output.routes as any}
        selectedIdx={selectedRouteIdx}
        onSelect={onSelectRoute}
      />
    );
  }

  if (toolType === "multi_stop_trip" && output.totals) {
    const legs = output.legs as {
      from: string;
      to: string;
      distance_km: number;
      duration_min: number;
      toll_vnd: number;
      fuel_vnd: number;
    }[];
    const totals = output.totals as {
      distance_km: number;
      duration_min: number;
      toll_vnd: number;
      fuel_vnd: number;
      total_cost_vnd: number;
    };
    return (
      <Card className="p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--cat-parking)]">
          Chuyến đi nhiều điểm dừng
        </p>
        <div className="mt-2 space-y-2">
          {legs.map((leg, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex flex-col items-center">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[color-mix(in_oklch,var(--cat-parking)_22%,transparent)] text-xs font-bold text-[var(--cat-parking)]">
                  {i + 1}
                </span>
                {i < legs.length - 1 && (
                  <div className="h-full w-px bg-border" />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <p className="text-xs font-medium">
                  {leg.from} → {leg.to}
                </p>
                <p className="text-xs text-muted-foreground">
                  {leg.distance_km} km · {leg.duration_min} phút ·{" "}
                  {VND(leg.toll_vnd + leg.fuel_vnd)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-semibold">
          <span>
            Tổng: {totals.distance_km} km · {totals.duration_min} phút
          </span>
          <span className="text-[var(--cat-parking)]">
            {VND(totals.total_cost_vnd)}
          </span>
        </div>
      </Card>
    );
  }

  if (toolType === "analyze_image" && output.analysis) {
    return (
      <Card className="p-3">
        <div className="flex items-center gap-1.5">
          <Camera className="h-4 w-4 text-[var(--cat-insurance)]" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--cat-insurance)]">
            Phân tích ảnh
            {output.type !== "general" &&
              ` · ${
                output.type === "toll_receipt"
                  ? "Biên lai"
                  : output.type === "license_plate"
                    ? "Biển số"
                    : "Biển báo"
              }`}
          </p>
        </div>
        <p className="mt-1.5 text-xs text-foreground/80">
          {output.analysis as string}
        </p>
      </Card>
    );
  }

  if (toolType === "web_search" && Array.isArray(output.results)) {
    const results = output.results as {
      title: string;
      snippet: string;
      url: string;
    }[];
    if (results.length === 0) {
      return (
        <Card className="p-3 text-xs text-muted-foreground">
          {(output.message as string) ?? "Không tìm thấy kết quả."}
        </Card>
      );
    }
    return (
      <Card className="p-3">
        <div className="flex items-center gap-1.5">
          <Globe className="h-4 w-4 text-info" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wide text-info">
            Kết quả tìm kiếm · {output.query as string}
          </p>
        </div>
        <ul className="mt-2 space-y-2">
          {results.slice(0, 4).map((r, i) => (
            <li key={i} className="text-xs">
              <p className="font-medium text-foreground/90 leading-snug">
                {r.title}
              </p>
              <p className="mt-0.5 text-muted-foreground line-clamp-2 leading-relaxed">
                {r.snippet}
              </p>
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-info hover:underline"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden />
                  Xem thêm
                </a>
              )}
            </li>
          ))}
        </ul>
      </Card>
    );
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
