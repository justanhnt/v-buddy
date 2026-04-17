// Fallback POI data for demo when Overpass API is unavailable.
// Curated places in popular HCMC areas + a few in Hanoi/Da Lat.

import type { POIResult } from "./poi";
import { haversineKm } from "./math";

type FallbackPOI = {
  name: string;
  lat: number;
  lng: number;
  category: string;
  tags: Record<string, string>;
};

const FALLBACK_POIS: FallbackPOI[] = [
  // ===== Thảo Điền / Thủ Đức =====
  // Cafe
  { name: "The Coffee House — Thảo Điền", lat: 10.8025, lng: 106.7355, category: "cafe", tags: { amenity: "cafe", brand: "The Coffee House", opening_hours: "07:00-22:30" } },
  { name: "Highlands Coffee — Estella Place", lat: 10.7985, lng: 106.7420, category: "cafe", tags: { amenity: "cafe", brand: "Highlands Coffee", opening_hours: "07:00-22:00" } },
  { name: "Phúc Long — Xa lộ Hà Nội", lat: 10.8050, lng: 106.7390, category: "cafe", tags: { amenity: "cafe", brand: "Phúc Long", opening_hours: "07:00-22:00" } },
  { name: "Là Việt Coffee", lat: 10.8012, lng: 106.7328, category: "cafe", tags: { amenity: "cafe", cuisine: "coffee", opening_hours: "07:30-21:00" } },
  { name: "Starbucks — Masteri Thảo Điền", lat: 10.8028, lng: 106.7413, category: "cafe", tags: { amenity: "cafe", brand: "Starbucks", opening_hours: "07:00-22:00" } },
  // Eat
  { name: "Phở Phú Vương", lat: 10.8035, lng: 106.7340, category: "eat", tags: { amenity: "restaurant", cuisine: "vietnamese", opening_hours: "06:00-22:00" } },
  { name: "Pizza 4P's — Thảo Điền", lat: 10.8008, lng: 106.7365, category: "eat", tags: { amenity: "restaurant", cuisine: "pizza;italian", brand: "Pizza 4P's", opening_hours: "10:00-22:00" } },
  { name: "Bánh Mì Hòa Mã", lat: 10.8018, lng: 106.7310, category: "eat", tags: { amenity: "fast_food", cuisine: "vietnamese", opening_hours: "06:00-18:00" } },
  { name: "Cơm Tấm Bụi Sài Gòn", lat: 10.8042, lng: 106.7348, category: "eat", tags: { amenity: "restaurant", cuisine: "vietnamese", opening_hours: "06:30-21:00" } },
  // Parking
  { name: "Bãi xe Masteri Thảo Điền", lat: 10.8030, lng: 106.7415, category: "parking", tags: { amenity: "parking", parking: "underground", access: "customers", fee: "yes" } },
  { name: "Bãi xe Estella Place", lat: 10.7990, lng: 106.7425, category: "parking", tags: { amenity: "parking", parking: "multi-storey", capacity: "500", fee: "yes" } },
  { name: "Bãi giữ xe Thảo Điền", lat: 10.8015, lng: 106.7332, category: "parking", tags: { amenity: "parking", parking: "surface", fee: "yes" } },
  // Fuel
  { name: "Petrolimex — Xa lộ Hà Nội", lat: 10.8060, lng: 106.7380, category: "fuel", tags: { amenity: "fuel", brand: "Petrolimex", operator: "Petrolimex" } },
  // Charge
  { name: "VinFast Charging — Masteri", lat: 10.8032, lng: 106.7418, category: "charge", tags: { amenity: "charging_station", network: "VinFast", "socket:type2_combo": "2" } },

  // ===== Quận 1 =====
  // Cafe
  { name: "The Coffee House — Nguyễn Huệ", lat: 10.7726, lng: 106.7030, category: "cafe", tags: { amenity: "cafe", brand: "The Coffee House", opening_hours: "07:00-23:00" } },
  { name: "Highlands Coffee — Nguyễn Du", lat: 10.7760, lng: 106.6990, category: "cafe", tags: { amenity: "cafe", brand: "Highlands Coffee", opening_hours: "06:30-22:30" } },
  { name: "Cộng Cà Phê — Đồng Khởi", lat: 10.7740, lng: 106.7022, category: "cafe", tags: { amenity: "cafe", brand: "Cộng Cà Phê", opening_hours: "07:00-23:00" } },
  { name: "L'Usine — Đồng Khởi", lat: 10.7735, lng: 106.7035, category: "cafe", tags: { amenity: "cafe", cuisine: "coffee", opening_hours: "07:30-22:00" } },
  // Eat
  { name: "Bún Chả 145 Bùi Viện", lat: 10.7680, lng: 106.6935, category: "eat", tags: { amenity: "restaurant", cuisine: "vietnamese", opening_hours: "10:00-22:00" } },
  { name: "Cơm Niêu Sài Gòn", lat: 10.7752, lng: 106.7010, category: "eat", tags: { amenity: "restaurant", cuisine: "vietnamese", opening_hours: "10:30-22:00" } },
  { name: "Wrap & Roll — Hai Bà Trưng", lat: 10.7748, lng: 106.6985, category: "eat", tags: { amenity: "restaurant", cuisine: "vietnamese", brand: "Wrap & Roll", opening_hours: "10:00-22:00" } },
  // Parking
  { name: "Bãi xe Vincom Đồng Khởi", lat: 10.7738, lng: 106.7020, category: "parking", tags: { amenity: "parking", parking: "underground", capacity: "800", fee: "yes", access: "customers" } },
  { name: "Bãi xe Nguyễn Huệ", lat: 10.7720, lng: 106.7032, category: "parking", tags: { amenity: "parking", parking: "underground", capacity: "200", fee: "yes" } },
  { name: "Bãi xe Takashimaya", lat: 10.7730, lng: 106.7005, category: "parking", tags: { amenity: "parking", parking: "multi-storey", capacity: "600", fee: "yes" } },
  // Fuel
  { name: "Petrolimex — Nguyễn Thị Minh Khai", lat: 10.7780, lng: 106.6915, category: "fuel", tags: { amenity: "fuel", brand: "Petrolimex" } },

  // ===== Quận 3 =====
  { name: "Phúc Long — Võ Văn Tần", lat: 10.7780, lng: 106.6895, category: "cafe", tags: { amenity: "cafe", brand: "Phúc Long", opening_hours: "07:00-22:00" } },
  { name: "Trung Nguyên Legend — Nguyễn Đình Chiểu", lat: 10.7788, lng: 106.6880, category: "cafe", tags: { amenity: "cafe", brand: "Trung Nguyên Legend", opening_hours: "06:30-22:30" } },
  { name: "Bún Bò Huế 3A3", lat: 10.7775, lng: 106.6870, category: "eat", tags: { amenity: "restaurant", cuisine: "vietnamese", opening_hours: "06:00-21:00" } },
  { name: "Bãi xe Lê Văn Sỹ", lat: 10.7810, lng: 106.6865, category: "parking", tags: { amenity: "parking", parking: "surface", fee: "yes" } },

  // ===== Quận 7 / Phú Mỹ Hưng =====
  { name: "Starbucks — Crescent Mall", lat: 10.7295, lng: 106.7185, category: "cafe", tags: { amenity: "cafe", brand: "Starbucks", opening_hours: "08:00-22:00" } },
  { name: "Highlands Coffee — SC VivoCity", lat: 10.7288, lng: 106.7222, category: "cafe", tags: { amenity: "cafe", brand: "Highlands Coffee", opening_hours: "08:00-22:00" } },
  { name: "Quán ăn Bà Huyện", lat: 10.7310, lng: 106.7195, category: "eat", tags: { amenity: "restaurant", cuisine: "vietnamese", opening_hours: "10:00-21:00" } },
  { name: "Bãi xe Crescent Mall", lat: 10.7292, lng: 106.7180, category: "parking", tags: { amenity: "parking", parking: "multi-storey", capacity: "1000", fee: "yes" } },
  { name: "VinFast Charging — Phú Mỹ Hưng", lat: 10.7300, lng: 106.7210, category: "charge", tags: { amenity: "charging_station", network: "VinFast", "socket:type2_combo": "4" } },

  // ===== Bình Thạnh =====
  { name: "The Coffee House — Landmark 81", lat: 10.7952, lng: 106.7218, category: "cafe", tags: { amenity: "cafe", brand: "The Coffee House", opening_hours: "07:00-22:30" } },
  { name: "Phở Lệ — Nguyễn Gia Trí", lat: 10.8030, lng: 106.7100, category: "eat", tags: { amenity: "restaurant", cuisine: "vietnamese", opening_hours: "06:00-22:00" } },
  { name: "Bãi xe Landmark 81", lat: 10.7948, lng: 106.7222, category: "parking", tags: { amenity: "parking", parking: "underground", capacity: "2000", fee: "yes" } },

  // ===== Tân Sơn Nhất area =====
  { name: "Highlands Coffee — Sân bay Tân Sơn Nhất", lat: 10.8179, lng: 106.6588, category: "cafe", tags: { amenity: "cafe", brand: "Highlands Coffee" } },
  { name: "Bãi xe sân bay Tân Sơn Nhất", lat: 10.8155, lng: 106.6600, category: "parking", tags: { amenity: "parking", parking: "multi-storey", capacity: "3000", fee: "yes" } },
  { name: "Petrolimex — Trường Sơn", lat: 10.8120, lng: 106.6545, category: "fuel", tags: { amenity: "fuel", brand: "Petrolimex" } },

  // ===== Hà Nội — Hoàn Kiếm =====
  { name: "Cộng Cà Phê — Hàng Bài", lat: 21.0247, lng: 105.8528, category: "cafe", tags: { amenity: "cafe", brand: "Cộng Cà Phê", opening_hours: "07:00-23:00" } },
  { name: "Highlands Coffee — Hồ Hoàn Kiếm", lat: 21.0285, lng: 105.8525, category: "cafe", tags: { amenity: "cafe", brand: "Highlands Coffee" } },
  { name: "Phở Thìn Bờ Hồ", lat: 21.0300, lng: 105.8515, category: "eat", tags: { amenity: "restaurant", cuisine: "vietnamese", opening_hours: "06:00-21:00" } },
  { name: "Bún Chả Hàng Mành", lat: 21.0335, lng: 105.8502, category: "eat", tags: { amenity: "restaurant", cuisine: "vietnamese", opening_hours: "09:00-14:00" } },
  { name: "Bãi xe Tràng Tiền Plaza", lat: 21.0252, lng: 105.8535, category: "parking", tags: { amenity: "parking", parking: "underground", fee: "yes" } },

  // ===== Đà Lạt =====
  { name: "Là Việt Coffee — Đà Lạt", lat: 11.9415, lng: 108.4384, category: "cafe", tags: { amenity: "cafe", brand: "Là Việt Coffee", opening_hours: "07:00-22:00" } },
  { name: "An Café — Hồ Xuân Hương", lat: 11.9422, lng: 108.4352, category: "cafe", tags: { amenity: "cafe", opening_hours: "07:00-22:00" } },
  { name: "Lẩu Bò Đà Lạt", lat: 11.9438, lng: 108.4330, category: "eat", tags: { amenity: "restaurant", cuisine: "vietnamese;hotpot", opening_hours: "10:00-22:00" } },
  { name: "Bãi xe Chợ Đà Lạt", lat: 11.9410, lng: 108.4365, category: "parking", tags: { amenity: "parking", parking: "surface", fee: "yes" } },
  { name: "Petrolimex — Trần Phú Đà Lạt", lat: 11.9445, lng: 108.4370, category: "fuel", tags: { amenity: "fuel", brand: "Petrolimex" } },

  // ===== Vũng Tàu =====
  { name: "Highlands Coffee — Bãi Sau", lat: 10.3465, lng: 107.0850, category: "cafe", tags: { amenity: "cafe", brand: "Highlands Coffee" } },
  { name: "Quán Ốc Đào", lat: 10.3480, lng: 107.0820, category: "eat", tags: { amenity: "restaurant", cuisine: "seafood", opening_hours: "10:00-22:00" } },
  { name: "Bãi xe Bãi Sau", lat: 10.3458, lng: 107.0842, category: "parking", tags: { amenity: "parking", parking: "surface", fee: "yes" } },
];

/**
 * Return fallback POI results filtered by category within radius of center.
 * Used when Overpass API is unavailable.
 */
export function fallbackPOI(
  category: string,
  center: { lat: number; lng: number },
  radiusKm: number,
): POIResult[] {
  return FALLBACK_POIS
    .filter((p) => p.category === category)
    .filter((p) => haversineKm(center.lat, center.lng, p.lat, p.lng) <= radiusKm)
    .sort((a, b) =>
      haversineKm(center.lat, center.lng, a.lat, a.lng) -
      haversineKm(center.lat, center.lng, b.lat, b.lng),
    )
    .map((p, i) => ({
      id: `fallback-${category}-${i}`,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      tags: p.tags,
    }));
}
