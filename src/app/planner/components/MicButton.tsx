"use client";

import * as React from "react";
import { Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type MicButtonState = "idle" | "listening" | "loading";

interface MicButtonProps {
  state: MicButtonState;
  disabled?: boolean;
  onPress: () => void;
  className?: string;
}

const LABELS: Record<MicButtonState, string> = {
  idle: "Bắt đầu nói",
  listening: "Dừng ghi âm",
  loading: "Dừng trả lời",
};

export function MicButton({
  state,
  disabled = false,
  onPress,
  className,
}: MicButtonProps) {
  const isActive = state !== "idle";

  return (
    <Button
      type="button"
      size="icon-lg"
      onClick={onPress}
      disabled={disabled}
      aria-label={LABELS[state]}
      aria-pressed={state === "listening"}
      className={cn(
        "relative rounded-full text-primary-foreground shadow-lg",
        state === "idle" && "bg-primary hover:bg-primary/90",
        state === "listening" && "bg-danger hover:bg-danger/90",
        state === "loading" && "bg-warning text-warning-foreground hover:bg-warning/90",
        className,
      )}
    >
      {isActive && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full animate-ping motion-reduce:animate-none",
            state === "listening"
              ? "bg-danger/40"
              : "bg-warning/40",
          )}
        />
      )}
      {state === "idle" ? (
        <Mic className="h-6 w-6" aria-hidden />
      ) : (
        <Square className="h-6 w-6 fill-current" aria-hidden />
      )}
    </Button>
  );
}
