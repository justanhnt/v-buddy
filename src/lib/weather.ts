import { geocode } from "./geo";

export type WeatherData = {
  location: string;
  current: {
    temp_c: number;
    description: string;
    humidity_percent: number;
    wind_kph: number;
    icon: string;
  };
  forecast_today: {
    high_c: number;
    low_c: number;
    rain_chance_percent: number;
    description: string;
  };
  driving_advisory: string;
};

// WMO weather codes → Vietnamese description + icon
const WMO_CODES: Record<number, { desc: string; icon: string }> = {
  0: { desc: "Trời quang", icon: "sun" },
  1: { desc: "Ít mây", icon: "sun" },
  2: { desc: "Mây rải rác", icon: "cloud-sun" },
  3: { desc: "Nhiều mây", icon: "cloud" },
  45: { desc: "Sương mù", icon: "fog" },
  48: { desc: "Sương mù đóng băng", icon: "fog" },
  51: { desc: "Mưa phùn nhẹ", icon: "drizzle" },
  53: { desc: "Mưa phùn", icon: "drizzle" },
  55: { desc: "Mưa phùn dày", icon: "drizzle" },
  61: { desc: "Mưa nhẹ", icon: "rain" },
  63: { desc: "Mưa vừa", icon: "rain" },
  65: { desc: "Mưa to", icon: "rain-heavy" },
  80: { desc: "Mưa rào nhẹ", icon: "rain" },
  81: { desc: "Mưa rào", icon: "rain" },
  82: { desc: "Mưa rào lớn", icon: "rain-heavy" },
  95: { desc: "Giông bão", icon: "storm" },
  96: { desc: "Giông kèm mưa đá", icon: "storm" },
  99: { desc: "Giông kèm mưa đá lớn", icon: "storm" },
};

function drivingAdvisory(code: number, wind: number): string {
  if (code >= 95) return "Giông bão — cân nhắc hoãn chuyến đi hoặc tìm nơi trú.";
  if (code >= 63) return "Mưa to, đường trơn trượt — lái chậm, bật đèn sương mù.";
  if (code >= 51) return "Mưa nhẹ — cẩn thận đường trơn, giữ khoảng cách.";
  if (code === 45 || code === 48) return "Sương mù — tầm nhìn hạn chế, bật đèn sương mù.";
  if (wind > 40) return "Gió mạnh — cẩn thận khi đi qua cầu hoặc đoạn đường trống.";
  return "Thời tiết thuận lợi cho lái xe.";
}

export async function getWeather(
  location: string,
  lat?: number,
  lng?: number,
): Promise<WeatherData | null> {
  try {
    let finalLat = lat;
    let finalLng = lng;

    if (finalLat == null || finalLng == null) {
      const geo = await geocode(location);
      if (!geo) return null;
      finalLat = geo.lat;
      finalLng = geo.lng;
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(finalLat));
    url.searchParams.set("longitude", String(finalLng));
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m");
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code");
    url.searchParams.set("timezone", "Asia/Ho_Chi_Minh");
    url.searchParams.set("forecast_days", "1");

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();

    const currentCode = data.current?.weather_code ?? 0;
    const dailyCode = data.daily?.weather_code?.[0] ?? currentCode;
    const wind = data.current?.wind_speed_10m ?? 0;

    const currentWeather = WMO_CODES[currentCode] ?? WMO_CODES[0]!;
    const dailyWeather = WMO_CODES[dailyCode] ?? WMO_CODES[0]!;

    return {
      location,
      current: {
        temp_c: Math.round(data.current?.temperature_2m ?? 0),
        description: currentWeather.desc,
        humidity_percent: Math.round(data.current?.relative_humidity_2m ?? 0),
        wind_kph: Math.round(wind),
        icon: currentWeather.icon,
      },
      forecast_today: {
        high_c: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
        low_c: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0),
        rain_chance_percent: data.daily?.precipitation_probability_max?.[0] ?? 0,
        description: dailyWeather.desc,
      },
      driving_advisory: drivingAdvisory(currentCode, wind),
    };
  } catch {
    return null;
  }
}

// --- Hourly weather for a specific date + hour ---

export type HourlyWeatherPoint = {
  temp_c: number;
  description: string;
  icon: string;
  rain_chance_percent: number;
  wind_kph: number;
  driving_advisory: string;
};

/**
 * Fetch weather for a specific coordinate at a specific date and hour.
 * Uses Open-Meteo hourly forecast (up to 16 days ahead).
 */
export async function getWeatherAtTime(
  lat: number,
  lng: number,
  date: string, // YYYY-MM-DD
  hour: number, // 0-23
): Promise<HourlyWeatherPoint | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set(
      "hourly",
      "temperature_2m,precipitation_probability,weather_code,wind_speed_10m",
    );
    url.searchParams.set("start_date", date);
    url.searchParams.set("end_date", date);
    url.searchParams.set("timezone", "Asia/Ho_Chi_Minh");

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();

    const idx = Math.min(Math.max(hour, 0), 23);
    const code: number = data.hourly?.weather_code?.[idx] ?? 0;
    const weather = WMO_CODES[code] ?? WMO_CODES[0]!;
    const wind: number = data.hourly?.wind_speed_10m?.[idx] ?? 0;

    return {
      temp_c: Math.round(data.hourly?.temperature_2m?.[idx] ?? 0),
      description: weather.desc,
      icon: weather.icon,
      rain_chance_percent: data.hourly?.precipitation_probability?.[idx] ?? 0,
      wind_kph: Math.round(wind),
      driving_advisory: drivingAdvisory(code, wind),
    };
  } catch {
    return null;
  }
}

/** Advance a date string by minutes, returning the new date + hour. */
export function advanceTime(
  dateStr: string,
  startHour: number,
  addMinutes: number,
): { date: string; hour: number; display: string } {
  const totalMin = startHour * 60 + addMinutes;
  const dayOffset = Math.floor(totalMin / 1440);
  const remainingMin = totalMin % 1440;
  const hour = Math.floor(remainingMin / 60);

  const parts = dateStr.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const resultDate = `${y}-${m}-${dd}`;

  const hh = String(hour).padStart(2, "0");
  const mm = String(Math.round(remainingMin % 60)).padStart(2, "0");
  const display = `${hh}:${mm} ${dd}/${m}`;

  return { date: resultDate, hour, display };
}
