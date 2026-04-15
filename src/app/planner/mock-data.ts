import type { Place, RouteResult } from "./types";

// Centered on Ho Chi Minh City
export const VN_CENTER: [number, number] = [106.7009, 10.7769];

export const MOCK_ROUTES: RouteResult[] = [
  {
    id: "r1",
    label: "Cao tốc TP.HCM – Long Thành – Dầu Giây",
    from: "Quận 1, TP.HCM",
    to: "Sân bay Long Thành, Đồng Nai",
    distanceKm: 55,
    durationMin: 62,
    tollVnd: 80_000,
    tollStops: 2,
    tags: ["fast", "highway"],
    path: [
      [106.7009, 10.7769],
      [106.7615, 10.7985],
      [106.8231, 10.8138],
      [106.9425, 10.8563],
      [107.028, 10.911],
    ],
  },
  {
    id: "r2",
    label: "Quốc lộ 51 ven biển qua Vũng Tàu",
    from: "Quận 1, TP.HCM",
    to: "Sân bay Long Thành, Đồng Nai",
    distanceKm: 71,
    durationMin: 95,
    tollVnd: 15_000,
    tollStops: 1,
    tags: ["cheap", "coast", "few-tolls"],
    path: [
      [106.7009, 10.7769],
      [106.7512, 10.7322],
      [106.8264, 10.6711],
      [106.95, 10.64],
      [107.05, 10.72],
      [107.028, 10.911],
    ],
  },
  {
    id: "r3",
    label: "Đường Hương lộ qua rừng Cát Tiên",
    from: "Quận 1, TP.HCM",
    to: "Sân bay Long Thành, Đồng Nai",
    distanceKm: 88,
    durationMin: 128,
    tollVnd: 0,
    tollStops: 0,
    tags: ["scenic", "few-tolls"],
    path: [
      [106.7009, 10.7769],
      [106.68, 10.88],
      [106.78, 10.98],
      [106.9, 11.02],
      [107.028, 10.911],
    ],
  },
  {
    id: "r4",
    label: "QL1A qua Biên Hòa (tránh phí)",
    from: "Quận 1, TP.HCM",
    to: "Sân bay Long Thành, Đồng Nai",
    distanceKm: 63,
    durationMin: 88,
    tollVnd: 20_000,
    tollStops: 1,
    tags: ["cheap", "few-tolls"],
    path: [
      [106.7009, 10.7769],
      [106.768, 10.82],
      [106.83, 10.94],
      [106.95, 10.96],
      [107.028, 10.911],
    ],
  },
];

export const MOCK_EAT: Place[] = [
  { id: "e1", name: "Phở Lệ", address: "413–415 Nguyễn Trãi, Quận 5", coord: [106.674, 10.7535], category: "eat", meta: "Phở · 80.000đ" },
  { id: "e2", name: "Bánh Mì Huỳnh Hoa", address: "26 Lê Thị Riêng, Quận 1", coord: [106.6921, 10.7702], category: "eat", meta: "Bánh mì · 72.000đ" },
  { id: "e3", name: "Cơm Tấm Ba Ghiền", address: "84 Đặng Văn Ngữ, Phú Nhuận", coord: [106.677, 10.792], category: "eat", meta: "Cơm tấm · 95.000đ" },
  { id: "e4", name: "Bún Bò Gánh", address: "110 Lý Chính Thắng, Quận 3", coord: [106.688, 10.783], category: "eat", meta: "Bún bò · 85.000đ" },
];

export const MOCK_FUEL: Place[] = [
  { id: "f1", name: "Petrolimex – CH 01", address: "15 Lê Duẩn, Quận 1", coord: [106.703, 10.781], category: "fuel", meta: "RON 95 · 23.450đ/L" },
  { id: "f2", name: "PVOIL – Võ Văn Kiệt", address: "268 Võ Văn Kiệt, Quận 1", coord: [106.694, 10.765], category: "fuel", meta: "RON 95 · 23.380đ/L" },
  { id: "f3", name: "Shell – Điện Biên Phủ", address: "310 Điện Biên Phủ, Bình Thạnh", coord: [106.7125, 10.789], category: "fuel", meta: "RON 95 · 23.520đ/L" },
  { id: "f4", name: "Petrolimex – Xa lộ Hà Nội", address: "Xa lộ Hà Nội, TP. Thủ Đức", coord: [106.758, 10.812], category: "fuel", meta: "RON 95 · 23.410đ/L" },
];

export const MOCK_CHARGE: Place[] = [
  { id: "c1", name: "VinFast Charging – Vincom Đồng Khởi", address: "72 Lê Thánh Tôn, Quận 1", coord: [106.7019, 10.7776], category: "charge", meta: "DC 60kW · Sẵn 2/4 trụ" },
  { id: "c2", name: "EV One – Crescent Mall", address: "101 Tôn Dật Tiên, Quận 7", coord: [106.7194, 10.7289], category: "charge", meta: "AC 22kW · Sẵn 3/6 trụ" },
  { id: "c3", name: "VinFast Charging – Landmark 81", address: "208 Nguyễn Hữu Cảnh, Bình Thạnh", coord: [106.7217, 10.7948], category: "charge", meta: "DC 150kW · Sẵn 1/3 trụ" },
  { id: "c4", name: "EVN – Trạm sạc Thủ Đức", address: "Võ Nguyên Giáp, TP. Thủ Đức", coord: [106.771, 10.845], category: "charge", meta: "DC 120kW · Sẵn 4/4 trụ" },
];

export const MOCK_PARKING: Place[] = [
  { id: "p1", name: "Bãi xe Saigon Centre", address: "65 Lê Lợi, Quận 1", coord: [106.7006, 10.7725], category: "parking", meta: "Còn 42 chỗ · 25.000đ/h" },
  { id: "p2", name: "Vincom Đồng Khởi B1–B3", address: "72 Lê Thánh Tôn, Quận 1", coord: [106.7022, 10.778], category: "parking", meta: "Còn 180 chỗ · 20.000đ/h" },
  { id: "p3", name: "Bãi xe Bến Thành", address: "Công viên 23/9, Quận 1", coord: [106.6959, 10.7724], category: "parking", meta: "Còn 14 chỗ · 15.000đ/h" },
  { id: "p4", name: "Bitexco Tower B2", address: "2 Hải Triều, Quận 1", coord: [106.7042, 10.7717], category: "parking", meta: "Còn 60 chỗ · 30.000đ/h" },
];

export const MOCK_INSURANCE: Place[] = [
  { id: "i1", name: "Bảo Việt – Chi nhánh Sài Gòn", address: "23–25 Lê Duẩn, Quận 1", coord: [106.7041, 10.7809], category: "insurance", meta: "TNDS xe máy · từ 66.000đ/năm" },
  { id: "i2", name: "PVI – VP TP.HCM", address: "141 Nguyễn Du, Quận 1", coord: [106.6968, 10.7773], category: "insurance", meta: "Vật chất ô tô · gói 2 chiều" },
  { id: "i3", name: "Bảo Minh – Quận 3", address: "26 Tôn Thất Đạm, Quận 3", coord: [106.688, 10.779], category: "insurance", meta: "TNDS ô tô · từ 480.000đ/năm" },
  { id: "i4", name: "VETC Partner – Liberty", address: "45 Võ Thị Sáu, Quận 3", coord: [106.6917, 10.7856], category: "insurance", meta: "Mua trong app · e-contract" },
];

export const VND = (n: number) =>
  n === 0 ? "Miễn phí" : new Intl.NumberFormat("vi-VN").format(n) + "đ";
