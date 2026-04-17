"use client";

import * as React from "react";
import {
  ArrowRight,
  Camera,
  Keyboard as KeyboardIcon,
  Mic as MicIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LiveRegion } from "@/components/ui/live-region";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

import type { VoiceState } from "@/hooks/use-voice";
import { MicButton, type MicButtonState } from "./mic-button";

interface ComposerProps {
  voice: VoiceState;
  isLoading: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onUploadImage: (file: File) => void;
}

export function Composer({
  voice,
  isLoading,
  onSend,
  onStop,
  onUploadImage,
}: ComposerProps) {
  const [typed, setTyped] = React.useState("");
  const [showKeyboard, setShowKeyboard] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const micState: MicButtonState = isLoading
    ? "loading"
    : voice.listening
      ? "listening"
      : "idle";

  const handleMicPress = React.useCallback(() => {
    if (isLoading) {
      onStop();
    } else if (voice.listening) {
      voice.stop();
    } else {
      voice.start();
    }
  }, [isLoading, onStop, voice]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !isLoading) onUploadImage(file);
    e.target.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim() || isLoading) return;
    onSend(typed);
    setTyped("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setShowKeyboard(false);
    }
  };

  React.useEffect(() => {
    if (showKeyboard) inputRef.current?.focus();
  }, [showKeyboard]);

  const liveMessage = React.useMemo(() => {
    if (voice.listening && voice.transcript) return voice.transcript;
    if (voice.listening) return "Đang nghe";
    if (isLoading) return "Đang xử lý";
    return "";
  }, [isLoading, voice.listening, voice.transcript]);

  const hint = isLoading
    ? "Đang suy nghĩ — nhấn để dừng."
    : voice.listening
      ? "Đang nghe — nhấn để dừng."
      : voice.supported
        ? "Nhấn micro và nói tự nhiên bằng tiếng Việt."
        : "Trình duyệt chưa hỗ trợ giọng nói — hãy gõ tin nhắn.";

  return (
    <div className="border-t border-border bg-background/80 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur">
      <LiveRegion>{liveMessage}</LiveRegion>

      {voice.error && (
        <div
          role="alert"
          className={cn(
            "mb-2 flex items-start gap-2 rounded-lg border border-danger/40 bg-[color-mix(in_oklch,var(--danger)_12%,var(--card))] px-3 py-2 text-xs text-[var(--danger)] dark:text-[var(--danger)]",
          )}
        >
          <span className="flex-1 leading-snug">{voice.error}</span>
          {voice.errorCode === "not-allowed" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 border-danger/50 text-[var(--danger)]"
              onClick={() => {
                voice.clearError();
                setShowKeyboard(true);
              }}
            >
              Gõ thay
            </Button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />

      {showKeyboard ? (
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 rounded-2xl border border-input bg-card px-2 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowKeyboard(false)}
                className="h-9 w-9 text-muted-foreground"
                aria-label="Dùng giọng nói"
              >
                <MicIcon className="h-5 w-5" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Dùng giọng nói</TooltipContent>
          </Tooltip>

          <input
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ví dụ: tìm trạm sạc gần đây"
            className="flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Tin nhắn"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="h-9 w-9 text-muted-foreground"
                aria-label="Chụp hoặc tải ảnh"
              >
                <Camera className="h-5 w-5" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Chụp / tải ảnh</TooltipContent>
          </Tooltip>

          <Button
            type="submit"
            size="icon"
            disabled={!typed.trim() || isLoading}
            className="h-9 w-9 rounded-xl"
            aria-label="Gửi"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </form>
      ) : (
        <div className="flex items-center justify-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => setShowKeyboard(true)}
                className="h-12 w-12 rounded-full"
                aria-label="Gõ tin nhắn"
              >
                <KeyboardIcon className="h-5 w-5" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Gõ tin nhắn</TooltipContent>
          </Tooltip>

          <MicButton
            state={micState}
            disabled={!voice.supported && !isLoading}
            onPress={handleMicPress}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="h-12 w-12 rounded-full"
                aria-label="Chụp hoặc tải ảnh"
              >
                <Camera className="h-5 w-5" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Chụp / tải ảnh</TooltipContent>
          </Tooltip>
        </div>
      )}

      <p className="mt-2 text-center text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
