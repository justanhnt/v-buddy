import { Route } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { LngLat, Place, PlaceCategory } from "@/types/planner";
import { CATEGORY_ICON } from "../category-meta";
import { PlaceCards } from "../place-cards";

export function SearchPlacesResult({
  output,
  onPickPlace,
}: {
  output: Record<string, unknown>;
  onPickPlace: (c: LngLat) => void;
}) {
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
    <PlaceCards category={category} places={places} onPick={onPickPlace} />
  );
}

export function SearchAlongRouteResult({
  output,
  onPickPlace,
}: {
  output: Record<string, unknown>;
  onPickPlace: (c: LngLat) => void;
}) {
  const restStops = output.rest_stops as {
    km_marker: number;
    area_name: string;
    coord: [number, number];
    places: (Place & { category?: string })[];
  }[];

  if (restStops.length === 0) {
    return (
      <Card className="p-3 text-xs text-muted-foreground">
        {(output.message as string) ??
          "Không tìm thấy điểm dừng chân dọc đường."}
      </Card>
    );
  }

  const fromName = String(
    (output.from as Record<string, unknown>)?.name ?? "",
  ).split(",")[0];
  const toName = String(
    (output.to as Record<string, unknown>)?.name ?? "",
  ).split(",")[0];

  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5">
        <Route className="h-4 w-4 text-primary" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Điểm dừng chân · {fromName} → {toName}
        </p>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {output.route_distance_km as number} km ·{" "}
        {output.route_duration_min as number} phút
      </p>

      <div className="mt-3 space-y-0">
        {restStops.map((stop, i) => (
          <div key={i} className="flex gap-2.5">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center pt-0.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {i + 1}
              </span>
              {i < restStops.length - 1 && (
                <div className="w-px flex-1 bg-border" />
              )}
            </div>

            {/* Stop content */}
            <div className="min-w-0 flex-1 pb-3">
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-semibold">{stop.area_name}</p>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  Km {stop.km_marker}
                </span>
              </div>

              <div className="mt-1.5 flex flex-col gap-1">
                {stop.places.map((p) => {
                  const cat = (p.category ?? "eat") as PlaceCategory;
                  const PlaceIcon = CATEGORY_ICON[cat] ?? CATEGORY_ICON.eat;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onPickPlace(p.coord)}
                      className={cn(
                        "flex items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                        "hover:bg-accent",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      <PlaceIcon
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{ color: `var(--cat-${cat})` }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <span className="truncate font-medium block">
                          {p.name}
                        </span>
                        {p.address && (
                          <span className="text-[10px] text-muted-foreground line-clamp-1 block">
                            {p.address}
                          </span>
                        )}
                      </div>
                      {p.meta && (
                        <span className="ml-auto shrink-0 text-muted-foreground mt-0.5">
                          {p.meta}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
