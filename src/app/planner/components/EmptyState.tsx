"use client";

import { Sparkles } from "lucide-react";

import { Chip } from "@/components/ui/chip";

const SUGGESTIONS = [
  "Đi Đà Lạt tránh trạm",
  "Tìm quán ăn gần đây",
  "So sánh tuyến nhanh và tuyến rẻ",
];

interface EmptyStateProps {
  onPick: (text: string) => void;
}

export function EmptyState({ onPick }: EmptyStateProps) {
  return (
    <li className="self-start w-full max-w-[92%] rounded-2xl border border-border bg-card p-4 text-sm text-card-foreground shadow-sm">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklch,var(--primary)_15%,transparent)] text-primary"
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Chào bạn! Mình là trợ lý đi đường.</p>
          <p className="mt-1 text-muted-foreground">
            Nhấn giữ micro và nói bạn cần gì — tìm tuyến, quán ăn, trạm sạc,
            bảo hiểm… tất cả trong một câu.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Chip
                key={s}
                className="h-8 px-3 text-xs"
                onClick={() => onPick(s)}
              >
                {s}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
}
