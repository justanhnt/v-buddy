// Mock trip history for hackathon demo.
// Returns recent past trips with cost breakdown.

export type PastTrip = {
  id: string;
  date: string;
  from: string;
  to: string;
  distanceKm: number;
  durationMin: number;
  tollVnd: number;
  fuelVnd: number;
  totalVnd: number;
  vehicleType: "car_under_12" | "car_12_to_30" | "truck" | "motorbike";
  fuelType: "RON95" | "RON92" | "diesel" | "electric";
};

const MOCK_TRIPS: PastTrip[] = [
  {
    id: "trip-001",
    date: "2026-04-12",
    from: "TP.HCM",
    to: "Đà Lạt",
    distanceKm: 310,
    durationMin: 420,
    tollVnd: 220_000,
    fuelVnd: 598_000,
    totalVnd: 818_000,
    vehicleType: "car_under_12",
    fuelType: "RON95",
  },
  {
    id: "trip-002",
    date: "2026-04-05",
    from: "TP.HCM",
    to: "Vũng Tàu",
    distanceKm: 125,
    durationMin: 120,
    tollVnd: 77_000,
    fuelVnd: 241_000,
    totalVnd: 318_000,
    vehicleType: "car_under_12",
    fuelType: "RON95",
  },
  {
    id: "trip-003",
    date: "2026-03-29",
    from: "TP.HCM",
    to: "Cần Thơ",
    distanceKm: 170,
    durationMin: 180,
    tollVnd: 157_000,
    fuelVnd: 328_000,
    totalVnd: 485_000,
    vehicleType: "car_under_12",
    fuelType: "RON95",
  },
  {
    id: "trip-004",
    date: "2026-03-22",
    from: "TP.HCM",
    to: "Nha Trang",
    distanceKm: 430,
    durationMin: 480,
    tollVnd: 200_000,
    fuelVnd: 829_000,
    totalVnd: 1_029_000,
    vehicleType: "car_under_12",
    fuelType: "RON95",
  },
  {
    id: "trip-005",
    date: "2026-03-15",
    from: "Hà Nội",
    to: "Hải Phòng",
    distanceKm: 120,
    durationMin: 105,
    tollVnd: 160_000,
    fuelVnd: 231_000,
    totalVnd: 391_000,
    vehicleType: "car_under_12",
    fuelType: "RON95",
  },
  {
    id: "trip-006",
    date: "2026-03-08",
    from: "TP.HCM",
    to: "Phan Thiết",
    distanceKm: 200,
    durationMin: 150,
    tollVnd: 116_000,
    fuelVnd: 386_000,
    totalVnd: 502_000,
    vehicleType: "car_under_12",
    fuelType: "RON95",
  },
];

export function getTripHistory(limit?: number): {
  trips: PastTrip[];
  total_trips: number;
  total_spent_vnd: number;
} {
  const trips = MOCK_TRIPS.slice(0, limit ?? 5);
  const totalSpent = MOCK_TRIPS.reduce((sum, t) => sum + t.totalVnd, 0);
  return {
    trips,
    total_trips: MOCK_TRIPS.length,
    total_spent_vnd: totalSpent,
  };
}
