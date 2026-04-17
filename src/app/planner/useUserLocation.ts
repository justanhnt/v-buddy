"use client";

import { useEffect, useState } from "react";

export type UserLocation = {
  lat: number;
  lng: number;
  name: string | null;
};

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;

        // Reverse geocode to get a readable name
        let name: string | null = null;
        try {
          const url = new URL("https://nominatim.openstreetmap.org/reverse");
          url.searchParams.set("lat", String(lat));
          url.searchParams.set("lon", String(lng));
          url.searchParams.set("format", "json");
          url.searchParams.set("accept-language", "vi");
          url.searchParams.set("zoom", "14");

          const res = await fetch(url, {
            headers: { "User-Agent": "VETCBuddy/1.0 (vetc-buddy hackathon)" },
            signal: AbortSignal.timeout(5000),
          });
          const data = await res.json();
          // Use shorter address parts for display
          const addr = data.address;
          if (addr) {
            name = [
              addr.road,
              addr.suburb || addr.quarter || addr.neighbourhood,
              addr.city || addr.town || addr.county,
            ]
              .filter(Boolean)
              .join(", ");
          }
          if (!name) name = data.display_name ?? null;
        } catch {
          // Reverse geocode failed — we still have lat/lng
        }

        setLocation({ lat, lng, name });
      },
      () => {
        // Permission denied or error — leave null
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }, []);

  return location;
}
