import type { PlaceCategory, RoutePref } from "./types";

export type Intent =
  | { kind: "places"; category: PlaceCategory; reply: string }
  | { kind: "route"; pref: RoutePref; reply: string }
  | { kind: "trip"; reply: string }
  | { kind: "unknown"; reply: string };

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

type Rule = { test: RegExp; intent: Intent };

const RULES: Rule[] = [
  // EV charging
  {
    test: /\b(sac|tram sac|charger|xe dien|ev|vinfast)\b/,
    intent: { kind: "places", category: "charge", reply: "Đã tìm trạm sạc xe gần bạn." },
  },
  // Fuel
  {
    test: /\b(xang|do xang|ron|petrol|nhien lieu|dau do)\b/,
    intent: { kind: "places", category: "fuel", reply: "Đây là các trạm xăng gần đây." },
  },
  // Parking
  {
    test: /\b(do xe|bai xe|parking|cho dau|cho do xe|do o dau)\b/,
    intent: { kind: "places", category: "parking", reply: "Các bãi đỗ xe còn chỗ gần bạn." },
  },
  // Insurance
  {
    test: /\b(bao hiem|insurance|tnds|2 chieu|hai chieu)\b/,
    intent: { kind: "places", category: "insurance", reply: "Các điểm mua bảo hiểm uy tín." },
  },
  // Eat
  {
    test: /\b(an|quan an|doi|nha hang|pho|com|bun|banh mi|ca phe|cafe|ăn gì)\b/,
    intent: { kind: "places", category: "eat", reply: "Gợi ý quán ngon gần đây." },
  },
  // Route prefs
  {
    test: /\b(tranh tram|it tram|khong phi|mien phi|khong thu phi)\b/,
    intent: { kind: "route", pref: "few-tolls", reply: "Tuyến ít trạm thu phí nhất cho bạn." },
  },
  {
    test: /\b(cao toc|highway|duong cao toc)\b/,
    intent: { kind: "route", pref: "highway", reply: "Đi cao tốc cho nhanh." },
  },
  {
    test: /\b(bien|ven bien|duong bien)\b/,
    intent: { kind: "route", pref: "coast", reply: "Tuyến ven biển phong cảnh đẹp." },
  },
  {
    test: /\b(rung|phong canh|scenic|ngam canh)\b/,
    intent: { kind: "route", pref: "scenic", reply: "Tuyến đường rừng ngắm cảnh." },
  },
  {
    test: /\b(nhanh|gap|vội|kẹt xe|nhanh nhat)\b/,
    intent: { kind: "route", pref: "fast", reply: "Tuyến nhanh nhất bây giờ." },
  },
  {
    test: /\b(re|tiet kiem|it tien|budget)\b/,
    intent: { kind: "route", pref: "cheap", reply: "Tuyến tiết kiệm chi phí." },
  },
  // General route/plan
  {
    test: /\b(ve nha|toi|den|di tu|chi duong|duong di|route|tuyen)\b/,
    intent: { kind: "route", pref: "fast", reply: "Đây là các tuyến đường gợi ý." },
  },
  // Trip plan
  {
    test: /\b(ke hoach|len ke hoach|chuyen di|di choi|cuoi tuan|du lich|phuot)\b/,
    intent: { kind: "trip", reply: "Để mình lên kế hoạch chuyến đi cho bạn." },
  },
];

export function parseIntent(raw: string): Intent {
  const s = strip(raw);
  for (const rule of RULES) {
    if (rule.test.test(s)) return rule.intent;
  }
  return {
    kind: "unknown",
    reply: "Mình chưa rõ yêu cầu. Thử: 'tìm trạm sạc gần đây' hoặc 'đi Long Thành ít trạm thu phí'.",
  };
}
