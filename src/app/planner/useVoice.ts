"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

// Minimal typings for the Web Speech API — not in lib.dom.d.ts everywhere.
type SRResultAlt = { transcript: string };
type SRResult = { 0: SRResultAlt; isFinal: boolean; length: number };
type SREvent = { resultIndex: number; results: ArrayLike<SRResult> };
type SRErrorEvent = { error: string };

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SRCtor = new () => SpeechRecognition;

function getSRCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceErrorCode =
  | "not-allowed"
  | "service-not-allowed"
  | "no-speech"
  | "audio-capture"
  | "network"
  | "aborted"
  | "language-not-supported"
  | "unsupported"
  | "unknown";

const VOICE_ERROR_MESSAGES: Record<VoiceErrorCode, string> = {
  "not-allowed":
    "Trình duyệt đã chặn micro. Bật quyền trong cài đặt rồi thử lại.",
  "service-not-allowed":
    "Dịch vụ nhận giọng nói bị chặn trên thiết bị này.",
  "no-speech": "Không nghe thấy gì — hãy thử nói rõ hơn.",
  "audio-capture": "Không kết nối được micro. Kiểm tra thiết bị âm thanh.",
  network: "Mất kết nối mạng trong khi nhận giọng nói.",
  aborted: "Đã hủy nhận giọng nói.",
  "language-not-supported": "Trình duyệt chưa hỗ trợ tiếng Việt.",
  unsupported: "Trình duyệt chưa hỗ trợ giọng nói.",
  unknown: "Có lỗi khi nhận giọng nói. Vui lòng thử lại.",
};

const KNOWN_CODES = new Set<string>([
  "not-allowed",
  "service-not-allowed",
  "no-speech",
  "audio-capture",
  "network",
  "aborted",
  "language-not-supported",
]);

export type VoiceState = {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  errorCode: VoiceErrorCode | null;
  start: () => void;
  stop: () => void;
  clearError: () => void;
};

const subscribeNoop = () => () => {};
const getSupportSnapshot = () => getSRCtor() !== null;
const getSupportServerSnapshot = () => false;

// How long to wait in silence after detected speech before auto-stopping.
const DEFAULT_SILENCE_MS = 2500;
// Longer grace period before the user has said anything yet.
const INITIAL_SILENCE_MULTIPLIER = 2.4;

export function useVoice(
  onFinal: (text: string) => void,
  lang = "vi-VN",
  silenceMs: number = DEFAULT_SILENCE_MS,
): VoiceState {
  const supported = useSyncExternalStore(
    subscribeNoop,
    getSupportSnapshot,
    getSupportServerSnapshot,
  );
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [errorCode, setErrorCode] = useState<VoiceErrorCode | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef("");
  const pendingTranscriptRef = useRef<string | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualStopRef = useRef(false);

  const flushTranscript = useCallback(() => {
    flushTimerRef.current = null;
    if (pendingTranscriptRef.current != null) {
      setTranscript(pendingTranscriptRef.current);
      pendingTranscriptRef.current = null;
    }
  }, []);

  const queueTranscript = useCallback(
    (next: string) => {
      pendingTranscriptRef.current = next;
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(flushTranscript, 80);
    },
    [flushTranscript],
  );

  const clearError = useCallback(() => setErrorCode(null), []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const armSilenceTimer = useCallback(
    (ms: number) => {
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        silenceTimerRef.current = null;
        manualStopRef.current = true;
        const rec = recRef.current;
        if (!rec) return;
        try {
          rec.stop();
        } catch {}
      }, ms);
    },
    [clearSilenceTimer],
  );

  const start = useCallback(() => {
    const Ctor = getSRCtor();
    if (!Ctor) {
      setErrorCode("unsupported");
      return;
    }
    if (recRef.current) {
      try {
        recRef.current.abort();
      } catch {}
      recRef.current = null;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    finalRef.current = "";
    pendingTranscriptRef.current = null;
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    clearSilenceTimer();
    manualStopRef.current = false;
    setTranscript("");
    setErrorCode(null);

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          finalRef.current += r[0].transcript;
        } else {
          interim += r[0].transcript;
        }
      }
      const combined = (finalRef.current + " " + interim).trim();
      queueTranscript(combined);
      if (combined.length > 0) {
        armSilenceTimer(silenceMs);
      }
    };
    rec.onerror = (e) => {
      const raw = e.error || "unknown";
      // "no-speech" just means the browser hit its internal silence limit —
      // we handle our own silence timing, so don't surface that as an error.
      if (raw === "no-speech") {
        manualStopRef.current = true;
        return;
      }
      const code: VoiceErrorCode = KNOWN_CODES.has(raw)
        ? (raw as VoiceErrorCode)
        : "unknown";
      manualStopRef.current = true;
      setErrorCode(code);
    };
    rec.onend = () => {
      // If the browser auto-ended before the user (or silence timer) asked us
      // to, try to resume so short pauses don't cut off the user mid-sentence.
      if (!manualStopRef.current) {
        try {
          rec.start();
          return;
        } catch {
          // fall through to finalize
        }
      }
      clearSilenceTimer();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTranscript();
      }
      setListening(false);
      const text = finalRef.current.trim();
      if (text) onFinal(text);
      recRef.current = null;
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
      armSilenceTimer(Math.round(silenceMs * INITIAL_SILENCE_MULTIPLIER));
    } catch {
      setErrorCode("unknown");
    }
  }, [
    armSilenceTimer,
    clearSilenceTimer,
    flushTranscript,
    lang,
    onFinal,
    queueTranscript,
    silenceMs,
  ]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    manualStopRef.current = true;
    clearSilenceTimer();
    try {
      rec.stop();
    } catch {}
  }, [clearSilenceTimer]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      const rec = recRef.current;
      if (rec) {
        manualStopRef.current = true;
        try {
          rec.abort();
        } catch {}
      }
    };
  }, []);

  const error = errorCode ? VOICE_ERROR_MESSAGES[errorCode] : null;

  return {
    supported,
    listening,
    transcript,
    error,
    errorCode,
    start,
    stop,
    clearError,
  };
}
