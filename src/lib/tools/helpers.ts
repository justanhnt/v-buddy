import { TOLL_ROUTES, CITY_ALIASES } from "../toll-data";
import { haversineKm } from "../geo";

export { haversineKm };

export const VEHICLE_MULTIPLIER: Record<string, number> = {
  car_under_12: 1,
  car_12_to_30: 1.5,
  truck: 2.5,
  motorbike: 0, // motorbikes don't pay expressway tolls in Vietnam
};

export const DEFAULT_CONSUMPTION: Record<string, number> = {
  RON95: 8, // 8L/100km for average car
  RON92: 8,
  diesel: 7,
  electric: 18, // 18kWh/100km for average EV
};

export function buildMeta(category: string, tags: Record<string, string>): string {
  switch (category) {
    case "eat":
    case "cafe":
      return [tags.cuisine, tags.opening_hours].filter(Boolean).join(" · ") || "";
    case "fuel":
      return tags.brand ?? tags.operator ?? "";
    case "charge": {
      const sockets = tags["socket:type2"] ?? tags["socket:chademo"] ?? "";
      return sockets ? `${sockets} trụ sạc` : tags.operator ?? "";
    }
    case "parking":
      return tags.fee === "no" ? "Miễn phí" : tags.capacity ? `${tags.capacity} chỗ` : "";
    case "hotel":
      return tags.stars ? `${tags.stars} sao` : "";
    default:
      return "";
  }
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

function resolveAlias(normalized: string): string[] {
  const results = [normalized];
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    if (aliases.some((a) => normalized.includes(a) || a.includes(normalized))) {
      results.push(canonical);
    }
  }
  return results;
}

export function findTollRouteKey(from: string, to: string): string | null {
  const fromCandidates = resolveAlias(normalizeName(from));
  const toCandidates = resolveAlias(normalizeName(to));

  for (const key of Object.keys(TOLL_ROUTES)) {
    const parts = key.split("-");
    const matchFrom = parts.some((p) =>
      fromCandidates.some((f) => f.includes(p) || p.includes(f)),
    );
    const matchTo = parts.some((p) =>
      toCandidates.some((t) => t.includes(p) || p.includes(t)),
    );
    if (matchFrom && matchTo) return key;
  }

  // Try reverse direction
  for (const key of Object.keys(TOLL_ROUTES)) {
    const parts = key.split("-");
    const matchFrom = parts.some((p) =>
      toCandidates.some((t) => t.includes(p) || p.includes(t)),
    );
    const matchTo = parts.some((p) =>
      fromCandidates.some((f) => f.includes(p) || p.includes(f)),
    );
    if (matchFrom && matchTo) return key;
  }

  return null;
}
