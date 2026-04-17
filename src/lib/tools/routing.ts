import { tool } from "ai";
import { z } from "zod";
import { geocode, route, buildOsrmCoords, simplifyPath } from "../geo";
import { TOLL_ROUTES, FUEL_PRICES, DEFAULT_TOLL_RATE_PER_KM } from "../toll-data";
import { VEHICLE_MULTIPLIER, DEFAULT_CONSUMPTION, findTollRouteKey } from "./helpers";

export const plan_route = tool({
  description:
    "Tìm đường đi giữa hai điểm. Trả về khoảng cách, thời gian, và đường đi trên bản đồ. Dùng khi người dùng muốn đi từ A đến B.",
  inputSchema: z.object({
    from: z.string().describe("Điểm xuất phát, ví dụ: 'TP.HCM', 'Quận 1'"),
    to: z.string().describe("Điểm đến, ví dụ: 'Đà Lạt', 'Sân bay Long Thành'"),
  }),
  execute: async ({ from, to }) => {
    const [fromGeo, toGeo] = await Promise.all([geocode(from), geocode(to)]);

    if (!fromGeo || !toGeo) {
      return {
        error: true,
        message: `Không tìm thấy ${!fromGeo ? from : to} trên bản đồ.`,
      };
    }

    const r = await route(
      { lat: fromGeo.lat, lng: fromGeo.lng },
      { lat: toGeo.lat, lng: toGeo.lng },
    );

    if (!r) {
      return {
        error: true,
        message: "Không tìm được tuyến đường. Thử lại sau.",
      };
    }

    return {
      from: { name: fromGeo.displayName, lat: fromGeo.lat, lng: fromGeo.lng },
      to: { name: toGeo.displayName, lat: toGeo.lat, lng: toGeo.lng },
      distanceKm: r.distanceKm,
      durationMin: r.durationMin,
      path: simplifyPath(r.path),
    };
  },
});

export const compare_routes = tool({
  description:
    "So sánh nhiều tuyến đường giữa hai điểm: thời gian, khoảng cách, chi phí cầu đường, chi phí nhiên liệu. Dùng khi người dùng muốn chọn tuyến nhanh nhất hoặc rẻ nhất.",
  inputSchema: z.object({
    from: z.string().describe("Điểm xuất phát"),
    to: z.string().describe("Điểm đến"),
    vehicle_type: z
      .enum(["car_under_12", "car_12_to_30", "truck", "motorbike"])
      .optional()
      .default("car_under_12")
      .describe("Loại phương tiện"),
    fuel_type: z
      .enum(["RON95", "RON92", "diesel", "electric"])
      .optional()
      .default("RON95")
      .describe("Loại nhiên liệu"),
  }),
  execute: async ({ from, to, vehicle_type, fuel_type }) => {
    const [fromGeo, toGeo] = await Promise.all([geocode(from), geocode(to)]);

    if (!fromGeo || !toGeo) {
      return {
        error: true,
        message: `Không tìm thấy ${!fromGeo ? from : to} trên bản đồ.`,
        routes: [],
      };
    }

    // Fetch routes with alternatives from OSRM (using Vietnam waypoints for long routes)
    const coords = buildOsrmCoords(
      { lat: fromGeo.lat, lng: fromGeo.lng },
      { lat: toGeo.lat, lng: toGeo.lng },
    );
    let routeData;
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=true`,
        { headers: { "User-Agent": "VETCBuddy/1.0" }, signal: AbortSignal.timeout(10_000) },
      );
      routeData = await res.json();
    } catch {
      return { error: true, message: "Không tìm được tuyến đường.", routes: [] };
    }

    if (routeData.code !== "Ok" || !routeData.routes?.length) {
      return { error: true, message: "Không tìm được tuyến đường.", routes: [] };
    }

    const vt = vehicle_type ?? "car_under_12";
    const ft = fuel_type ?? "RON95";
    const multiplier = VEHICLE_MULTIPLIER[vt];
    const consumption = DEFAULT_CONSUMPTION[ft];
    const pricePerUnit = FUEL_PRICES[ft];

    const routes = routeData.routes.slice(0, 3).map((r: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }, idx: number) => {
      const distanceKm = Math.round(r.distance / 100) / 10;
      const durationMin = Math.round(r.duration / 60);

      // Toll estimation
      const tollKey = findTollRouteKey(from, to);
      let tollVnd = 0;
      if (tollKey && TOLL_ROUTES[tollKey]) {
        tollVnd = TOLL_ROUTES[tollKey].gates.reduce((sum, g) => sum + Math.round(g.baseFee * multiplier), 0);
      } else if (multiplier > 0) {
        tollVnd = Math.round(distanceKm * DEFAULT_TOLL_RATE_PER_KM * multiplier);
      }

      // Fuel estimation
      const fuelVnd = Math.round((distanceKm / 100) * consumption * pricePerUnit);

      const labels = ["Nhanh nhất", "Tuyến 2", "Tuyến 3"];
      const tags: string[] = [];
      if (idx === 0) tags.push("fastest");

      return {
        label: labels[idx] ?? `Tuyến ${idx + 1}`,
        distance_km: distanceKm,
        duration_min: durationMin,
        toll_vnd: tollVnd,
        fuel_vnd: fuelVnd,
        total_vnd: tollVnd + fuelVnd,
        path: simplifyPath(r.geometry.coordinates as [number, number][]),
        tags,
      };
    });

    // Tag cheapest
    const cheapest = routes.reduce((min: typeof routes[0], r: typeof routes[0]) =>
      r.total_vnd < min.total_vnd ? r : min,
      routes[0],
    );
    if (cheapest !== routes[0]) {
      cheapest.tags.push("cheapest");
      cheapest.label = "Tiết kiệm nhất";
    }

    return {
      from: { name: fromGeo.displayName.split(",").slice(0, 2).join(","), lat: fromGeo.lat, lng: fromGeo.lng },
      to: { name: toGeo.displayName.split(",").slice(0, 2).join(","), lat: toGeo.lat, lng: toGeo.lng },
      routes,
    };
  },
});

export const multi_stop_trip = tool({
  description:
    "Lên kế hoạch chuyến đi nhiều điểm dừng. Ví dụ: TP.HCM → Đà Lạt → Nha Trang. Trả về từng chặng với khoảng cách, thời gian, phí cầu đường, chi phí nhiên liệu.",
  inputSchema: z.object({
    stops: z
      .array(z.string())
      .min(2)
      .max(8)
      .describe("Danh sách các điểm dừng theo thứ tự"),
    vehicle_type: z
      .enum(["car_under_12", "car_12_to_30", "truck", "motorbike"])
      .optional()
      .default("car_under_12")
      .describe("Loại phương tiện"),
    fuel_type: z
      .enum(["RON95", "RON92", "diesel", "electric"])
      .optional()
      .default("RON95")
      .describe("Loại nhiên liệu"),
  }),
  execute: async ({ stops, vehicle_type, fuel_type }) => {
    const vt = vehicle_type ?? "car_under_12";
    const ft = fuel_type ?? "RON95";
    const multiplier = VEHICLE_MULTIPLIER[vt];
    const consumption = DEFAULT_CONSUMPTION[ft];
    const pricePerUnit = FUEL_PRICES[ft];

    // Geocode all stops in parallel
    const geoResults = await Promise.all(stops.map((s) => geocode(s)));

    const resolvedStops: { name: string; lat: number; lng: number }[] = [];
    for (let i = 0; i < stops.length; i++) {
      const geo = geoResults[i];
      if (!geo) {
        return {
          error: true,
          message: `Không tìm thấy "${stops[i]}" trên bản đồ.`,
          stops: [],
          legs: [],
          totals: null,
        };
      }
      resolvedStops.push({
        name: geo.displayName.split(",").slice(0, 2).join(",").trim(),
        lat: geo.lat,
        lng: geo.lng,
      });
    }

    // Route each consecutive pair in parallel
    const legPromises = [];
    for (let i = 0; i < resolvedStops.length - 1; i++) {
      legPromises.push(
        route(
          { lat: resolvedStops[i].lat, lng: resolvedStops[i].lng },
          { lat: resolvedStops[i + 1].lat, lng: resolvedStops[i + 1].lng },
        ),
      );
    }
    const legRoutes = await Promise.all(legPromises);

    const legs = [];
    let totalDistance = 0;
    let totalDuration = 0;
    let totalToll = 0;
    let totalFuel = 0;

    for (let i = 0; i < legRoutes.length; i++) {
      const r = legRoutes[i];
      if (!r) {
        return {
          error: true,
          message: `Không tìm được đường từ ${stops[i]} đến ${stops[i + 1]}.`,
          stops: resolvedStops,
          legs,
          totals: null,
        };
      }

      // Toll for this leg
      const tollKey = findTollRouteKey(stops[i], stops[i + 1]);
      let tollVnd = 0;
      if (tollKey && TOLL_ROUTES[tollKey]) {
        tollVnd = TOLL_ROUTES[tollKey].gates.reduce(
          (sum, g) => sum + Math.round(g.baseFee * multiplier),
          0,
        );
      } else if (multiplier > 0) {
        tollVnd = Math.round(r.distanceKm * DEFAULT_TOLL_RATE_PER_KM * multiplier);
      }

      const fuelVnd = Math.round((r.distanceKm / 100) * consumption * pricePerUnit);

      legs.push({
        from: resolvedStops[i].name,
        to: resolvedStops[i + 1].name,
        distance_km: r.distanceKm,
        duration_min: r.durationMin,
        toll_vnd: tollVnd,
        fuel_vnd: fuelVnd,
        path: simplifyPath(r.path),
      });

      totalDistance += r.distanceKm;
      totalDuration += r.durationMin;
      totalToll += tollVnd;
      totalFuel += fuelVnd;
    }

    return {
      stops: resolvedStops,
      legs,
      totals: {
        distance_km: Math.round(totalDistance * 10) / 10,
        duration_min: totalDuration,
        toll_vnd: totalToll,
        fuel_vnd: totalFuel,
        total_cost_vnd: totalToll + totalFuel,
      },
    };
  },
});
