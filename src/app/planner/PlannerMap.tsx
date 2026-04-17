"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type StyleSpecification,
  Map as MLMap,
  Marker,
} from "maplibre-gl";
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

const PRIMARY_STYLE: StyleSpecification = {
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

function addOverlays(map: MLMap) {
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
      paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 },
    });
    map.addLayer({
      id: ROUTE_LAYER,
      type: "line",
      source: ROUTE_SRC,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#2563eb", "line-width": 5 },
    });
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
        "circle-color": "#2563eb",
        "circle-opacity": 0.15,
      },
    });
    map.addLayer({
      id: USER_LAYER,
      type: "circle",
      source: USER_SRC,
      paint: {
        "circle-radius": 7,
        "circle-color": "#2563eb",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }
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
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Initialize map once.
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const markers = markersRef.current;

    const map = new maplibregl.Map({
      container: container.current,
      style: PRIMARY_STYLE,
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
      showUserLocation: false, // we draw our own dot
    });
    map.addControl(geolocate, "top-right");

    const onStyleReady = () => {
      addOverlays(map);
      readyRef.current = true;
      setStatus("ready");
    };

    map.on("load", onStyleReady);
    map.on("styledata", () => {
      if (map.isStyleLoaded()) onStyleReady();
    });
    map.on("error", () => setStatus("error"));

    // Ask for geolocation once style is ready.
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
          map.easeTo({ center: here, zoom: 14, duration: 700 });
        },
        (err) => {
          // Silent — HCMC default center is already set.
          console.debug("Geolocation denied or unavailable:", err.message);
        },
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
  }, []);

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
      el.setAttribute("aria-label", place.name);
      el.className =
        "planner-marker " +
        (place.category ? `planner-marker--${place.category}` : "planner-marker--eat");
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
      const src = map.getSource(ROUTE_SRC) as maplibregl.GeoJSONSource | undefined;
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
        map.fitBounds(bounds, { padding: 80, duration: 600 });
      } else {
        src.setData({ type: "FeatureCollection", features: [] });
      }
    };

    if (readyRef.current) apply();
    else map.once("load", apply);
  }, [route]);

  // Pan to focus coord (clicking a list item).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCoord) return;
    map.flyTo({ center: focusCoord, zoom: 15, duration: 700 });
  }, [focusCoord]);

  return (
    <>
      <div ref={container} style={{ width: "100%", height: "100%" }} className="bg-zinc-200 dark:bg-zinc-800" />
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs text-zinc-600 shadow ring-1 ring-black/5 backdrop-blur dark:bg-zinc-900/80 dark:text-zinc-300 dark:ring-white/10">
            Đang tải bản đồ…
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-full bg-rose-100 px-3 py-1.5 text-xs text-rose-600 shadow ring-1 ring-rose-200 backdrop-blur">
            Lỗi tải bản đồ — kiểm tra Console (F12)
          </div>
        </div>
      )}
    </>
  );
}
