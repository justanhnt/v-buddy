"use client";

import { Sparkles } from "lucide-react";

import { Chip } from "@/components/ui/chip";

const SUGGESTIONS = [
  "Đi Đà Lạt hết bao nhiêu?",
  "So sánh đường đi Vũng Tàu",
  "Tìm quán ăn gần đây",
  "Thời tiết Nha Trang",
  "Số dư ví VETC",
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
          <p className="font-medium">Chào bạn! Mình là VETC Buddy.</p>
          <p className="mt-1 text-muted-foreground">
            Hỏi mình bất kỳ điều gì về chuyến đi — chi phí, đường đi, quán ăn,
            thời tiết, ví VETC… Mình tính hết trong một lần!
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
