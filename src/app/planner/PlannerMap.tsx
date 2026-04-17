"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  type StyleSpecification,
  Map as MLMap,
  Marker,
} from "maplibre-gl";
import { useTheme } from "next-themes";

import { Skeleton } from "@/components/ui/skeleton";

import { getCategoryLabel } from "./category-meta";
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

const LIGHT_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#e5e7eb" } },
    { id: "osm", type: "raster", source: "osm" },
  ],
};

const DARK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap, © CARTO",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0d1117" } },
    { id: "carto", type: "raster", source: "carto" },
  ],
};

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

export default function PlannerMap({
  places,
  route,
  focusCoord,
  onPickPlace,
}: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const readyRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const style = useMemo(() => (isDark ? DARK_STYLE : LIGHT_STYLE), [isDark]);

  // Initialize map once.
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const markers = markersRef.current;

    const map = new maplibregl.Map({
      container: container.current,
      style,
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
      markers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref to isDark so onStyleReady closure sees the latest.
  const isDarkRef = useRef(isDark);
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  // Swap style on theme change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    readyRef.current = false;
    setStatus("loading");
    map.setStyle(style);
  }, [style]);

  // Sync markers for places.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existing = markersRef.current;
    const nextIds = new Set(places.map((p) => p.id));

    for (const [id, m] of existing) {
      if (!nextIds.has(id)) {
        m.remove();
        existing.delete(id);
      }
    }

    for (const place of places) {
      if (existing.has(place.id)) {
        existing.get(place.id)!.setLngLat(place.coord);
        continue;
      }
      const el = document.createElement("button");
      el.type = "button";
      const label = `${getCategoryLabel(place.category)}: ${place.name}`;
      el.setAttribute("aria-label", label);
      el.setAttribute("title", label);
      el.className =
        "planner-marker " +
        (place.category
          ? `planner-marker--${place.category}`
          : "planner-marker--eat");
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onPickPlace?.(place.id);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(place.coord)
        .addTo(map);
      existing.set(place.id, marker);
    }
  }, [places, onPickPlace]);

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
