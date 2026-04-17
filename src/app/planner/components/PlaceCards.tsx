"use client";

import { MapPin, Navigation } from "lucide-react";

import { cn } from "@/lib/cn";

import {
  CATEGORY_ICON,
  CATEGORY_TILE,
  getCategoryLabel,
} from "../category-meta";
import type { LngLat, Place, PlaceCategory } from "../types";

interface PlaceCardsProps {
  category: PlaceCategory | string;
  places: Place[];
  onPick: (c: LngLat) => void;
}

type PlaceWithDistance = Place & { distance_km?: number };

export function PlaceCards({ category, places, onPick }: PlaceCardsProps) {
  const Icon = CATEGORY_ICON[category] ?? CATEGORY_ICON.eat;
  const tile = CATEGORY_TILE[category] ?? CATEGORY_TILE.eat;
  const label = getCategoryLabel(category);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-md",
            tile,
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label} · {places.length} kết quả
        </p>
      </div>

      <div className="scroll-hint-x flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {places.map((p) => (
          <PlaceCard
            key={p.id}
            place={p as PlaceWithDistance}
            category={category}
            tile={tile}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

function PlaceCard({
  place,
  category,
  tile,
  onPick,
}: {
  place: PlaceWithDistance;
  category: string;
  tile: string;
  onPick: (c: LngLat) => void;
}) {
  const Icon = CATEGORY_ICON[category] ?? CATEGORY_ICON.eat;

  return (
    <button
      type="button"
      onClick={() => onPick(place.coord)}
      aria-label={`${getCategoryLabel(category)}: ${place.name}${place.meta ? ` — ${place.meta}` : ""}`}
      className={cn(
        "group flex w-[200px] shrink-0 flex-col rounded-xl border border-border bg-card p-3 text-left transition-colors",
        "hover:border-ring/50 hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "motion-reduce:transition-none",
      )}
    >
      {/* Top row: icon + distance */}
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
            tile,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        {place.distance_km != null && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Navigation className="h-2.5 w-2.5" aria-hidden />
            {place.distance_km} km
          </span>
        )}
      </div>

      {/* Name */}
      <p className="mt-2 truncate text-sm font-semibold leading-snug">
        {place.name}
      </p>

      {/* Address */}
      {place.address && (
        <p className="mt-0.5 flex items-start gap-1 text-[11px] text-muted-foreground leading-snug">
          <MapPin className="mt-px h-3 w-3 shrink-0" aria-hidden />
          <span className="line-clamp-2">{place.address}</span>
        </p>
      )}

      {/* Meta info */}
      {place.meta && (
        <p className="mt-1.5 truncate text-[11px] font-medium text-foreground/70">
          {place.meta}
        </p>
      )}
    </button>
  );
}
