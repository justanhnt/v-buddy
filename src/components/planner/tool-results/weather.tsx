import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Sun,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const WEATHER_ICON: Record<string, typeof Sun> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  "rain-heavy": CloudRain,
  storm: CloudLightning,
};

export function GetWeatherResult({
  output,
}: {
  output: Record<string, unknown>;
}) {
  const current = output.current as Record<string, unknown>;
  const forecast = output.forecast_today as Record<string, unknown>;
  const WIcon = WEATHER_ICON[current.icon as string] ?? CloudSun;
  return (
    <Card className="p-3 bg-gradient-to-br from-[color-mix(in_oklch,var(--cat-fuel)_12%,var(--card))] to-[color-mix(in_oklch,var(--primary)_10%,var(--card))]">
      <p className="text-xs font-medium uppercase tracking-wide text-info">
        Thời tiết · {output.location as string}
      </p>
      <div className="mt-1.5 flex items-center gap-3">
        <WIcon className="h-7 w-7 text-info" aria-hidden />
        <div>
          <p className="text-lg font-bold">{current.temp_c as number}°C</p>
          <p className="text-xs text-foreground/80">
            {current.description as string}
          </p>
        </div>
        <div className="ml-auto text-right text-xs text-muted-foreground">
          <p>
            H: {forecast?.high_c as number}° L: {forecast?.low_c as number}°
          </p>
          <p>Mưa: {forecast?.rain_chance_percent as number}%</p>
        </div>
      </div>
      <p className="mt-1.5 text-xs font-medium text-info">
        {output.driving_advisory as string}
      </p>
    </Card>
  );
}

export function WeatherAlongRouteResult({
  output,
}: {
  output: Record<string, unknown>;
}) {
  const points = output.points as {
    km: number;
    area_name: string;
    estimated_time: string;
    temp_c: number;
    description: string;
    icon: string;
    rain_chance_percent: number;
    wind_kph: number;
    driving_advisory: string;
  }[];

  return (
    <Card className="p-3 bg-gradient-to-br from-[color-mix(in_oklch,var(--cat-fuel)_8%,var(--card))] to-[color-mix(in_oklch,var(--primary)_6%,var(--card))]">
      <div className="flex items-center gap-1.5">
        <CloudSun className="h-4 w-4 text-info" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide text-info">
          Thời tiết dọc đường · {output.from as string} →{" "}
          {output.to as string}
        </p>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {output.date as string} · Khởi hành{" "}
        {String(output.departure_hour as number).padStart(2, "0")}:00 ·{" "}
        {output.route_distance_km as number} km
      </p>

      <div className="mt-3 space-y-0">
        {points.map((pt, i) => {
          const WIcon = WEATHER_ICON[pt.icon] ?? CloudSun;
          const isWarning =
            pt.rain_chance_percent >= 50 ||
            pt.icon === "storm" ||
            pt.icon === "rain-heavy";
          return (
            <div key={i} className="flex gap-2.5">
              {/* Timeline */}
              <div className="flex flex-col items-center pt-0.5">
                <WIcon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isWarning ? "text-warning" : "text-info",
                  )}
                  aria-hidden
                />
                {i < points.length - 1 && (
                  <div className="w-px flex-1 bg-border" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pb-3">
                <div className="flex items-baseline gap-2">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isWarning && "text-warning",
                    )}
                  >
                    {pt.area_name}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    Km {pt.km} · {pt.estimated_time}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-foreground/80">
                  <span className="font-medium">{pt.temp_c}°C</span>
                  <span>{pt.description}</span>
                  {pt.rain_chance_percent > 0 && (
                    <span
                      className={cn(
                        pt.rain_chance_percent >= 50
                          ? "text-warning font-medium"
                          : "text-muted-foreground",
                      )}
                    >
                      🌧 {pt.rain_chance_percent}%
                    </span>
                  )}
                  {pt.wind_kph > 20 && (
                    <span className="text-muted-foreground">
                      💨 {pt.wind_kph} km/h
                    </span>
                  )}
                </div>
                {isWarning && pt.driving_advisory && (
                  <p className="mt-0.5 text-[11px] font-medium text-warning">
                    {pt.driving_advisory}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {typeof output.overall_advisory === "string" && (
        <div className="mt-1 rounded-lg bg-[color-mix(in_oklch,var(--info)_10%,transparent)] px-2.5 py-1.5">
          <p className="text-xs font-medium text-info">
            {output.overall_advisory}
          </p>
        </div>
      )}
    </Card>
  );
}
