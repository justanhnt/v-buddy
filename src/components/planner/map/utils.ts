import type { StyleSpecification, Map as MLMap } from "maplibre-gl";

import type { Place } from "@/types/planner";

import { DISPUTED_AREAS } from "./vietnam-islands";

// Force Vietnamese labels on every symbol layer. Falls back to Latin
// transliteration, then the raw `name`.
const VI_TEXT_FIELD = [
  "coalesce",
  ["get", "name:vi"],
  ["get", "name:latin"],
  ["get", "name"],
];

/**
 * Fetch a vector-tile style and patch it for Vietnamese localisation:
 *  - Override `text-field` on every symbol layer to prefer `name:vi`.
 *  - Suppress place labels inside Hoang Sa / Truong Sa bounding boxes
 *    (re-added as our own source with correct Vietnamese names).
 *  - Hide PRC-claimed boundary lines on the East Sea.
 */
export async function loadLocalizedStyle(
  url: string,
): Promise<StyleSpecification> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Style fetch failed: ${res.status}`);
  const style = (await res.json()) as StyleSpecification;

  const notInDisputed = ["!", ["within", DISPUTED_AREAS]];
  const notClaimedByCN = [
    "!=",
    ["coalesce", ["get", "claimed_by"], ""],
    "CN",
  ];

  for (const layer of style.layers ?? []) {
    if (
      layer.type === "symbol" &&
      layer.layout &&
      "text-field" in layer.layout
    ) {
      (layer.layout as Record<string, unknown>)["text-field"] = VI_TEXT_FIELD;
    }
    const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
    if (sourceLayer === "place") {
      const withFilter = layer as { filter?: unknown };
      withFilter.filter = withFilter.filter
        ? ["all", withFilter.filter, notInDisputed]
        : notInDisputed;
    }
    if (sourceLayer === "boundary") {
      const withFilter = layer as { filter?: unknown };
      withFilter.filter = withFilter.filter
        ? ["all", withFilter.filter, notClaimedByCN]
        : notClaimedByCN;
    }
  }
  return style;
}

/** Check the user's reduced-motion preference. */
export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Build GeoJSON FeatureCollection from places for native map layers. */
export function placesToGeoJSON(
  places: Place[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: places.map((p) => ({
      type: "Feature" as const,
      properties: {
        id: p.id,
        name: p.name,
        category: p.category ?? "eat",
      },
      geometry: { type: "Point" as const, coordinates: p.coord },
    })),
  };
}

/** Localise MapLibre built-in control labels to Vietnamese. */
export function labelControl(map: MLMap) {
  const root = map.getContainer();
  const setLabel = (sel: string, label: string) => {
    root
      .querySelectorAll<HTMLButtonElement>(sel)
      .forEach((el) => {
        el.setAttribute("aria-label", label);
        el.setAttribute("title", label);
      });
  };
  setLabel(".maplibregl-ctrl-zoom-in", "Phóng to");
  setLabel(".maplibregl-ctrl-zoom-out", "Thu nhỏ");
  setLabel(".maplibregl-ctrl-compass", "Đặt lại hướng");
  setLabel(".maplibregl-ctrl-geolocate", "Về vị trí của tôi");
}
