import { UA, CATEGORY_TO_OSM, CATEGORY_LABEL_VI, OVERPASS_ENDPOINTS } from "./constants";
import { buildAddress } from "./geocoding";
import { fallbackPOI } from "./poi-fallback";

export type POIResult = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
};

/** Extract coordinates from an Overpass element (node has lat/lon, way/relation has center). */
export function extractCoords(el: Record<string, unknown>): { lat: number; lng: number } | null {
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
export function extractChainKey(name: string, tags: Record<string, string>): string {
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

export function resolvePOIName(tags: Record<string, string>, category: string): string {
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

/** Detect the place category from OSM tags. */
export function detectPOICategory(tags: Record<string, string>): string {
  if (tags.amenity === "restaurant" || tags.amenity === "fast_food") return "eat";
  if (tags.amenity === "fuel") return "fuel";
  if (tags.amenity === "cafe" || tags.shop === "coffee") return "cafe";
  if (tags.cuisine?.match(/coffee|coffee_shop/)) return "cafe";
  if (tags.amenity === "charging_station") return "charge";
  if (tags.amenity === "parking" || tags.amenity === "motorcycle_parking" || tags.building === "parking") return "parking";
  if (tags.tourism === "hotel" || tags.tourism === "motel" || tags.tourism === "guest_house") return "hotel";
  if (tags.highway === "rest_area" || tags.highway === "services") return "rest_stop";
  return "eat";
}

/**
 * OSM filters per category for route-based searches.
 * `rest_stop` → composite covering restaurants + fuel + cafes + coffee shops.
 */
export function routeSearchFilter(category: string): string[] {
  if (category === "rest_stop") {
    return [
      'nwr["amenity"~"restaurant|fast_food|fuel|cafe"]',
      'nwr["shop"="coffee"]',
    ];
  }
  return CATEGORY_TO_OSM[category] ?? ['nwr["amenity"~"restaurant|fast_food|fuel"]'];
}

let _overpassIdx = 0;
function nextOverpassEndpoint(): string {
  return OVERPASS_ENDPOINTS[_overpassIdx++ % OVERPASS_ENDPOINTS.length];
}

export async function searchPOI(
  category: string,
  center: { lat: number; lng: number },
  radiusM: number = 5000,
): Promise<POIResult[]> {
  const osmFilters = CATEGORY_TO_OSM[category];
  if (!osmFilters) return [];

  try {
    const aroundClause = `(around:${radiusM},${center.lat},${center.lng})`;
    const filterParts = osmFilters.map((f) => `${f}${aroundClause};`).join("");
    const query = `[out:json][timeout:10];(${filterParts});out body center 30;`;

    const res = await fetch(nextOverpassEndpoint(), {
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

    if (raw.length > 0) return deduplicatePlaces(raw);
    // Overpass returned empty — try fallback mock data
    return fallbackPOI(category, center, radiusM / 1000);
  } catch {
    // Overpass unreachable — use fallback mock data for demo
    return fallbackPOI(category, center, radiusM / 1000);
  }
}
