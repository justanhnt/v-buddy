"use client";

import type { LucideIcon } from "lucide-react";
import { Clock, Leaf, Route, Waves, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

import { VND } from "@/lib/format";
import type { LngLat } from "@/types/planner";

type TagVariant = "success" | "info" | "warning" | "default" | "muted";
type Tag = {
  label: string;
  variant: TagVariant;
  icon?: LucideIcon;
};

const TAG_META: Record<string, Tag> = {
  fast: { label: "Nhanh", variant: "success", icon: Zap },
  fastest: { label: "Nhanh nhất", variant: "success", icon: Zap },
  cheap: { label: "Tiết kiệm", variant: "info" },
  cheapest: { label: "Rẻ nhất", variant: "info" },
  "avoid-toll": { label: "Ít trạm", variant: "warning" },
  "few-tolls": { label: "Ít phí", variant: "warning" },
  scenic: { label: "Cảnh quan", variant: "default", icon: Leaf },
  highway: { label: "Cao tốc", variant: "muted", icon: Route },
  coast: { label: "Ven biển", variant: "info", icon: Waves },
};

type RouteSummary = {
  label: string;
  distance_km: number;
  duration_min: number;
  toll_vnd: number;
  fuel_vnd: number;
  total_vnd: number;
  tags: string[];
  path: LngLat[];
};

interface RouteCompareCardProps {
  routes: RouteSummary[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
}

export function RouteCompareCard({
  routes,
  selectedIdx,
  onSelect,
}: RouteCompareCardProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        So sánh tuyến đường
      </p>
      <div
        role="radiogroup"
        aria-label="Chọn tuyến đường"
        className="scroll-hint-x flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {routes.map((r, i) => {
          const isSelected = selectedIdx === i;
          const isFastest = r.tags.includes("fastest");
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(i)}
              aria-label={`${r.label}: ${r.distance_km} km, ${r.duration_min} phút, tổng ${VND(r.total_vnd)}`}
              className={cn(
                "flex min-w-[180px] shrink-0 flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
                isSelected
                  ? "border-primary bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))] ring-1 ring-primary/40"
                  : "border-border bg-card hover:border-ring/50 hover:bg-accent",
              )}
            >
              <div className="flex items-start gap-1.5">
                <span className="text-xs font-semibold leading-snug">
                  {r.label}
                </span>
                {isFastest && (
                  <Badge variant="success" className="ml-auto">
                    Đề xuất
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden />
                  {r.duration_min} phút
                </span>
                <span>{r.distance_km} km</span>
                <span className="col-span-2 font-medium text-foreground">
                  {VND(r.total_vnd)}
                </span>
              </div>
              {r.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.tags.map((t) => {
                    const meta = TAG_META[t];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    return (
                      <Badge key={t} variant={meta.variant}>
                        {Icon && <Icon className="h-3 w-3" aria-hidden />}
                        {meta.label}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
