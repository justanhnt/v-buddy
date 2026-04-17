import { UA, TIMEOUT, VN_CITIES } from "./constants";
import { haversineKm } from "./math";

export type GeoResult = {
  lat: number;
  lng: number;
  displayName: string;
};

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

export function nearestCityName(lat: number, lng: number): string {
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

export type PlaceSearchResult = {
  place_id: string;
  lat: number;
  lng: number;
  displayName: string;
  class?: string;
  type?: string;
};

/** Search for places by name or address via Nominatim. */
export async function searchPlaces(
  query: string,
  bias?: { lat: number; lng: number },
): Promise<PlaceSearchResult[]> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycodes", "vn");
    url.searchParams.set("accept-language", "vi");
    url.searchParams.set("addressdetails", "1");

    if (bias) {
      const delta = 0.2; // ~22km viewbox
      url.searchParams.set(
        "viewbox",
        `${bias.lng - delta},${bias.lat + delta},${bias.lng + delta},${bias.lat - delta}`,
      );
      url.searchParams.set("bounded", "0");
    }

    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await res.json();

    return (data as Record<string, unknown>[]).map((item) => ({
      place_id: String(item.place_id),
      lat: parseFloat(item.lat as string),
      lng: parseFloat(item.lon as string),
      displayName: item.display_name as string,
      class: item.class as string | undefined,
      type: item.type as string | undefined,
    }));
  } catch {
    return [];
  }
}

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
