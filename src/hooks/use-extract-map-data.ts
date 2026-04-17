import { useMemo } from "react";
import type { UIMessage } from "ai";
import type { LngLat, Place, RouteResult } from "@/types/planner";

export function useExtractMapData(
  messages: UIMessage[],
  selectedRouteIdx: number,
): { mapPlaces: Place[]; activeRoute: RouteResult | null } {
  return useMemo(() => {
    const allPlaces: Place[] = [];
    const seenPlaceIds = new Set<string>();
    let route: RouteResult | null = null;
    let tollVnd = 0;
    let tollStops = 0;

    // Iterate backwards: pick only the latest route, but collect places from ALL messages
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
            output.places.length > 0
          ) {
            for (const p of output.places) {
              const place = p as Place;
              if (!seenPlaceIds.has(place.id)) {
                seenPlaceIds.add(place.id);
                allPlaces.push(place);
              }
            }
          }

          if (
            toolName === "search_along_route" &&
            Array.isArray(output.rest_stops)
          ) {
            for (const stop of output.rest_stops as { places?: unknown[] }[]) {
              if (Array.isArray(stop.places)) {
                for (const p of stop.places) {
                  const place = p as Place;
                  if (!seenPlaceIds.has(place.id)) {
                    seenPlaceIds.add(place.id);
                    allPlaces.push(place);
                  }
                }
              }
            }
          }

          if (toolName === "estimate_toll" && output.estimated && !tollVnd) {
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
    }

    if (route && tollVnd > 0 && route.tollVnd === 0) {
      route.tollVnd = tollVnd;
      route.tollStops = tollStops;
    }

    return { mapPlaces: allPlaces, activeRoute: route };
  }, [messages, selectedRouteIdx]);
}
