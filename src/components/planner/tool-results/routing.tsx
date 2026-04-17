import { Clock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { VND } from "@/lib/format";

import { RouteCompareCard } from "../route-compare-card";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface RoutingCallbacks {
  onSelectRoute: (idx: number) => void;
  selectedRouteIdx: number;
}

export function PlanRouteResult({
  output,
}: {
  output: Record<string, unknown>;
}) {
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

export function CompareRoutesResult({
  output,
  onSelectRoute,
  selectedRouteIdx,
}: { output: Record<string, unknown> } & RoutingCallbacks) {
  return (
    <RouteCompareCard
      routes={output.routes as any}
      selectedIdx={selectedRouteIdx}
      onSelect={onSelectRoute}
    />
  );
}

export function MultiStopTripResult({
  output,
}: {
  output: Record<string, unknown>;
}) {
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
