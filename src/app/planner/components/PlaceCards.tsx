"use client";

import { ArrowRight } from "lucide-react";

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

export function PlaceCards({ category, places, onPick }: PlaceCardsProps) {
  const Icon = CATEGORY_ICON[category] ?? CATEGORY_ICON.eat;
  const tile = CATEGORY_TILE[category] ?? CATEGORY_TILE.eat;
  const label = getCategoryLabel(category);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ul className="flex flex-col gap-1.5">
        {places.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p.coord)}
              aria-label={`${label}: ${p.name}${p.meta ? ` — ${p.meta}` : ""}`}
              className={cn(
                "group flex w-full items-start gap-2.5 rounded-xl border border-border bg-card p-2.5 text-left transition-colors",
                "hover:border-ring/50 hover:bg-accent",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "motion-reduce:transition-none",
              )}
            >
              <div
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                  tile,
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                {p.address && (
                  <p className="truncate text-xs text-muted-foreground">
                    {p.address}
                  </p>
                )}
                {p.meta && (
                  <p className="mt-0.5 text-xs font-medium text-foreground/80">
                    {p.meta}
                  </p>
                )}
              </div>
              <ArrowRight
                aria-hidden
                className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
