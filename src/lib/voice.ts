/**
 * Voice-note recording via the browser's MediaRecorder API.
 *
 * Records to webm/opus (or mp4 on Safari), which Cloudinary accepts under its
 * `video` resource type, so the same upload path used for media works here too.
 */

export interface VoiceRecorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
  /** Live elapsed seconds, polled from the component. */
  startedAt: number;
}

export function voiceRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/** Pick a container this browser can actually record. */
export function pickAudioMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

/**
 * Begin recording. Returns a handle with `stop()` (resolves to the audio blob)
 * and `cancel()` (discards it). Throws if permission is denied.
 */
export async function startVoiceRecording(): Promise<VoiceRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickAudioMimeType() ?? "";
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };

  const stopTracks = () => {
    for (const track of stream.getTracks()) track.stop();
  };

  recorder.start(200);

  return {
    startedAt: Date.now(),
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          stopTracks();
          resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        };
        if (recorder.state !== "inactive") recorder.stop();
        else {
          stopTracks();
          resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        }
      }),
    cancel: () => {
      try {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* ignore */
      }
      stopTracks();
    },
  };
}

/** Format seconds as m:ss for the recording timer. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
