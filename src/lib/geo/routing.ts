import { UA, VN_CORRIDOR } from "./constants";

export type RouteGeometry = {
  distanceKm: number;
  durationMin: number;
  path: [number, number][]; // [lng, lat][]
};

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
