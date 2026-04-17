import { tool } from "ai";
import { z } from "zod";
import { geocode, route, searchPOI, findRestStopsAlongRoute, buildAddress, searchPlaces } from "../geo";
import { haversineKm, buildMeta } from "./helpers";

function guessCategory(item: { class?: string; type?: string }): string {
  if (item.class === "amenity") {
    if (item.type === "cafe") return "cafe";
    if (item.type === "restaurant" || item.type === "fast_food") return "eat";
    if (item.type === "fuel") return "fuel";
    if (item.type === "charging_station") return "charge";
    if (item.type === "parking" || item.type === "motorcycle_parking") return "parking";
  }
  if (item.class === "tourism") return "hotel";
  if (item.class === "shop" && item.type === "coffee") return "cafe";
  return "eat";
}

export const search_places = tool({
  description:
    "Tìm kiếm địa điểm theo danh mục (ăn uống, cafe, xăng, sạc xe điện, đỗ xe, khách sạn) gần một vị trí. Dùng khi người dùng muốn tìm quán ăn, trạm xăng, trạm sạc, bãi đỗ xe, v.v.",
  inputSchema: z.object({
    category: z
      .enum(["eat", "cafe", "fuel", "charge", "parking", "hotel", "rest_stop"])
      .describe("Loại địa điểm cần tìm"),
    near: z
      .string()
      .optional()
      .describe("Tên địa điểm hoặc khu vực cần tìm gần đó, ví dụ: 'Quận 1', 'Landmark 81'"),
    lat: z.number().optional().describe("Vĩ độ trung tâm tìm kiếm"),
    lng: z.number().optional().describe("Kinh độ trung tâm tìm kiếm"),
    radius_km: z
      .number()
      .optional()
      .default(3)
      .describe("Bán kính tìm kiếm (km), mặc định 3km"),
  }),
  execute: async ({ category, near, lat, lng, radius_km }) => {
    let center = { lat: lat ?? 10.7769, lng: lng ?? 106.7009 };

    if (near) {
      const geo = await geocode(near);
      if (geo) {
        center = { lat: geo.lat, lng: geo.lng };
      } else {
        return {
          places: [],
          center,
          error: true,
          message: `Không tìm thấy địa điểm "${near}" trên bản đồ. Bạn có thể mô tả cụ thể hơn không?`,
        };
      }
    }

    const results = await searchPOI(category, center, (radius_km ?? 3) * 1000);

    if (results.length === 0) {
      return {
        places: [],
        center,
        message: `Không tìm thấy ${category} gần khu vực này. Thử tăng bán kính hoặc khu vực khác.`,
      };
    }

    return {
      places: results.slice(0, 8).map((p) => ({
        id: p.id,
        name: p.name,
        address: buildAddress(p.tags),
        coord: [p.lng, p.lat] as [number, number],
        category,
        meta: buildMeta(category, p.tags),
        distance_km: Math.round(haversineKm(center.lat, center.lng, p.lat, p.lng) * 10) / 10,
      })),
      center,
    };
  },
});

export const get_nearby = tool({
  description:
    "Tìm dịch vụ gần một tọa độ cụ thể (bãi đỗ xe, trạm sạc, trạm xăng). Dùng cho câu hỏi tiếp theo như 'tìm bãi đỗ xe gần quán đó'.",
  inputSchema: z.object({
    lat: z.number().describe("Vĩ độ"),
    lng: z.number().describe("Kinh độ"),
    service_type: z
      .enum(["parking", "charge", "fuel", "eat", "cafe", "rest_stop"])
      .describe("Loại dịch vụ cần tìm"),
    radius_km: z.number().optional().default(2).describe("Bán kính (km)"),
  }),
  execute: async ({ lat, lng, service_type, radius_km }) => {
    const results = await searchPOI(
      service_type,
      { lat, lng },
      (radius_km ?? 2) * 1000,
    );

    return {
      places: results.slice(0, 5).map((p) => ({
        id: p.id,
        name: p.name,
        address: buildAddress(p.tags),
        coord: [p.lng, p.lat] as [number, number],
        category: service_type,
        meta: buildMeta(service_type, p.tags),
        distance_km: Math.round(haversineKm(lat, lng, p.lat, p.lng) * 10) / 10,
      })),
      center: { lat, lng },
    };
  },
});

export const search_along_route = tool({
  description:
    "Tìm điểm dừng chân dọc theo tuyến đường: quán ăn, trạm xăng, cafe, trạm dừng nghỉ. Tự động chia tuyến đường thành các điểm nghỉ hợp lý (~150km/điểm) và tìm dịch vụ gần mỗi điểm. Dùng khi người dùng muốn lên kế hoạch nghỉ ngơi, ăn uống, đổ xăng trên đường đi dài. Chọn rest_stop để tìm tổng hợp (ăn + xăng + cafe).",
  inputSchema: z.object({
    from: z.string().describe("Điểm xuất phát"),
    to: z.string().describe("Điểm đến"),
    category: z
      .enum(["eat", "cafe", "fuel", "charge", "parking", "hotel", "rest_stop"])
      .describe("Loại địa điểm. 'rest_stop' = tổng hợp (ăn uống + xăng + cafe)"),
    radius_km: z
      .number()
      .optional()
      .default(5)
      .describe("Bán kính tìm kiếm từ điểm dừng (km), mặc định 5km"),
  }),
  execute: async ({ from, to, category, radius_km }) => {
    const [fromGeo, toGeo] = await Promise.all([geocode(from), geocode(to)]);
    if (!fromGeo || !toGeo) {
      return {
        error: true,
        message: `Không tìm thấy ${!fromGeo ? from : to} trên bản đồ.`,
        rest_stops: [],
      };
    }

    const r = await route(
      { lat: fromGeo.lat, lng: fromGeo.lng },
      { lat: toGeo.lat, lng: toGeo.lng },
    );
    if (!r) {
      return {
        error: true,
        message: "Không tìm được tuyến đường.",
        rest_stops: [],
      };
    }

    const stops = await findRestStopsAlongRoute(
      r.path,
      r.distanceKm,
      category,
      (radius_km ?? 5) * 1000,
    );

    const fromName = fromGeo.displayName.split(",").slice(0, 2).join(",").trim();
    const toName = toGeo.displayName.split(",").slice(0, 2).join(",").trim();

    if (stops.length === 0) {
      return {
        from: { name: fromName, lat: fromGeo.lat, lng: fromGeo.lng },
        to: { name: toName, lat: toGeo.lat, lng: toGeo.lng },
        route_distance_km: r.distanceKm,
        route_duration_min: r.durationMin,
        rest_stops: [],
        message: `Không tìm thấy dịch vụ dọc đường ${from} → ${to}. Thử tăng bán kính.`,
      };
    }

    return {
      from: { name: fromName, lat: fromGeo.lat, lng: fromGeo.lng },
      to: { name: toName, lat: toGeo.lat, lng: toGeo.lng },
      route_distance_km: r.distanceKm,
      route_duration_min: r.durationMin,
      rest_stops: stops.map((s) => ({
        km_marker: s.km_marker,
        area_name: s.area_name,
        coord: [s.lng, s.lat] as [number, number],
        places: s.places.map((p) => ({
          id: p.id,
          name: p.name,
          address: buildAddress(p.tags),
          coord: [p.lng, p.lat] as [number, number],
          category: p.category,
          meta: buildMeta(p.category, p.tags),
        })),
      })),
    };
  },
});

export const search_by_name = tool({
  description:
    "Tìm kiếm địa điểm theo tên hoặc địa chỉ cụ thể. Dùng khi người dùng hỏi về một quán/cửa hàng cụ thể (ví dụ 'Highland Coffee Nguyễn Huệ', 'Vinfast Charging Quận 7') hoặc tìm theo địa chỉ (ví dụ '123 Nguyễn Trãi Quận 1').",
  inputSchema: z.object({
    query: z.string().describe("Tên địa điểm hoặc địa chỉ cần tìm"),
    lat: z.number().optional().describe("Vĩ độ để ưu tiên kết quả gần đây"),
    lng: z.number().optional().describe("Kinh độ để ưu tiên kết quả gần đây"),
  }),
  execute: async ({ query, lat, lng }) => {
    const bias = lat && lng ? { lat, lng } : undefined;
    const results = await searchPlaces(query, bias);

    if (results.length === 0) {
      return {
        places: [],
        message: `Không tìm thấy "${query}". Thử tên khác hoặc thêm tên quận/thành phố.`,
      };
    }

    return {
      places: results.map((item) => ({
        id: item.place_id,
        name: item.displayName.split(",")[0],
        address: item.displayName.split(",").slice(1).join(",").trim(),
        coord: [item.lng, item.lat] as [number, number],
        category: guessCategory(item),
        meta: item.type?.replace(/_/g, " ") ?? "",
        distance_km:
          lat && lng
            ? Math.round(haversineKm(lat, lng, item.lat, item.lng) * 10) / 10
            : undefined,
      })),
      center: bias,
    };
  },
});
