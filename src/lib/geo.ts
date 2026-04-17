const UA = "VETCBuddy/1.0 (vetc-buddy hackathon)";
const TIMEOUT = 5_000;

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

// --- Overpass POI search ---

const CATEGORY_TO_OSM: Record<string, string> = {
  eat: 'node["amenity"~"restaurant|fast_food"]',
  cafe: 'node["amenity"="cafe"]',
  fuel: 'node["amenity"="fuel"]',
  charge: 'node["amenity"="charging_station"]',
  parking: 'node["amenity"="parking"]',
  hotel: 'node["tourism"~"hotel|motel|guest_house"]',
  rest_stop: 'node["highway"~"rest_area|services"]',
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
      out body 20;
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

    return (data.elements ?? [])
      .filter((el: Record<string, unknown>) => el.lat && el.lon && el.tags)
      .map((el: Record<string, unknown>) => ({
        id: String(el.id),
        name: resolvePOIName(el.tags as Record<string, string>, category),
        lat: el.lat as number,
        lng: el.lon as number,
        tags: el.tags as Record<string, string>,
      }));
  } catch {
    return [];
  }
}
