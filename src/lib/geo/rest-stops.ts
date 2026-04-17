import { UA, OVERPASS_ENDPOINTS } from "./constants";
import { nearestCityName } from "./geocoding";
import { haversineKm, simplifyPath, computeCumulativeDistances } from "./math";
import {
  type POIResult,
  extractCoords,
  deduplicatePlaces,
  resolvePOIName,
  detectPOICategory,
  routeSearchFilter,
} from "./poi";

export type RestStopPlace = POIResult & { category: string };

export type RestStop = {
  km_marker: number;
  area_name: string;
  lat: number;
  lng: number;
  places: RestStopPlace[];
};

/**
 * Find rest stops along a route by sampling points at regular intervals,
 * then searching for amenities near each point using a single batched
 * Overpass union query.
 *
 * For `rest_stop` category, broadens to restaurants + fuel + cafes since
 * `highway=rest_area` has sparse coverage in Vietnam.
 */
export async function findRestStopsAlongRoute(
  routePath: [number, number][], // [lng, lat][] from OSRM
  routeDistanceKm: number,
  category: string,
  searchRadiusM: number = 5000,
): Promise<RestStop[]> {
  // 1. Sample rest points along the route (~every 150 km)
  const markerPath = simplifyPath(routePath, 100);
  const cumDist = computeCumulativeDistances(markerPath);

  const numStops = Math.max(1, Math.min(10, Math.round(routeDistanceKm / 150)));
  const interval = routeDistanceKm / (numStops + 1);

  const samplePoints: { km: number; lat: number; lng: number; name: string }[] = [];
  for (let i = 1; i <= numStops; i++) {
    const targetKm = Math.round(interval * i);
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let j = 0; j < cumDist.length; j++) {
      const diff = Math.abs(cumDist[j] - targetKm);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = j;
      }
    }
    const lat = markerPath[bestIdx][1]; // [lng, lat] → lat
    const lng = markerPath[bestIdx][0]; // [lng, lat] → lng
    samplePoints.push({ km: targetKm, lat, lng, name: nearestCityName(lat, lng) });
  }

  // 2. Query Overpass in small batches (3 stops each), alternating between
  //    two Overpass endpoints to avoid rate-limit errors on long routes.
  const filter = routeSearchFilter(category);
  const BATCH = 3;
  const batches: typeof samplePoints[] = [];
  for (let i = 0; i < samplePoints.length; i += BATCH) {
    batches.push(samplePoints.slice(i, i + BATCH));
  }

  const elements: Record<string, unknown>[] = [];

  // Run batches in parallel pairs (one per endpoint)
  for (let r = 0; r < batches.length; r += 2) {
    const promises: Promise<Record<string, unknown>[]>[] = [];
    for (let j = 0; j < 2 && r + j < batches.length; j++) {
      const batch = batches[r + j];
      const endpoint = OVERPASS_ENDPOINTS[j];
      const parts = batch.map(
        (p) => `${filter}(around:${searchRadiusM},${p.lat},${p.lng});`,
      );
      const q = `[out:json][timeout:15];(${parts.join("")});out body center ${batch.length * 5};`;

      promises.push(
        fetch(endpoint, {
          method: "POST",
          body: `data=${encodeURIComponent(q)}`,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": UA,
          },
          signal: AbortSignal.timeout(20_000),
        })
          .then((res) => res.text())
          .then((text) => {
            if (text.startsWith("<") || !text.startsWith("{")) return [];
            return (JSON.parse(text).elements as Record<string, unknown>[]) ?? [];
          })
          .catch(() => [] as Record<string, unknown>[]),
      );
    }
    const results = await Promise.all(promises);
    for (const els of results) elements.push(...els);
  }

  // 3. Parse elements and group by nearest sample point
  const grouped = new Map<number, RestStopPlace[]>();
  for (const sp of samplePoints) grouped.set(sp.km, []);

  const seenIds = new Set<string>();
  for (const el of elements) {
    const coords = extractCoords(el);
    if (!coords || !el.tags) continue;
    const id = String(el.id);
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const { lat, lng } = coords;
    const tags = el.tags as Record<string, string>;

    // Nearest sample point
    let nearestKm = samplePoints[0].km;
    let minDist = Infinity;
    for (const sp of samplePoints) {
      const d = haversineKm(lat, lng, sp.lat, sp.lng);
      if (d < minDist) {
        minDist = d;
        nearestKm = sp.km;
      }
    }

    const cat = detectPOICategory(tags);
    grouped.get(nearestKm)?.push({
      id,
      name: resolvePOIName(tags, cat),
      lat,
      lng,
      tags,
      category: cat,
    });
  }

  // 4. Deduplicate chains per stop, keep top 3, drop empty stops
  return samplePoints
    .map((sp) => ({
      km_marker: sp.km,
      area_name: sp.name,
      lat: sp.lat,
      lng: sp.lng,
      places: deduplicatePlaces(grouped.get(sp.km) ?? []).slice(0, 3),
    }))
    .filter((stop) => stop.places.length > 0);
}
