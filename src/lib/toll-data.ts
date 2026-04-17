// Vietnamese expressway toll data (curated for hackathon).
// baseFee is for car_under_12 (nhóm 1). Multiplied by vehicle type.

export const TOLL_ROUTES: Record<
  string,
  {
    name: string;
    gates: { name: string; baseFee: number }[];
  }
> = {
  "hcm-longthanh": {
    name: "TP.HCM → Long Thành",
    gates: [
      { name: "Trạm Long Phước", baseFee: 52_000 },
      { name: "Trạm Dầu Giây", baseFee: 28_000 },
    ],
  },
  "hcm-dalat": {
    name: "TP.HCM → Đà Lạt",
    gates: [
      { name: "Trạm Long Phước", baseFee: 52_000 },
      { name: "Trạm Dầu Giây", baseFee: 28_000 },
      { name: "Trạm Liên Khương", baseFee: 140_000 },
    ],
  },
  "hcm-vungtau": {
    name: "TP.HCM → Vũng Tàu",
    gates: [
      { name: "Trạm Long Phước", baseFee: 52_000 },
      { name: "Trạm Phú Mỹ", baseFee: 25_000 },
    ],
  },
  "hcm-cantho": {
    name: "TP.HCM → Cần Thơ",
    gates: [
      { name: "Trạm Chợ Đệm", baseFee: 40_000 },
      { name: "Trạm Bến Lức", baseFee: 52_000 },
      { name: "Trạm Mỹ Thuận", baseFee: 65_000 },
    ],
  },
  "hcm-nhatrang": {
    name: "TP.HCM → Nha Trang",
    gates: [
      { name: "Trạm Long Phước", baseFee: 52_000 },
      { name: "Trạm Dầu Giây", baseFee: 28_000 },
      { name: "Trạm Ninh An", baseFee: 120_000 },
    ],
  },
  "hcm-phanthiet": {
    name: "TP.HCM → Phan Thiết",
    gates: [
      { name: "Trạm Dầu Giây – Phan Thiết", baseFee: 116_000 },
    ],
  },
  "hanoi-haiphong": {
    name: "Hà Nội → Hải Phòng",
    gates: [
      { name: "Trạm Hà Nội – Hải Phòng", baseFee: 160_000 },
    ],
  },
  "hanoi-laocai": {
    name: "Hà Nội → Lào Cai (Sa Pa)",
    gates: [
      { name: "Trạm Nội Bài – Lào Cai", baseFee: 420_000 },
    ],
  },
  "hanoi-ninhbinh": {
    name: "Hà Nội → Ninh Bình",
    gates: [
      { name: "Trạm Cầu Giẽ – Ninh Bình", baseFee: 90_000 },
    ],
  },
};

// Per-km fallback toll rate (VND/km for Group 1 vehicles on expressways).
// Used when no exact route match is found but distance is known.
export const DEFAULT_TOLL_RATE_PER_KM = 1_200;

// City name aliases for fuzzy matching in findTollRouteKey.
export const CITY_ALIASES: Record<string, string[]> = {
  hcm: ["tphcm", "hochiminh", "saigon", "saigon", "hochiminhcity", "quan1", "tphochiminh"],
  hanoi: ["hn", "hanoi", "tphanoi"],
  longthanh: ["longthanh", "sanbaylongthanh", "sanbaymoi"],
  dalat: ["dalat", "lamdong", "tpdalat"],
  vungtau: ["vungtau", "bariavungtau"],
  cantho: ["cantho", "tpcantho"],
  nhatrang: ["nhatrang", "khanhhoa"],
  phanthiet: ["phanthiet", "binhthuan", "muine"],
  haiphong: ["haiphong", "tphaiphong"],
  laocai: ["laocai", "sapa"],
  ninhbinh: ["ninhbinh", "trangan", "baidinh"],
};

// Fuel prices in VND per liter (or per kWh for electric).
// Approximate as of April 2025.
export const FUEL_PRICES_UPDATED = "2025-04";

export const FUEL_PRICES: Record<string, number> = {
  RON95: 23_450,
  RON92: 22_580,
  diesel: 20_900,
  electric: 3_500, // VNĐ per kWh at public charger
};
