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

export function haversineKm(
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

/** Compute cumulative haversine distances along a path (km). */
export function computeCumulativeDistances(path: [number, number][]): number[] {
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
