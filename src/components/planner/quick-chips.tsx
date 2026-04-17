"use client";

import * as React from "react";
import {
  Clock,
  Cloud,
  Coffee,
  Fuel,
  Map,
  MapPin,
  Navigation,
  ParkingSquare,
  Receipt,
  Route,
  Sparkles,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Chip } from "@/components/ui/chip";

import type { Place } from "@/types/planner";

interface ChipDef {
  label: string;
  icon: LucideIcon;
}

const DEFAULT_CHIPS: ChipDef[] = [
  { label: "Lên kế hoạch đi Đà Lạt cuối tuần", icon: Sparkles },
  { label: "Đi cafe ở Thảo Điền, tìm chỗ đậu xe", icon: Coffee },
  { label: "So sánh đường đi Vũng Tàu", icon: Map },
  { label: "HCM → Đà Lạt → Nha Trang → HCM", icon: Route },
  { label: "Lịch sử chuyến đi", icon: Clock },
  { label: "Quán ăn dọc đường đi Đà Lạt", icon: Utensils },
  { label: "Trạm sạc gần đây", icon: Zap },
  { label: "Số dư ví VETC", icon: Wallet },
  { label: "Thời tiết dọc đường đi Nha Trang thứ 7", icon: Cloud },
];

function getPlaceChips(place: Place): ChipDef[] {
  const name = place.name;
  return [
    { label: `Đi đến ${name} hết bao nhiêu?`, icon: Navigation },
    { label: `Tìm bãi đỗ xe gần ${name}`, icon: ParkingSquare },
    { label: `Tìm quán ăn gần ${name}`, icon: Utensils },
    { label: `Trạm sạc gần ${name}`, icon: Zap },
    { label: `Thời tiết ${name}`, icon: Cloud },
    { label: `Chỉ đường đến ${name}`, icon: MapPin },
  ];
}

interface QuickChipsProps {
  disabled?: boolean;
  onSelect: (text: string) => void;
  pickedPlace?: Place | null;
}

export function QuickChips({ disabled, onSelect, pickedPlace }: QuickChipsProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const chips = pickedPlace ? getPlaceChips(pickedPlace) : DEFAULT_CHIPS;

  // Scroll back to start when chips change
  React.useEffect(() => {
    containerRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [pickedPlace]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const items = Array.from(
      containerRef.current?.querySelectorAll<HTMLButtonElement>(
        "button[data-chip]",
      ) ?? [],
    );
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (idx < 0) return;
    e.preventDefault();
    const nextIdx =
      e.key === "ArrowRight"
        ? (idx + 1) % items.length
        : (idx - 1 + items.length) % items.length;
    items[nextIdx]?.focus();
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        role="toolbar"
        aria-label={pickedPlace ? `Gợi ý cho ${pickedPlace.name}` : "Gợi ý nhanh"}
        onKeyDown={handleKeyDown}
        className="scroll-hint-x flex gap-2 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {chips.map(({ label, icon: Icon }) => (
          <Chip
            key={label}
            data-chip
            disabled={disabled}
            onClick={() => onSelect(label)}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
