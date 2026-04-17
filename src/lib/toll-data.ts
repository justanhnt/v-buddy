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
  "danang-hue": {
    name: "Đà Nẵng → Huế",
    gates: [
      { name: "Trạm La Sơn – Túy Loan", baseFee: 50_000 },
    ],
  },
  "danang-quangngai": {
    name: "Đà Nẵng → Quảng Ngãi",
    gates: [
      { name: "Trạm Túy Loan – Quảng Ngãi", baseFee: 75_000 },
    ],
  },
  "danang-quynhon": {
    name: "Đà Nẵng → Quy Nhơn",
    gates: [
      { name: "Trạm Túy Loan – Quảng Ngãi", baseFee: 75_000 },
      { name: "Trạm Quảng Ngãi – Bình Định", baseFee: 60_000 },
    ],
  },
  "hanoi-thanhhoa": {
    name: "Hà Nội → Thanh Hóa",
    gates: [
      { name: "Trạm Cầu Giẽ – Ninh Bình", baseFee: 90_000 },
      { name: "Trạm Ninh Bình – Thanh Hóa", baseFee: 50_000 },
    ],
  },
  "hanoi-quangninh": {
    name: "Hà Nội → Quảng Ninh (Hạ Long)",
    gates: [
      { name: "Trạm Hà Nội – Hải Phòng (nhánh Quảng Ninh)", baseFee: 130_000 },
      { name: "Trạm Hạ Long – Vân Đồn", baseFee: 50_000 },
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
  danang: ["danang", "tpdanang", "danangthanh"],
  hue: ["hue", "tphue", "thuathienhue"],
  quangngai: ["quangngai", "tpquangngai"],
  quynhon: ["quynhon", "binhdinh", "tpquynhon"],
  thanhhoa: ["thanhhoa", "tpthanhhoa"],
  quangninh: ["quangninh", "halong", "halongbay", "vandon"],
};

// Fuel prices in VND per liter (or per kWh for electric).
// Approximate as of April 2025.
// Typical parking costs in VND (demo estimates).
export const PARKING_PRICES: Record<string, { label: string; fee_vnd: number; unit: string }[]> = {
  downtown: [
    { label: "Ô tô (bãi hầm/TTTM)", fee_vnd: 40_000, unit: "lượt" },
    { label: "Ô tô (bãi ngoài trời)", fee_vnd: 25_000, unit: "lượt" },
    { label: "Xe máy", fee_vnd: 5_000, unit: "lượt" },
  ],
  airport: [
    { label: "Ô tô (sân bay)", fee_vnd: 80_000, unit: "lượt" },
    { label: "Xe máy (sân bay)", fee_vnd: 15_000, unit: "lượt" },
  ],
  tourist: [
    { label: "Ô tô (khu du lịch)", fee_vnd: 30_000, unit: "lượt" },
    { label: "Xe máy (khu du lịch)", fee_vnd: 10_000, unit: "lượt" },
  ],
  residential: [
    { label: "Ô tô (khu dân cư)", fee_vnd: 20_000, unit: "lượt" },
    { label: "Xe máy", fee_vnd: 3_000, unit: "lượt" },
  ],
};

export const FUEL_PRICES_UPDATED = "2026-04";

export const FUEL_PRICES: Record<string, number> = {
  RON95: 24_110,
  RON92: 23_250,
  diesel: 21_450,
  electric: 3_300, // VNĐ per kWh at public charger
};
