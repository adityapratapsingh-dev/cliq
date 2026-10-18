"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Records a voice note with the browser's native MediaRecorder.
 *
 * Returns the recorded Blob (webm/mp4, whatever the browser supports) so the
 * caller can upload it and send it as a normal media message. Nothing is sent
 * until `stop()` resolves.
 */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  /** Pick the best audio container the browser can record. */
  function pickMimeType(): string | undefined {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    for (const type of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
    }
    return undefined;
  }

  const start = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Voice notes aren't supported in this browser.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
          : null;
        resolveRef.current?.(blob);
        resolveRef.current = null;
        cleanup();
      };

      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      return true;
    } catch {
      setError("Microphone access was blocked.");
      cleanup();
      return false;
    }
  }, [cleanup]);

  /** Stop and resolve with the recorded blob (or null if nothing was captured). */
  const stop = useCallback((): Promise<Blob | null> => {
    setRecording(false);
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanup();
      return Promise.resolve(null);
    }
    return new Promise<Blob | null>((resolve) => {
      resolveRef.current = resolve;
      recorder.stop();
    });
  }, [cleanup]);

  /** Abort without producing a blob. */
  const cancel = useCallback(() => {
    setRecording(false);
    resolveRef.current?.(null);
    resolveRef.current = null;
    try {
      recorderRef.current?.stop();
    } catch {
      /* already stopped */
    }
    cleanup();
  }, [cleanup]);

  return { recording, seconds, error, start, stop, cancel };
}

/** mm:ss for a number of seconds. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const secs = s % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/** True when a media URL points at an audio file (a voice note). */
export function isAudioUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(webm|mp3|m4a|mp4|ogg|wav|aac)(\?|$)/i.test(url) && !/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url);
}
