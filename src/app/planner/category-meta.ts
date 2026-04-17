import {
  BedDouble,
  Coffee,
  type LucideIcon,
  ParkingSquare,
  ShieldCheck,
  Utensils,
  Zap,
  Fuel,
  Coffee as RestStop,
} from "lucide-react";

import type { PlaceCategory } from "./types";

export const CATEGORY_LABEL: Record<string, string> = {
  eat: "Quán ăn",
  fuel: "Trạm xăng",
  charge: "Trạm sạc",
  parking: "Bãi đỗ",
  insurance: "Bảo hiểm",
  cafe: "Cafe",
  hotel: "Khách sạn",
  rest_stop: "Trạm dừng",
};

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  eat: Utensils,
  fuel: Fuel,
  charge: Zap,
  parking: ParkingSquare,
  insurance: ShieldCheck,
  cafe: Coffee,
  hotel: BedDouble,
  rest_stop: RestStop,
};

export const CATEGORY_TILE: Record<string, string> = {
  eat: "bg-[color-mix(in_oklch,var(--cat-eat)_20%,transparent)] text-[var(--cat-eat)]",
  fuel: "bg-[color-mix(in_oklch,var(--cat-fuel)_20%,transparent)] text-[var(--cat-fuel)]",
  charge:
    "bg-[color-mix(in_oklch,var(--cat-charge)_20%,transparent)] text-[var(--cat-charge)]",
  parking:
    "bg-[color-mix(in_oklch,var(--cat-parking)_20%,transparent)] text-[var(--cat-parking)]",
  insurance:
    "bg-[color-mix(in_oklch,var(--cat-insurance)_20%,transparent)] text-[var(--cat-insurance)]",
  cafe: "bg-[color-mix(in_oklch,var(--cat-cafe)_20%,transparent)] text-[var(--cat-cafe)]",
  hotel:
    "bg-[color-mix(in_oklch,var(--cat-hotel)_20%,transparent)] text-[var(--cat-hotel)]",
  rest_stop:
    "bg-[color-mix(in_oklch,var(--cat-cafe)_20%,transparent)] text-[var(--cat-cafe)]",
};

export function getCategoryLabel(cat?: PlaceCategory | string) {
  if (!cat) return "Địa điểm";
  return CATEGORY_LABEL[cat] ?? cat;
}
