"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type StyleSpecification,
  Map as MLMap,
} from "maplibre-gl";
import { useTheme } from "next-themes";

import { Skeleton } from "@/components/ui/skeleton";

import { VN_CENTER } from "@/lib/geo/constants";
import type { LngLat, Place, RouteResult } from "@/types/planner";

import {
  ROUTE_SRC,
  USER_SRC,
  PLACES_SRC,
  PLACES_CIRCLE_LAYER,
  PLACES_BORDER_LAYER,
  LIGHT_STYLE_URL,
  DARK_STYLE_URL,
} from "./constants";
import { addOverlays } from "./overlays";
import {
  loadLocalizedStyle,
  prefersReducedMotion,
  placesToGeoJSON,
  labelControl,
} from "./utils";

type Props = {
  places: Place[];
  route: RouteResult | null;
  focusCoord: LngLat | null;
  onPickPlace?: (id: string) => void;
};

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

  // Keep a ref to isDark so onStyleReady closure sees the latest.
  const isDarkRef = useRef(isDark);
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  // Initialize map once -- waits for the first localized style to load.
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

  // Sync places as native GeoJSON layer data
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
