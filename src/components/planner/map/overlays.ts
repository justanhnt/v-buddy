import type { Map as MLMap } from "maplibre-gl";

import {
  ROUTE_SRC,
  ROUTE_LAYER,
  ROUTE_LAYER_CASING,
  USER_SRC,
  USER_LAYER,
  USER_LAYER_HALO,
  VN_ISLANDS_SRC,
  VN_ISLANDS_ARCHIPELAGO_LAYER,
  VN_ISLANDS_ISLAND_LAYER,
  PLACES_SRC,
  PLACES_CIRCLE_LAYER,
  PLACES_LABEL_LAYER,
  PLACES_BORDER_LAYER,
  CATEGORY_COLORS,
  DEFAULT_PLACE_COLOR,
} from "./constants";
import { VN_ISLANDS_GEOJSON } from "./vietnam-islands";

/**
 * Add (or update) all overlay layers on the map: route, island labels,
 * user location dot, and place markers.
 */
export function addOverlays(map: MLMap, isDark: boolean) {
  // --- Route layers ---
  if (!map.getSource(ROUTE_SRC)) {
    map.addSource(ROUTE_SRC, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: ROUTE_LAYER_CASING,
      type: "line",
      source: ROUTE_SRC,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": isDark ? "#0d1117" : "#ffffff",
        "line-width": 8,
        "line-opacity": 0.9,
      },
    });
    map.addLayer({
      id: ROUTE_LAYER,
      type: "line",
      source: ROUTE_SRC,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": isDark ? "#60a5fa" : "#2563eb",
        "line-width": 5,
      },
    });
  } else {
    map.setPaintProperty(
      ROUTE_LAYER_CASING,
      "line-color",
      isDark ? "#0d1117" : "#ffffff",
    );
    map.setPaintProperty(
      ROUTE_LAYER,
      "line-color",
      isDark ? "#60a5fa" : "#2563eb",
    );
  }

  // --- Vietnamese island labels ---
  const islandTextColor = isDark ? "#e5e7eb" : "#1f2937";
  const islandHaloColor = isDark ? "#0d1117" : "#ffffff";

  if (!map.getSource(VN_ISLANDS_SRC)) {
    map.addSource(VN_ISLANDS_SRC, {
      type: "geojson",
      data: VN_ISLANDS_GEOJSON,
    });
    map.addLayer({
      id: VN_ISLANDS_ARCHIPELAGO_LAYER,
      type: "symbol",
      source: VN_ISLANDS_SRC,
      filter: ["==", ["get", "kind"], "archipelago"],
      minzoom: 3,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Italic"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 3, 11, 8, 14],
        "text-max-width": 8,
        "text-letter-spacing": 0.05,
      },
      paint: {
        "text-color": islandTextColor,
        "text-halo-color": islandHaloColor,
        "text-halo-width": 1.4,
      },
    });
    map.addLayer({
      id: VN_ISLANDS_ISLAND_LAYER,
      type: "symbol",
      source: VN_ISLANDS_SRC,
      filter: ["==", ["get", "kind"], "island"],
      minzoom: 7,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 12, 13],
        "text-max-width": 8,
        "text-anchor": "top",
        "text-offset": [0, 0.6],
      },
      paint: {
        "text-color": islandTextColor,
        "text-halo-color": islandHaloColor,
        "text-halo-width": 1.2,
      },
    });
  } else {
    for (const id of [
      VN_ISLANDS_ARCHIPELAGO_LAYER,
      VN_ISLANDS_ISLAND_LAYER,
    ]) {
      map.setPaintProperty(id, "text-color", islandTextColor);
      map.setPaintProperty(id, "text-halo-color", islandHaloColor);
    }
  }

  // --- User location dot ---
  if (!map.getSource(USER_SRC)) {
    map.addSource(USER_SRC, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: USER_LAYER_HALO,
      type: "circle",
      source: USER_SRC,
      paint: {
        "circle-radius": 18,
        "circle-color": isDark ? "#60a5fa" : "#2563eb",
        "circle-opacity": 0.15,
      },
    });
    map.addLayer({
      id: USER_LAYER,
      type: "circle",
      source: USER_SRC,
      paint: {
        "circle-radius": 7,
        "circle-color": isDark ? "#60a5fa" : "#2563eb",
        "circle-stroke-color": isDark ? "#0d1117" : "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }

  // --- Place markers as native layers ---
  const categoryColorStops: string[] = [];
  for (const [cat, color] of Object.entries(CATEGORY_COLORS)) {
    categoryColorStops.push(cat, color);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colorExpr: any = [
    "match",
    ["get", "category"],
    ...categoryColorStops,
    DEFAULT_PLACE_COLOR,
  ];

  if (!map.getSource(PLACES_SRC)) {
    map.addSource(PLACES_SRC, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    // Outer border ring
    map.addLayer({
      id: PLACES_BORDER_LAYER,
      type: "circle",
      source: PLACES_SRC,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 10, 8, 14, 12, 18, 16],
        "circle-color": isDark ? "#0d1117" : "#ffffff",
        "circle-opacity": 0.9,
      },
    });
    // Main colored circle
    map.addLayer({
      id: PLACES_CIRCLE_LAYER,
      type: "circle",
      source: PLACES_SRC,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3.5, 10, 6, 14, 9, 18, 13],
        "circle-color": colorExpr,
        "circle-opacity": 0.9,
      },
    });
    // Name label -- only at higher zooms
    map.addLayer({
      id: PLACES_LABEL_LAYER,
      type: "symbol",
      source: PLACES_SRC,
      minzoom: 12,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10, 16, 13],
        "text-anchor": "top",
        "text-offset": [0, 0.8],
        "text-max-width": 10,
        "text-allow-overlap": false,
        "icon-allow-overlap": true,
      },
      paint: {
        "text-color": isDark ? "#e5e7eb" : "#1f2937",
        "text-halo-color": isDark ? "#0d1117" : "#ffffff",
        "text-halo-width": 1.5,
      },
    });
  } else {
    // Update colors on theme change
    map.setPaintProperty(PLACES_BORDER_LAYER, "circle-color", isDark ? "#0d1117" : "#ffffff");
    map.setPaintProperty(PLACES_LABEL_LAYER, "text-color", isDark ? "#e5e7eb" : "#1f2937");
    map.setPaintProperty(PLACES_LABEL_LAYER, "text-halo-color", isDark ? "#0d1117" : "#ffffff");
  }
}
