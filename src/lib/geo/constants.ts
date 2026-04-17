// Centered on Ho Chi Minh City
export const VN_CENTER: [number, number] = [106.7009, 10.7769];

export const UA = "VETCBuddy/1.0 (vetc-buddy hackathon)";
export const TIMEOUT = 5_000;

/** Two Overpass endpoints, alternated to avoid per-server rate limits. */
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// Key waypoints along Vietnam's north-south corridor (sorted by latitude, north → south).
// These keep OSRM from routing through Laos/Cambodia on long domestic trips.
export const VN_CORRIDOR: { lat: number; lng: number }[] = [
  { lat: 21.03, lng: 105.85 }, // Hà Nội
  { lat: 20.43, lng: 106.17 }, // Ninh Bình
  { lat: 19.80, lng: 105.78 }, // Thanh Hóa
  { lat: 18.68, lng: 105.68 }, // Vinh
  { lat: 17.48, lng: 106.60 }, // Đồng Hới
  { lat: 16.46, lng: 107.60 }, // Huế
  { lat: 16.05, lng: 108.20 }, // Đà Nẵng
  { lat: 15.12, lng: 108.80 }, // Quảng Ngãi
  { lat: 13.77, lng: 109.22 }, // Quy Nhơn
  { lat: 12.24, lng: 109.19 }, // Nha Trang
  { lat: 11.94, lng: 108.44 }, // Đà Lạt
  { lat: 10.93, lng: 108.10 }, // Phan Thiết
  { lat: 10.78, lng: 106.70 }, // TP.HCM
  { lat: 10.04, lng: 105.78 }, // Cần Thơ
];

export const CATEGORY_TO_OSM: Record<string, string> = {
  eat: 'nwr["amenity"~"restaurant|fast_food"]',
  cafe: 'nwr["amenity"="cafe"]',
  fuel: 'nwr["amenity"="fuel"]',
  charge: 'nwr["amenity"="charging_station"]',
  parking: 'nwr["amenity"="parking"]',
  hotel: 'nwr["tourism"~"hotel|motel|guest_house"]',
  rest_stop: 'nwr["highway"~"rest_area|services"]',
};

export const CATEGORY_LABEL_VI: Record<string, string> = {
  eat: "Quán ăn",
  cafe: "Quán cà phê",
  fuel: "Trạm xăng",
  charge: "Trạm sạc",
  parking: "Bãi đỗ xe",
  hotel: "Khách sạn",
  rest_stop: "Trạm dừng nghỉ",
};

/** Major Vietnamese cities for instant area-name resolution (no API call). */
export const VN_CITIES = [
  { lat: 21.03, lng: 105.85, name: "Hà Nội" },
  { lat: 20.86, lng: 106.68, name: "Hải Phòng" },
  { lat: 20.43, lng: 106.17, name: "Ninh Bình" },
  { lat: 19.80, lng: 105.78, name: "Thanh Hóa" },
  { lat: 18.68, lng: 105.68, name: "Vinh" },
  { lat: 17.48, lng: 106.60, name: "Đồng Hới" },
  { lat: 16.46, lng: 107.60, name: "Huế" },
  { lat: 16.05, lng: 108.20, name: "Đà Nẵng" },
  { lat: 15.88, lng: 108.33, name: "Hội An" },
  { lat: 15.12, lng: 108.80, name: "Quảng Ngãi" },
  { lat: 14.36, lng: 108.00, name: "Pleiku" },
  { lat: 13.77, lng: 109.22, name: "Quy Nhơn" },
  { lat: 12.68, lng: 108.05, name: "Buôn Ma Thuột" },
  { lat: 12.24, lng: 109.19, name: "Nha Trang" },
  { lat: 11.94, lng: 108.44, name: "Đà Lạt" },
  { lat: 11.58, lng: 108.99, name: "Phan Rang" },
  { lat: 11.55, lng: 107.81, name: "Bảo Lộc" },
  { lat: 10.93, lng: 108.10, name: "Phan Thiết" },
  { lat: 10.98, lng: 106.65, name: "Long Thành" },
  { lat: 10.95, lng: 106.84, name: "Biên Hòa" },
  { lat: 11.33, lng: 106.63, name: "Bình Dương" },
  { lat: 10.78, lng: 106.70, name: "TP.HCM" },
  { lat: 10.37, lng: 107.08, name: "Vũng Tàu" },
  { lat: 10.36, lng: 106.36, name: "Mỹ Tho" },
  { lat: 10.04, lng: 105.78, name: "Cần Thơ" },
  { lat: 9.60, lng: 105.97, name: "Sóc Trăng" },
  { lat: 9.78, lng: 105.46, name: "Cà Mau" },
];
