const UA = "VETCBuddy/1.0 (vetc-buddy hackathon)";
const TIMEOUT = 5_000;

/** Two Overpass endpoints, alternated to avoid per-server rate limits. */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/**
 * Downsample a coordinate path to at most `maxPoints` points.
 * Always keeps first and last point. Uses uniform sampling for speed.
 * This keeps tool results small enough for the LLM (~10KB vs ~568KB).
 */
export function simplifyPath(
  path: [number, number][],
  maxPoints = 200,
): [number, number][] {
  if (path.length <= maxPoints) return path;
  const step = (path.length - 1) / (maxPoints - 1);
  const result: [number, number][] = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    result.push(path[Math.round(i * step)]);
  }
  result.push(path[path.length - 1]);
  return result;
}

export type GeoResult = {
  lat: number;
  lng: number;
  displayName: string;
};

export type RouteGeometry = {
  distanceKm: number;
  durationMin: number;
  path: [number, number][]; // [lng, lat][]
};

export type POIResult = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
};

// --- Nominatim geocoding ---

export async function geocode(query: string): Promise<GeoResult | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "vn");
    url.searchParams.set("accept-language", "vi");

    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await res.json();
    if (!data.length) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch {
    return null;
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "json");
    url.searchParams.set("accept-language", "vi");

    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await res.json();
    return data.display_name ?? null;
  } catch {
    return null;
  }
}

// --- OSRM routing ---

// Key waypoints along Vietnam's north-south corridor (sorted by latitude, north → south).
// These keep OSRM from routing through Laos/Cambodia on long domestic trips.
const VN_CORRIDOR: { lat: number; lng: number }[] = [
  { lat: 21.03, lng: 105.85 }, // Hà Nội
  { lat: 20.43, lng: 106.17 }, // Ninh Bình
  { lat: 19.80, lng: 105.78 }, // Thanh Hóa
  { lat: 18.68, lng: 105.68 }, // Vinh
  { lat: 17.48, lng: 106.60 }, // Đồng Hới
  { lat: 16.46, lng: 107.60 }, // Huế
  { lat: 16.05, lng: 108.20 }, // Đà Nẵng
  { lat: 15.12, lng: 108.80 }, // Quảng Ngãi
  { lat: 13.77, lng: 109.22 }, // Quy Nhơn
  { lat: 12.24, lng: 109.19 }, // Nha Trang
  { lat: 11.94, lng: 108.44 }, // Đà Lạt
  { lat: 10.93, lng: 108.10 }, // Phan Thiết
  { lat: 10.78, lng: 106.70 }, // TP.HCM
  { lat: 10.04, lng: 105.78 }, // Cần Thơ
];

/**
 * For long-distance routes within Vietnam, pick intermediate corridor
 * waypoints so OSRM stays domestic instead of routing through Laos/Cambodia.
 */
function getVietnamWaypoints(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): { lat: number; lng: number }[] {
  const latSpan = Math.abs(from.lat - to.lat);

  // Only inject waypoints for long routes (>2° latitude ≈ >220 km north-south)
  if (latSpan < 2) return [];

  // Determine direction (north-to-south or south-to-north)
  const northLat = Math.max(from.lat, to.lat);
  const southLat = Math.min(from.lat, to.lat);

  // Select corridor points between from and to latitudes (with some padding)
  const padding = 0.3; // ~33km buffer
  const waypoints = VN_CORRIDOR.filter(
    (p) => p.lat < northLat - padding && p.lat > southLat + padding,
  );

  // Sort by latitude in the direction of travel
  if (from.lat > to.lat) {
    // Traveling south
    waypoints.sort((a, b) => b.lat - a.lat);
  } else {
    // Traveling north
    waypoints.sort((a, b) => a.lat - b.lat);
  }

  return waypoints;
}

/**
 * Build OSRM coordinate string with optional intermediate waypoints.
 */
export function buildOsrmCoords(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): string {
  const waypoints = getVietnamWaypoints(from, to);
  const points = [from, ...waypoints, to];
  return points.map((p) => `${p.lng},${p.lat}`).join(";");
}

export async function route(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<RouteGeometry | null> {
  try {
    const coords = buildOsrmCoords(from, to);
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;

    const r = data.routes[0];
    return {
      distanceKm: Math.round(r.distance / 100) / 10,
      durationMin: Math.round(r.duration / 60),
      path: r.geometry.coordinates as [number, number][],
    };
  } catch {
    return null;
  }
}

// --- Haversine distance ---

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Overpass POI search ---

const CATEGORY_TO_OSM: Record<string, string> = {
  eat: 'nwr["amenity"~"restaurant|fast_food"]',
  cafe: 'nwr["amenity"="cafe"]',
  fuel: 'nwr["amenity"="fuel"]',
  charge: 'nwr["amenity"="charging_station"]',
  parking: 'nwr["amenity"="parking"]',
  hotel: 'nwr["tourism"~"hotel|motel|guest_house"]',
  rest_stop: 'nwr["highway"~"rest_area|services"]',
};

const CATEGORY_LABEL_VI: Record<string, string> = {
  eat: "Quán ăn",
  cafe: "Quán cà phê",
  fuel: "Trạm xăng",
  charge: "Trạm sạc",
  parking: "Bãi đỗ xe",
  hotel: "Khách sạn",
  rest_stop: "Trạm dừng nghỉ",
};

/** Build the best available address from OSM tags. */
export function buildAddress(tags: Record<string, string>): string {
  if (tags["addr:full"]) return tags["addr:full"];

  const parts: string[] = [];
  if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"]);
  if (tags["addr:street"]) parts.push(tags["addr:street"]);
  const district = tags["addr:district"] ?? tags["addr:suburb"] ?? tags["addr:subdistrict"];
  if (district) parts.push(district);
  const city = tags["addr:city"] ?? tags["addr:province"];
  if (city) parts.push(city);

  if (parts.length > 0) return parts.join(", ");

  // Fallback: "addr:place" is sometimes used in rural areas
  if (tags["addr:place"]) return tags["addr:place"];
  return "";
}

/** Extract coordinates from an Overpass element (node has lat/lon, way/relation has center). */
function extractCoords(el: Record<string, unknown>): { lat: number; lng: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  const center = el.center as { lat?: number; lon?: number } | undefined;
  if (center && typeof center.lat === "number" && typeof center.lon === "number") {
    return { lat: center.lat, lng: center.lon };
  }
  return null;
}

/**
 * Get a normalized chain/brand key for deduplication.
 * Chains like "Highland Coffee - Q1" and "Highland Coffee - Nguyễn Huệ" share the same key.
 */
function extractChainKey(name: string, tags: Record<string, string>): string {
  // OSM brand tag is the most reliable chain identifier
  if (tags.brand) return tags.brand.toLowerCase().trim();

  // Strip branch suffixes: " - Nguyễn Huệ", " — Q.1", " (CN3)", " Chi nhánh 2"
  const base = name
    .replace(/\s*[-–—]\s*.+$/, "")
    .replace(/\s*\(.*\)\s*$/, "")
    .replace(/\s*chi\s*nhánh\s*\d*/i, "")
    .replace(/\s*CN\s*\d+/i, "")
    .replace(/\s+\d+\s*$/, "")
    .trim();

  return (base || name).toLowerCase();
}

/**
 * Deduplicate places by chain/brand name.
 * Keeps the entry with the best address for each chain.
 */
export function deduplicatePlaces<T extends { name: string; tags: Record<string, string> }>(
  places: T[],
): T[] {
  const groups = new Map<string, T[]>();

  for (const place of places) {
    const key = extractChainKey(place.name, place.tags);
    const group = groups.get(key);
    if (group) group.push(place);
    else groups.set(key, [place]);
  }

  const result: T[] = [];
  for (const group of groups.values()) {
    // Pick the entry with the most complete address
    const best = group.reduce((a, b) => {
      const aLen = buildAddress(a.tags).length;
      const bLen = buildAddress(b.tags).length;
      return bLen > aLen ? b : a;
    });
    result.push(best);
  }

  return result;
}

function resolvePOIName(tags: Record<string, string>, category: string): string {
  // Prefer Vietnamese name, then any name
  const name = tags["name:vi"] ?? tags.name;
  if (name) return name;

  // Try brand / operator (common for fuel, parking, charging stations)
  const brand = tags.brand ?? tags.operator;

  // Try to build a location-based name from address
  const street = tags["addr:street"];
  const housenumber = tags["addr:housenumber"];
  const addr = street
    ? housenumber ? `${housenumber} ${street}` : street
    : null;

  const label = CATEGORY_LABEL_VI[category] ?? category;

  if (brand && addr) return `${brand} — ${addr}`;
  if (brand) return brand;
  if (addr) return `${label} — ${addr}`;

  return label;
}

export async function searchPOI(
  category: string,
  center: { lat: number; lng: number },
  radiusM: number = 5000,
): Promise<POIResult[]> {
  const osmFilter = CATEGORY_TO_OSM[category];
  if (!osmFilter) return [];

  try {
    const query = `
      [out:json][timeout:10];
      ${osmFilter}(around:${radiusM},${center.lat},${center.lng});
      out body center 20;
    `;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();

    const raw = (data.elements ?? [])
      .map((el: Record<string, unknown>) => {
        const coords = extractCoords(el);
        if (!coords || !el.tags) return null;
        const tags = el.tags as Record<string, string>;
        return {
          id: String(el.id),
          name: resolvePOIName(tags, category),
          lat: coords.lat,
          lng: coords.lng,
          tags,
        };
      })
      .filter(Boolean) as POIResult[];

    return deduplicatePlaces(raw);
  } catch {
    return [];
  }
}

// --- Rest-stop search along a route ---

/** Major Vietnamese cities for instant area-name resolution (no API call). */
const VN_CITIES = [
  { lat: 21.03, lng: 105.85, name: "Hà Nội" },
  { lat: 20.86, lng: 106.68, name: "Hải Phòng" },
  { lat: 20.43, lng: 106.17, name: "Ninh Bình" },
  { lat: 19.80, lng: 105.78, name: "Thanh Hóa" },
  { lat: 18.68, lng: 105.68, name: "Vinh" },
  { lat: 17.48, lng: 106.60, name: "Đồng Hới" },
  { lat: 16.46, lng: 107.60, name: "Huế" },
  { lat: 16.05, lng: 108.20, name: "Đà Nẵng" },
  { lat: 15.88, lng: 108.33, name: "Hội An" },
  { lat: 15.12, lng: 108.80, name: "Quảng Ngãi" },
  { lat: 14.36, lng: 108.00, name: "Pleiku" },
  { lat: 13.77, lng: 109.22, name: "Quy Nhơn" },
  { lat: 12.68, lng: 108.05, name: "Buôn Ma Thuột" },
  { lat: 12.24, lng: 109.19, name: "Nha Trang" },
  { lat: 11.94, lng: 108.44, name: "Đà Lạt" },
  { lat: 11.58, lng: 108.99, name: "Phan Rang" },
  { lat: 11.55, lng: 107.81, name: "Bảo Lộc" },
  { lat: 10.93, lng: 108.10, name: "Phan Thiết" },
  { lat: 10.98, lng: 106.65, name: "Long Thành" },
  { lat: 10.95, lng: 106.84, name: "Biên Hòa" },
  { lat: 11.33, lng: 106.63, name: "Bình Dương" },
  { lat: 10.78, lng: 106.70, name: "TP.HCM" },
  { lat: 10.37, lng: 107.08, name: "Vũng Tàu" },
  { lat: 10.36, lng: 106.36, name: "Mỹ Tho" },
  { lat: 10.04, lng: 105.78, name: "Cần Thơ" },
  { lat: 9.60, lng: 105.97, name: "Sóc Trăng" },
  { lat: 9.78, lng: 105.46, name: "Cà Mau" },
];

function nearestCityName(lat: number, lng: number): string {
  let minDist = Infinity;
  let name = "";
  for (const city of VN_CITIES) {
    const d = haversineKm(lat, lng, city.lat, city.lng);
    if (d < minDist) {
      minDist = d;
      name = city.name;
    }
  }
  return minDist > 30 ? `Gần ${name}` : name;
}

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

/**
 * Single combined OSM filter per category.
 * `rest_stop` → composite regex covering restaurants + fuel + cafes.
 * This keeps the Overpass query to N parts (one per stop) to avoid timeouts.
 */
function routeSearchFilter(category: string): string {
  if (category === "rest_stop") {
    return 'nwr["amenity"~"restaurant|fast_food|fuel|cafe"]';
  }
  return CATEGORY_TO_OSM[category] ?? 'nwr["amenity"~"restaurant|fast_food|fuel"]';
}

/** Detect the place category from OSM tags. */
function detectPOICategory(tags: Record<string, string>): string {
  if (tags.amenity === "restaurant" || tags.amenity === "fast_food") return "eat";
  if (tags.amenity === "fuel") return "fuel";
  if (tags.amenity === "cafe") return "cafe";
  if (tags.amenity === "charging_station") return "charge";
  if (tags.amenity === "parking") return "parking";
  if (tags.tourism === "hotel" || tags.tourism === "motel" || tags.tourism === "guest_house") return "hotel";
  if (tags.highway === "rest_area" || tags.highway === "services") return "rest_stop";
  return "eat";
}

/** Compute cumulative haversine distances along a path (km). */
function computeCumulativeDistances(path: [number, number][]): number[] {
  const d = [0];
  for (let i = 1; i < path.length; i++) {
    const seg = haversineKm(
      path[i - 1][1],
      path[i - 1][0],
      path[i][1],
      path[i][0],
    );
    d.push(d[i - 1] + seg);
  }
  return d;
}
