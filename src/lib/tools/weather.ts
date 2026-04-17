import { tool } from "ai";
import { z } from "zod";
import { geocode, route, simplifyPath, nearestCityName, computeCumulativeDistances } from "../geo";
import { getWeather, getWeatherAtTime, advanceTime } from "../weather";

export const get_weather = tool({
  description:
    "Xem thời tiết tại điểm đến hoặc dọc đường. Dùng khi người dùng hỏi thời tiết, mưa, nắng cho chuyến đi.",
  inputSchema: z.object({
    location: z.string().describe("Tên địa điểm cần xem thời tiết"),
    lat: z.number().optional().describe("Vĩ độ (nếu đã biết)"),
    lng: z.number().optional().describe("Kinh độ (nếu đã biết)"),
  }),
  execute: async ({ location, lat, lng }) => {
    const data = await getWeather(location, lat, lng);
    if (!data) {
      return {
        error: true,
        message: `Không lấy được thời tiết cho "${location}". Kiểm tra lại tên địa điểm.`,
      };
    }
    return data;
  },
});

export const weather_along_route = tool({
  description:
    "Xem dự báo thời tiết DỌC THEO tuyến đường vào ngày cụ thể. Hiển thị thời tiết tại từng khu vực khi xe dự kiến đi qua. Dùng khi người dùng hỏi thời tiết cho chuyến đi dài, ví dụ: 'thời tiết dọc đường đi Đà Lạt ngày mai', 'trời có mưa không nếu đi HCM-Hà Nội thứ 7'.",
  inputSchema: z.object({
    from: z.string().describe("Điểm xuất phát"),
    to: z.string().describe("Điểm đến"),
    date: z
      .string()
      .describe("Ngày đi, định dạng YYYY-MM-DD. Chuyển đổi ngày tương đối sang tuyệt đối dựa trên ngày hôm nay."),
    departure_hour: z
      .number()
      .optional()
      .default(7)
      .describe("Giờ xuất phát (0-23), mặc định 7 (7:00 sáng)"),
  }),
  execute: async ({ from, to, date, departure_hour }) => {
    const [fromGeo, toGeo] = await Promise.all([geocode(from), geocode(to)]);
    if (!fromGeo || !toGeo) {
      return {
        error: true,
        message: `Không tìm thấy ${!fromGeo ? from : to} trên bản đồ.`,
        points: [],
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
        points: [],
      };
    }

    // Sample points along the route (~200km intervals, max 8 points including start & end)
    const sampledPath = simplifyPath(r.path, 100);
    const cumDist = computeCumulativeDistances(sampledPath);

    const numMidpoints = Math.max(0, Math.min(6, Math.round(r.distanceKm / 200) - 1));
    const totalPoints = numMidpoints + 2; // +start +end
    const interval = r.distanceKm / (totalPoints - 1 || 1);

    const sampleTargets: number[] = [];
    for (let i = 0; i < totalPoints; i++) {
      sampleTargets.push(Math.round(interval * i));
    }

    const samplePoints: { km: number; lat: number; lng: number; name: string }[] = [];
    for (const targetKm of sampleTargets) {
      let bestIdx = 0;
      let bestDiff = Infinity;
      for (let j = 0; j < cumDist.length; j++) {
        const diff = Math.abs(cumDist[j] - targetKm);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = j;
        }
      }
      const lat = sampledPath[bestIdx][1];
      const lng = sampledPath[bestIdx][0];
      samplePoints.push({
        km: targetKm,
        lat,
        lng,
        name: nearestCityName(lat, lng),
      });
    }

    // Fix first/last names
    const fromName = fromGeo.displayName.split(",").slice(0, 2).join(",").trim();
    const toName = toGeo.displayName.split(",").slice(0, 2).join(",").trim();
    if (samplePoints.length > 0) samplePoints[0].name = fromName.split(",")[0];
    if (samplePoints.length > 1) samplePoints[samplePoints.length - 1].name = toName.split(",")[0];

    // Compute estimated arrival time & fetch weather in parallel
    const depHour = departure_hour ?? 7;
    const weatherPromises = samplePoints.map((sp) => {
      const arrivalMin = Math.round((sp.km / r.distanceKm) * r.durationMin);
      const { date: pointDate, hour: pointHour, display } = advanceTime(date, depHour, arrivalMin);
      return getWeatherAtTime(sp.lat, sp.lng, pointDate, pointHour).then((w) => ({
        km: sp.km,
        area_name: sp.name,
        estimated_time: display,
        ...(w ?? {
          temp_c: 0,
          description: "Không có dữ liệu",
          icon: "cloud",
          rain_chance_percent: 0,
          wind_kph: 0,
          driving_advisory: "",
        }),
      }));
    });

    const points = await Promise.all(weatherPromises);

    // Build overall advisory from worst condition
    const worstRain = points.reduce((max, p) => Math.max(max, p.rain_chance_percent), 0);
    const stormPoints = points.filter((p) => p.icon === "storm" || p.icon === "rain-heavy");
    const rainPoints = points.filter((p) => p.rain_chance_percent >= 50);

    let overall_advisory = "Thời tiết thuận lợi cho toàn tuyến đường.";
    if (stormPoints.length > 0) {
      const names = stormPoints.map((p) => p.area_name).join(", ");
      overall_advisory = `Giông bão tại ${names} — cân nhắc hoãn hoặc đổi lịch trình.`;
    } else if (rainPoints.length > 0) {
      const names = rainPoints.map((p) => p.area_name).join(", ");
      overall_advisory = `Mưa tại ${names} (${worstRain}% khả năng) — chuẩn bị áo mưa, lái chậm.`;
    }

    return {
      from: fromName,
      to: toName,
      date,
      departure_hour: depHour,
      route_distance_km: r.distanceKm,
      route_duration_min: r.durationMin,
      points,
      overall_advisory,
    };
  },
});
