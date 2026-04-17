"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type StyleSpecification,
  Map as MLMap,
} from "maplibre-gl";
import { useTheme } from "next-themes";

import { Skeleton } from "@/components/ui/skeleton";

import { VN_CENTER } from "./mock-data";
import type { LngLat, Place, RouteResult } from "./types";

type Props = {
  places: Place[];
  route: RouteResult | null;
  focusCoord: LngLat | null;
  onPickPlace?: (id: string) => void;
};

const ROUTE_SRC = "planner-route";
const ROUTE_LAYER = "planner-route-line";
const ROUTE_LAYER_CASING = "planner-route-casing";
const USER_SRC = "planner-user";
const USER_LAYER = "planner-user-point";
const USER_LAYER_HALO = "planner-user-halo";
const VN_ISLANDS_SRC = "planner-vn-islands";
const VN_ISLANDS_ARCHIPELAGO_LAYER = "planner-vn-islands-archipelago";
const VN_ISLANDS_ISLAND_LAYER = "planner-vn-islands-island";
const PLACES_SRC = "planner-places";
const PLACES_CIRCLE_LAYER = "planner-places-circle";
const PLACES_LABEL_LAYER = "planner-places-label";
const PLACES_BORDER_LAYER = "planner-places-border";

const CATEGORY_COLORS: Record<string, string> = {
  eat: "#c2841a",
  cafe: "#a0762a",
  fuel: "#3b82f6",
  charge: "#22c55e",
  parking: "#7c3aed",
  hotel: "#a855f7",
  rest_stop: "#a0762a",
  insurance: "#ec4899",
};
const DEFAULT_PLACE_COLOR = "#3b82f6";

// Bounding boxes covering the Hoàng Sa (Paracel) and Trường Sa (Spratly)
// archipelagos. Any place feature from the vector tiles that falls inside
// these areas is suppressed; we re-add correct Vietnamese labels below.
//
// Bounds are intentionally offshore so no mainland labels are affected:
//   Hoàng Sa: 110.8–112.9°E × 15.5–17.3°N  — west of Lý Sơn (109.1°E)
//             and south of Hainan (≈18°N).
//   Trường Sa: 110.5–116.0°E × 6.5–12.0°N — west of Balabac/Banggi
//             (≈117°E, Philippines/Malaysia), north of Luconia Shoals
//             (≈5°N, Malaysia claim), and east of Phú Quý (108.9°E).
const DISPUTED_AREAS: GeoJSON.MultiPolygon = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [110.8, 15.5],
        [112.9, 15.5],
        [112.9, 17.3],
        [110.8, 17.3],
        [110.8, 15.5],
      ],
    ],
    [
      [
        [110.5, 6.5],
        [116.0, 6.5],
        [116.0, 12.0],
        [110.5, 12.0],
        [110.5, 6.5],
      ],
    ],
  ],
};

type VnIslandProps = { name: string; kind: "archipelago" | "island" };

const VN_ISLANDS_GEOJSON: GeoJSON.FeatureCollection<
  GeoJSON.Point,
  VnIslandProps
> = {
  type: "FeatureCollection",
  features: [
    // Archipelago headings
    {
      type: "Feature",
      properties: {
        name: "Quần đảo Hoàng Sa (Việt Nam)",
        kind: "archipelago",
      },
      geometry: { type: "Point", coordinates: [111.9, 16.5] },
    },
    {
      type: "Feature",
      properties: {
        name: "Quần đảo Trường Sa (Việt Nam)",
        kind: "archipelago",
      },
      geometry: { type: "Point", coordinates: [114.0, 9.5] },
    },
    // Hoàng Sa — major islands
    {
      type: "Feature",
      properties: { name: "Đảo Phú Lâm", kind: "island" },
      geometry: { type: "Point", coordinates: [112.333, 16.833] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Hoàng Sa", kind: "island" },
      geometry: { type: "Point", coordinates: [111.617, 16.533] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Tri Tôn", kind: "island" },
      geometry: { type: "Point", coordinates: [111.2, 15.783] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Linh Côn", kind: "island" },
      geometry: { type: "Point", coordinates: [112.733, 16.667] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Cây", kind: "island" },
      geometry: { type: "Point", coordinates: [112.267, 16.9] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Quang Hòa", kind: "island" },
      geometry: { type: "Point", coordinates: [111.7, 16.45] },
    },
    // Trường Sa — major islands
    {
      type: "Feature",
      properties: { name: "Đảo Trường Sa", kind: "island" },
      geometry: { type: "Point", coordinates: [111.917, 8.65] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Song Tử Tây", kind: "island" },
      geometry: { type: "Point", coordinates: [114.333, 11.433] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Nam Yết", kind: "island" },
      geometry: { type: "Point", coordinates: [114.367, 10.183] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Sơn Ca", kind: "island" },
      geometry: { type: "Point", coordinates: [114.467, 10.383] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Sinh Tồn", kind: "island" },
      geometry: { type: "Point", coordinates: [114.333, 9.883] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo An Bang", kind: "island" },
      geometry: { type: "Point", coordinates: [112.917, 7.883] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Phan Vinh", kind: "island" },
      geometry: { type: "Point", coordinates: [113.7, 8.967] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Thuyền Chài", kind: "island" },
      geometry: { type: "Point", coordinates: [113.3, 8.183] },
    },
  ],
};

const LIGHT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

// Force Vietnamese labels on every symbol layer. Falls back to Latin
// transliteration, then the raw `name`.
const VI_TEXT_FIELD = [
  "coalesce",
  ["get", "name:vi"],
  ["get", "name:latin"],
  ["get", "name"],
];

async function loadLocalizedStyle(url: string): Promise<StyleSpecification> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Style fetch failed: ${res.status}`);
  const style = (await res.json()) as StyleSpecification;
  // Suppress any place feature (city, island, islet, locality, …) that
  // falls inside the Hoàng Sa or Trường Sa bounding boxes. This removes
  // the PRC-imposed "Sansha / Tam Sa" label AND every small-island name
  // that comes through OSM in Chinese/English, without us having to
  // enumerate them. We re-add the Vietnamese labels from our own source.
  const notInDisputed = ["!", ["within", DISPUTED_AREAS]];
  // OSM tags the PRC nine-dash line as admin_level=2, disputed=1,
  // claimed_by=CN. The stock style's `boundary_disputed` layer renders
  // any disputed line — including that one. Hide features claimed by CN
  // so the dashed U-shape claim is not drawn over the East Sea.
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

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function addOverlays(map: MLMap, isDark: boolean) {
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

  // Place markers as native layers — scale with zoom, always visible
  const categoryColorStops: string[] = [];
  for (const [cat, color] of Object.entries(CATEGORY_COLORS)) {
    categoryColorStops.push(cat, color);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colorExpr = [
    "match",
    ["get", "category"],
    ...categoryColorStops,
    DEFAULT_PLACE_COLOR,
  ] as any;

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
    // Name label — only at higher zooms
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

function labelControl(map: MLMap) {
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

/** Build GeoJSON FeatureCollection from places for native map layers */
function placesToGeoJSON(
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

export default function PlannerMap({
  places,
  route,
  focusCoord,
  onPickPlace,
}: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const readyRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [initialStyle, setInitialStyle] = useState<StyleSpecification | null>(
    null,
  );

  // Initialize map once — waits for the first localized style to load.
  useEffect(() => {
    if (!container.current || mapRef.current || !initialStyle) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: initialStyle,
      center: VN_CENTER,
      zoom: 12,
      attributionControl: { compact: true },
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showUserLocation: false,
    });
    map.addControl(geolocate, "top-right");

    const onStyleReady = () => {
      addOverlays(map, map === mapRef.current && isDarkRef.current);
      labelControl(map);
      readyRef.current = true;
      setStatus("ready");
    };

    map.on("load", onStyleReady);
    map.on("styledata", () => {
      if (map.isStyleLoaded()) onStyleReady();
    });
    map.on("error", () => setStatus("error"));

    const askLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const here: LngLat = [pos.coords.longitude, pos.coords.latitude];
          const src = map.getSource(USER_SRC) as
            | maplibregl.GeoJSONSource
            | undefined;
          if (src) {
            src.setData({
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: here },
            });
          }
          map.easeTo({
            center: here,
            zoom: 14,
            duration: prefersReducedMotion() ? 0 : 700,
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
      );
    };
    map.once("idle", askLocation);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, [initialStyle]);

  // Keep a ref to isDark so onStyleReady closure sees the latest.
  const isDarkRef = useRef(isDark);
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  // Fetch the localized style for the current theme, then either seed the
  // init effect (first load) or swap the live map's style (theme toggle).
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadLocalizedStyle(isDark ? DARK_STYLE_URL : LIGHT_STYLE_URL)
      .then((next) => {
        if (cancelled) return;
        const map = mapRef.current;
        if (map) {
          readyRef.current = false;
          map.setStyle(next);
        } else {
          setInitialStyle(next);
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [isDark]);

  // Sync places as native GeoJSON layer data + click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      const src = map.getSource(PLACES_SRC) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (src) src.setData(placesToGeoJSON(places));
    };

    if (readyRef.current) update();
    else map.once("load", update);
  }, [places]);

  // Click handler for native place layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [PLACES_CIRCLE_LAYER, PLACES_BORDER_LAYER],
      });
      if (features.length > 0) {
        const id = features[0].properties?.id;
        if (id) onPickPlace?.(String(id));
      }
    };
    const onEnter = () => { map.getCanvas().style.cursor = "pointer"; };
    const onLeave = () => { map.getCanvas().style.cursor = ""; };

    map.on("click", PLACES_CIRCLE_LAYER, onClick);
    map.on("click", PLACES_BORDER_LAYER, onClick);
    map.on("mouseenter", PLACES_CIRCLE_LAYER, onEnter);
    map.on("mouseleave", PLACES_CIRCLE_LAYER, onLeave);

    return () => {
      map.off("click", PLACES_CIRCLE_LAYER, onClick);
      map.off("click", PLACES_BORDER_LAYER, onClick);
      map.off("mouseenter", PLACES_CIRCLE_LAYER, onEnter);
      map.off("mouseleave", PLACES_CIRCLE_LAYER, onLeave);
    };
  }, [onPickPlace]);

  // Sync route line.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const src = map.getSource(ROUTE_SRC) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (!src) return;
      if (route) {
        src.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: route.path },
        });
        const bounds = route.path.reduce(
          (b, c) => b.extend(c),
          new maplibregl.LngLatBounds(route.path[0], route.path[0]),
        );
        map.fitBounds(bounds, {
          padding: 80,
          duration: prefersReducedMotion() ? 0 : 600,
        });
      } else {
        src.setData({ type: "FeatureCollection", features: [] });
      }
    };

    if (readyRef.current) apply();
    else map.once("load", apply);
  }, [route]);

  // Pan to focus coord.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCoord) return;
    map.flyTo({
      center: focusCoord,
      zoom: 15,
      duration: prefersReducedMotion() ? 0 : 700,
    });
  }, [focusCoord]);

  return (
    <>
      <div
        ref={container}
        style={{ width: "100%", height: "100%" }}
        className="bg-muted"
        role="application"
        aria-label="Bản đồ tuyến đường"
      />
      {status === "loading" && (
        <div
          className="pointer-events-none absolute inset-0 flex items-end justify-center p-4"
          aria-hidden
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs text-card-foreground shadow-sm backdrop-blur">
            <Skeleton className="h-2 w-2 rounded-full" />
            Đang tải bản đồ…
          </div>
        </div>
      )}
      {status === "error" && (
        <div
          role="alert"
          className="pointer-events-none absolute inset-0 grid place-items-center"
        >
          <div className="rounded-full border border-danger/40 bg-[color-mix(in_oklch,var(--danger)_12%,var(--card))] px-3 py-1.5 text-xs text-[var(--danger)] shadow-sm backdrop-blur">
            Lỗi tải bản đồ — kiểm tra Console (F12)
          </div>
        </div>
      )}
    </>
  );
}
