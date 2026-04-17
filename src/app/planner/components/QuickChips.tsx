"use client";

import * as React from "react";
import {
  Cloud,
  Fuel,
  Map,
  Receipt,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Chip } from "@/components/ui/chip";

interface ChipDef {
  label: string;
  icon: LucideIcon;
}

const QUICK_CHIPS: ChipDef[] = [
  { label: "Đi Đà Lạt hết bao nhiêu?", icon: Receipt },
  { label: "So sánh đường đi Vũng Tàu", icon: Map },
  { label: "Trạm sạc gần đây", icon: Zap },
  { label: "Đói bụng rồi", icon: Utensils },
  { label: "Số dư ví VETC", icon: Wallet },
  { label: "Thời tiết Đà Nẵng", icon: Cloud },
  { label: "Đổ xăng", icon: Fuel },
];

interface QuickChipsProps {
  disabled?: boolean;
  onSelect: (text: string) => void;
}

export function QuickChips({ disabled, onSelect }: QuickChipsProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

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
        aria-label="Gợi ý nhanh"
        onKeyDown={handleKeyDown}
        className="scroll-hint-x flex gap-2 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {QUICK_CHIPS.map(({ label, icon: Icon }) => (
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
