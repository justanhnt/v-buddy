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
