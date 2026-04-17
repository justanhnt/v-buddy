import { tool } from "ai";
import { z } from "zod";
import { TOLL_ROUTES, FUEL_PRICES, FUEL_PRICES_UPDATED, DEFAULT_TOLL_RATE_PER_KM } from "../toll-data";
import { VEHICLE_MULTIPLIER, DEFAULT_CONSUMPTION, findTollRouteKey } from "./helpers";

type TollResult =
  | {
      estimated: true;
      method: "exact";
      route_name: string;
      toll_vnd: number;
      toll_stops: number;
      gates: { name: string; fee: number }[];
      vehicle_type: string;
    }
  | {
      estimated: true;
      method: "per_km_estimate";
      route_name: string;
      toll_vnd: number;
      toll_stops: 0;
      gates: [];
      vehicle_type: string;
      note: string;
    }
  | {
      estimated: false;
      method: "none";
      message: string;
      toll_vnd: 0;
      gates: [];
    };

function computeToll(
  from: string,
  to: string,
  vehicleType: keyof typeof VEHICLE_MULTIPLIER,
  distanceKm?: number,
): TollResult {
  const multiplier = VEHICLE_MULTIPLIER[vehicleType];
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
      method: "exact",
      route_name: tollRoute.name,
      toll_vnd: total,
      toll_stops: gates.length,
      gates,
      vehicle_type: vehicleType,
    };
  }

  if (distanceKm && distanceKm > 0 && multiplier > 0) {
    const estimated = Math.round(distanceKm * DEFAULT_TOLL_RATE_PER_KM * multiplier);
    return {
      estimated: true,
      method: "per_km_estimate",
      route_name: `${from} → ${to}`,
      toll_vnd: estimated,
      toll_stops: 0,
      gates: [],
      vehicle_type: vehicleType,
      note: `Ước tính dựa trên ${DEFAULT_TOLL_RATE_PER_KM.toLocaleString("vi-VN")}đ/km. Phí thực tế có thể khác.`,
    };
  }

  return {
    estimated: false,
    method: "none",
    message: `Chưa có dữ liệu phí cầu đường cho tuyến ${from} → ${to}. Thử cung cấp khoảng cách để ước tính.`,
    toll_vnd: 0,
    gates: [],
  };
}

function computeFuel(
  distanceKm: number,
  fuelType: keyof typeof FUEL_PRICES,
  consumptionPer100km?: number,
) {
  const consumption = consumptionPer100km ?? DEFAULT_CONSUMPTION[fuelType];
  const pricePerUnit = FUEL_PRICES[fuelType];
  const totalUnits = (distanceKm / 100) * consumption;
  const totalCost = Math.round(totalUnits * pricePerUnit);
  return {
    distance_km: distanceKm,
    fuel_type: fuelType,
    consumption_per_100km: consumption,
    total_units: Math.round(totalUnits * 10) / 10,
    unit: fuelType === "electric" ? "kWh" : "lít",
    price_per_unit: pricePerUnit,
    cost_vnd: totalCost,
    prices_as_of: FUEL_PRICES_UPDATED,
  };
}

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
    return computeToll(from, to, vehicle_type ?? "car_under_12", distance_km);
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
    return computeFuel(distance_km, fuel_type ?? "RON95", consumption_per_100km);
  },
});

export const trip_summary = tool({
  description:
    "Tổng hợp chi phí chuyến đi: cầu đường + nhiên liệu + đỗ xe. Gọi SAU KHI đã có kết quả từ plan_route. Tool này TỰ ĐỘNG tính toll và fuel bằng cùng logic như estimate_toll/estimate_fuel, đảm bảo các số liệu khớp nhau — KHÔNG truyền toll_vnd/fuel_vnd.",
  inputSchema: z.object({
    from: z.string().describe("Điểm xuất phát"),
    to: z.string().describe("Điểm đến"),
    distance_km: z.number().describe("Khoảng cách (km) từ plan_route"),
    duration_min: z.number().describe("Thời gian (phút) từ plan_route"),
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
    consumption_per_100km: z
      .number()
      .optional()
      .describe("Mức tiêu thụ trên 100km (lít hoặc kWh)"),
    parking_vnd: z.number().optional().default(0).describe("Chi phí đỗ xe ước tính (VND)"),
    notes: z.array(z.string()).optional().describe("Ghi chú thêm"),
  }),
  execute: async ({ from, to, distance_km, duration_min, vehicle_type, fuel_type, consumption_per_100km, parking_vnd, notes }) => {
    const vt = vehicle_type ?? "car_under_12";
    const ft = fuel_type ?? "RON95";
    const toll = computeToll(from, to, vt, distance_km);
    const fuel = computeFuel(distance_km, ft, consumption_per_100km);

    const tollVnd = toll.toll_vnd;
    const fuelVnd = fuel.cost_vnd;

    const breakdown: { label: string; amount_vnd: number }[] = [];
    if (tollVnd > 0) breakdown.push({ label: "Phí cầu đường", amount_vnd: tollVnd });
    if (fuelVnd > 0) breakdown.push({ label: `Nhiên liệu (${ft})`, amount_vnd: fuelVnd });
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
