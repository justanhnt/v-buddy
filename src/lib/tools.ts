import { tool, generateText } from "ai";
import { z } from "zod";
import { geocode, route, searchPOI, findRestStopsAlongRoute, buildOsrmCoords, simplifyPath, buildAddress, nearestCityName, computeCumulativeDistances } from "./geo";
import { TOLL_ROUTES, FUEL_PRICES, FUEL_PRICES_UPDATED, DEFAULT_TOLL_RATE_PER_KM, CITY_ALIASES } from "./toll-data";
import { getWeather, getWeatherAtTime, advanceTime } from "./weather";
import { checkWallet } from "./wallet-mock";
import { visionModel } from "./dashscope";

export const tools = {
  search_places: tool({
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
  }),

  plan_route: tool({
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
  }),

  estimate_toll: tool({
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
  }),

  estimate_fuel: tool({
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
  }),

  get_nearby: tool({
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
  }),

  // --- B1: Trip Summary ---

  trip_summary: tool({
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
  }),

  // --- B2: Analyze Image ---

  analyze_image: tool({
    description:
      "Phân tích ảnh: biên lai thu phí, biển số xe, biển báo giao thông, hoặc bất kỳ ảnh liên quan đến lái xe. Dùng khi người dùng gửi ảnh trong chat.",
    inputSchema: z.object({
      image_url: z.string().describe("URL hoặc base64 data URI của ảnh"),
      context: z.string().optional().describe("Ngữ cảnh bổ sung từ cuộc hội thoại"),
    }),
    execute: async ({ image_url, context }) => {
      const prompt = context
        ? `Ngữ cảnh: ${context}\n\nPhân tích ảnh này. Nếu là biên lai thu phí đường bộ, trích xuất: tên trạm, số tiền, biển số xe, thời gian. Nếu là biển số xe, đọc số. Nếu là biển báo, mô tả ý nghĩa. Trả lời bằng tiếng Việt.`
        : "Phân tích ảnh này. Nếu là biên lai thu phí đường bộ, trích xuất: tên trạm, số tiền, biển số xe, thời gian. Nếu là biển số xe, đọc số. Nếu là biển báo, mô tả ý nghĩa. Trả lời bằng tiếng Việt.";

      try {
        const result = await generateText({
          model: visionModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image", image: image_url },
              ],
            },
          ],
        });

        // Try to detect the type of image from the response
        const text = result.text;
        let type: "toll_receipt" | "license_plate" | "road_sign" | "general" = "general";
        if (/trạm|thu phí|biên lai|toll/i.test(text)) type = "toll_receipt";
        else if (/biển số|license|plate/i.test(text)) type = "license_plate";
        else if (/biển báo|sign|cấm|tốc độ/i.test(text)) type = "road_sign";

        return { type, analysis: text };
      } catch {
        return {
          type: "general" as const,
          analysis: "Không thể phân tích ảnh lúc này. Vui lòng thử lại.",
          error: true,
        };
      }
    },
  }),

  // --- B3: Check Wallet ---

  check_wallet: tool({
    description:
      "Kiểm tra số dư ví VETC. Dùng khi người dùng hỏi số dư ví, hoặc sau khi tính tổng chi phí chuyến đi để xem có đủ tiền không.",
    inputSchema: z.object({
      purpose: z
        .enum(["balance_check", "trip_affordability"])
        .optional()
        .default("balance_check")
        .describe("Mục đích kiểm tra"),
      trip_cost_vnd: z
        .number()
        .optional()
        .describe("Tổng chi phí chuyến đi (VND) để so sánh với số dư"),
    }),
    execute: async ({ trip_cost_vnd }) => {
      return checkWallet(trip_cost_vnd);
    },
  }),

  // --- B4: Compare Routes ---

  compare_routes: tool({
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
  }),

  // --- B5: Weather ---

  get_weather: tool({
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
  }),

  // --- Weather Along Route ---

  weather_along_route: tool({
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
  }),

  // --- B6: Multi-Stop Trip ---

  multi_stop_trip: tool({
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
  }),

  // --- Search along route (rest-stop planner) ---

  search_along_route: tool({
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
  }),

  // --- B9: Web Search ---

  web_search: tool({
    description:
      "Tìm kiếm thông tin trên web. Dùng khi các tool khác không đủ trả lời, ví dụ: tin tức giao thông, giá vé, luật mới, sự kiện, thông tin du lịch, hoặc bất kỳ câu hỏi nào ngoài khả năng của các tool hiện có.",
    inputSchema: z.object({
      query: z.string().describe("Từ khóa tìm kiếm, nên thêm 'Việt Nam' nếu liên quan đến VN"),
      lang: z.enum(["vi", "en"]).optional().default("vi").describe("Ngôn ngữ kết quả"),
    }),
    execute: async ({ query, lang }) => {
      try {
        // DuckDuckGo instant answer API (free, no key)
        const url = new URL("https://api.duckduckgo.com/");
        url.searchParams.set("q", query);
        url.searchParams.set("format", "json");
        url.searchParams.set("no_html", "1");
        url.searchParams.set("skip_disambig", "1");
        url.searchParams.set("kl", lang === "vi" ? "vn-vi" : "us-en");

        const res = await fetch(url, {
          headers: { "User-Agent": "VETCBuddy/1.0 (vetc-buddy hackathon)" },
          signal: AbortSignal.timeout(8_000),
        });
        const data = await res.json();

        const results: { title: string; snippet: string; url: string }[] = [];

        // Abstract (Wikipedia-style summary)
        if (data.AbstractText) {
          results.push({
            title: data.Heading ?? query,
            snippet: data.AbstractText,
            url: data.AbstractURL ?? "",
          });
        }

        // Answer (direct factual answer)
        if (data.Answer) {
          results.push({
            title: "Trả lời nhanh",
            snippet: String(data.Answer),
            url: "",
          });
        }

        // Related topics
        if (Array.isArray(data.RelatedTopics)) {
          for (const topic of data.RelatedTopics.slice(0, 5)) {
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.split(" - ")[0] ?? topic.Text,
                snippet: topic.Text,
                url: topic.FirstURL,
              });
            }
            // Handle subtopics
            if (Array.isArray(topic.Topics)) {
              for (const sub of topic.Topics.slice(0, 2)) {
                if (sub.Text && sub.FirstURL) {
                  results.push({
                    title: sub.Text.split(" - ")[0] ?? sub.Text,
                    snippet: sub.Text,
                    url: sub.FirstURL,
                  });
                }
              }
            }
          }
        }

        if (results.length === 0) {
          return {
            query,
            results: [],
            message: `Không tìm thấy kết quả cho "${query}". Thử dùng từ khóa khác.`,
          };
        }

        return {
          query,
          results: results.slice(0, 6),
        };
      } catch {
        return {
          query,
          results: [],
          error: true,
          message: "Không thể tìm kiếm lúc này. Vui lòng thử lại.",
        };
      }
    },
  }),
};

// --- Helpers ---

const VEHICLE_MULTIPLIER: Record<string, number> = {
  car_under_12: 1,
  car_12_to_30: 1.5,
  truck: 2.5,
  motorbike: 0, // motorbikes don't pay expressway tolls in Vietnam
};

const DEFAULT_CONSUMPTION: Record<string, number> = {
  RON95: 8, // 8L/100km for average car
  RON92: 8,
  diesel: 7,
  electric: 18, // 18kWh/100km for average EV
};

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
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

function buildMeta(category: string, tags: Record<string, string>): string {
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

function findTollRouteKey(from: string, to: string): string | null {
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
