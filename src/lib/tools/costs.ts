import { tool } from "ai";
import { z } from "zod";
import { TOLL_ROUTES, FUEL_PRICES, FUEL_PRICES_UPDATED, DEFAULT_TOLL_RATE_PER_KM } from "../toll-data";
import { VEHICLE_MULTIPLIER, DEFAULT_CONSUMPTION, findTollRouteKey } from "./helpers";

export const estimate_toll = tool({
  description:
    "Ước tính phí cầu đường VETC cho một tuyến đường. Dùng khi người dùng hỏi về phí đường bộ, phí cao tốc, hoặc chi phí VETC. Truyền distance_km nếu đã có từ plan_route.",
  inputSchema: z.object({
    from: z.string().describe("Điểm xuất phát"),
    to: z.string().describe("Điểm đến"),
    vehicle_type: z
      .enum(["car_under_12", "car_12_to_30", "truck", "motorbike"])
      .optional()
      .default("car_under_12")
      .describe("Loại phương tiện"),
    distance_km: z
      .number()
      .optional()
      .describe("Khoảng cách (km) từ plan_route, dùng cho ước tính khi không có dữ liệu chính xác"),
  }),
  execute: async ({ from, to, vehicle_type, distance_km }) => {
    const multiplier = VEHICLE_MULTIPLIER[vehicle_type ?? "car_under_12"];
    const key = findTollRouteKey(from, to);

    if (key && TOLL_ROUTES[key]) {
      const tollRoute = TOLL_ROUTES[key];
      const gates = tollRoute.gates.map((g) => ({
        name: g.name,
        fee: Math.round(g.baseFee * multiplier),
      }));
      const total = gates.reduce((sum, g) => sum + g.fee, 0);

      return {
        estimated: true,
        method: "exact" as const,
        route_name: tollRoute.name,
        toll_vnd: total,
        toll_stops: gates.length,
        gates,
        vehicle_type: vehicle_type ?? "car_under_12",
      };
    }

    // Per-km fallback when we have distance but no exact route data
    if (distance_km && distance_km > 0 && multiplier > 0) {
      const estimated = Math.round(distance_km * DEFAULT_TOLL_RATE_PER_KM * multiplier);
      return {
        estimated: true,
        method: "per_km_estimate" as const,
        route_name: `${from} → ${to}`,
        toll_vnd: estimated,
        toll_stops: 0,
        gates: [],
        vehicle_type: vehicle_type ?? "car_under_12",
        note: `Ước tính dựa trên ${DEFAULT_TOLL_RATE_PER_KM.toLocaleString("vi-VN")}đ/km. Phí thực tế có thể khác.`,
      };
    }

    return {
      estimated: false,
      method: "none" as const,
      message: `Chưa có dữ liệu phí cầu đường cho tuyến ${from} → ${to}. Thử cung cấp khoảng cách để ước tính.`,
      toll_vnd: 0,
      gates: [],
    };
  },
});

export const estimate_fuel = tool({
  description:
    "Ước tính chi phí nhiên liệu cho một quãng đường. Dùng khi người dùng hỏi về chi phí xăng, chi phí sạc điện cho chuyến đi.",
  inputSchema: z.object({
    distance_km: z.number().describe("Quãng đường (km)"),
    fuel_type: z
      .enum(["RON95", "RON92", "diesel", "electric"])
      .optional()
      .default("RON95")
      .describe("Loại nhiên liệu"),
    consumption_per_100km: z
      .number()
      .optional()
      .describe("Mức tiêu thụ trên 100km (lít hoặc kWh). Mặc định: xe ô tô phổ thông."),
  }),
  execute: async ({ distance_km, fuel_type, consumption_per_100km }) => {
    const ft = fuel_type ?? "RON95";
    const consumption =
      consumption_per_100km ?? DEFAULT_CONSUMPTION[ft];
    const pricePerUnit = FUEL_PRICES[ft];
    const totalUnits = (distance_km / 100) * consumption;
    const totalCost = Math.round(totalUnits * pricePerUnit);

    return {
      distance_km,
      fuel_type: ft,
      consumption_per_100km: consumption,
      total_units: Math.round(totalUnits * 10) / 10,
      unit: ft === "electric" ? "kWh" : "lít",
      price_per_unit: pricePerUnit,
      cost_vnd: totalCost,
      prices_as_of: FUEL_PRICES_UPDATED,
    };
  },
});

export const trip_summary = tool({
  description:
    "Tổng hợp chi phí chuyến đi: cầu đường + nhiên liệu + đỗ xe. Gọi SAU KHI đã có kết quả từ plan_route, estimate_toll, estimate_fuel.",
  inputSchema: z.object({
    from: z.string().describe("Điểm xuất phát"),
    to: z.string().describe("Điểm đến"),
    distance_km: z.number().describe("Khoảng cách (km)"),
    duration_min: z.number().describe("Thời gian (phút)"),
    toll_vnd: z.number().describe("Phí cầu đường (VND)"),
    fuel_vnd: z.number().describe("Chi phí nhiên liệu (VND)"),
    fuel_type: z.string().optional().describe("Loại nhiên liệu"),
    parking_vnd: z.number().optional().default(0).describe("Chi phí đỗ xe ước tính (VND)"),
    notes: z.array(z.string()).optional().describe("Ghi chú thêm"),
  }),
  execute: async ({ from, to, distance_km, duration_min, toll_vnd, fuel_vnd, fuel_type, parking_vnd, notes }) => {
    const breakdown: { label: string; amount_vnd: number }[] = [];

    if (toll_vnd > 0) breakdown.push({ label: "Phí cầu đường", amount_vnd: toll_vnd });
    if (fuel_vnd > 0) breakdown.push({ label: `Nhiên liệu${fuel_type ? ` (${fuel_type})` : ""}`, amount_vnd: fuel_vnd });
    if ((parking_vnd ?? 0) > 0) breakdown.push({ label: "Đỗ xe", amount_vnd: parking_vnd ?? 0 });

    const total = breakdown.reduce((sum, b) => sum + b.amount_vnd, 0);

    // Driving tip based on time
    const hours = Math.floor(duration_min / 60);
    const tip = hours >= 4
      ? `Chuyến đi ${hours} tiếng — nên nghỉ giữa đường mỗi 2 tiếng.`
      : hours >= 2
        ? `Chuyến đi khoảng ${hours} tiếng — nhớ mang nước uống.`
        : "Chuyến đi ngắn — chúc bạn lái xe vui vẻ!";

    return {
      from,
      to,
      distance_km,
      duration_min,
      breakdown,
      total_vnd: total,
      tip,
      notes: notes ?? [],
    };
  },
});
