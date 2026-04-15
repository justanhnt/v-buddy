"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

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

export type VoiceState = {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
};

// Subscribe-free external store: capability never changes in a session.
const subscribeNoop = () => () => {};
const getSupportSnapshot = () => getSRCtor() !== null;
const getSupportServerSnapshot = () => false;

export function useVoice(
  onFinal: (text: string) => void,
  lang = "vi-VN",
): VoiceState {
  const supported = useSyncExternalStore(
    subscribeNoop,
    getSupportSnapshot,
    getSupportServerSnapshot,
  );
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef("");

  const start = useCallback(() => {
    const Ctor = getSRCtor();
    if (!Ctor) {
      setError("Trình duyệt chưa hỗ trợ giọng nói.");
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
    rec.continuous = false;
    finalRef.current = "";
    setTranscript("");
    setError(null);

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
      setTranscript((finalRef.current + " " + interim).trim());
    };
    rec.onerror = (e) => {
      setError(e.error || "Không nhận được giọng nói.");
    };
    rec.onend = () => {
      setListening(false);
      const text = finalRef.current.trim();
      if (text) onFinal(text);
      recRef.current = null;
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch (err) {
      setError(String(err));
    }
  }, [lang, onFinal]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      const rec = recRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {}
      }
    };
  }, []);

  return { supported, listening, transcript, error, start, stop };
}
