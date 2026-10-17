/**
 * Client-side video compression.
 *
 * Browsers have no "re-encode this file" API, so this uses the standard
 * canvas + MediaRecorder technique:
 *
 *   1. decode the source video into a <video> element
 *   2. draw each frame onto a downscaled <canvas> (this is where resolution is cut)
 *   3. route the audio through Web Audio so it is captured without playing out loud
 *   4. record the combined canvas + audio stream with MediaRecorder
 *
 * IMPORTANT — this is **real-time**: a 60-second clip takes about 60 seconds to
 * compress, because MediaRecorder captures as the video plays. That is why
 * `VIDEO_MAX_DURATION_SECONDS` exists: beyond it, waiting is worse than the
 * storage saved, so we skip compression and upload the original.
 *
 * Every failure path falls back to the original file. Compression must never be
 * the reason a user cannot post.
 */

/**
 * Quality presets.
 *
 * `balanced` is the default and matches the original settings. The other two
 * exist so the size/quality trade-off is explicit rather than guessed at:
 *
 *   dataSaver — roughly half the bitrate of balanced, for slow connections or
 *               when storage is the binding constraint.
 *   high      — closer to the source; still far smaller than an unprocessed
 *               phone clip, which is typically 10-20 Mbps.
 *
 * Lowering `videoBitsPerSecond` is by far the most effective lever: MediaRecorder
 * targets a bitrate, so file size scales almost linearly with it. Reducing
 * resolution helps too, but less than people expect — the encoder spends its
 * budget on whatever detail remains.
 */
export interface VideoPreset {
  label: string;
  maxEdge: number;
  fps: number;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
}

export const VIDEO_PRESETS: Record<"dataSaver" | "balanced" | "high", VideoPreset> = {
  dataSaver: {
    label: "Data saver",
    maxEdge: 854, // 480p
    fps: 24,
    videoBitsPerSecond: 900_000,
    audioBitsPerSecond: 64_000,
  },
  balanced: {
    label: "Balanced",
    maxEdge: 1280, // 720p
    fps: 30,
    videoBitsPerSecond: 1_800_000,
    audioBitsPerSecond: 96_000,
  },
  high: {
    label: "High quality",
    maxEdge: 1920, // 1080p
    fps: 30,
    videoBitsPerSecond: 3_500_000,
    audioBitsPerSecond: 128_000,
  },
};

export type VideoPresetName = keyof typeof VIDEO_PRESETS;

export const DEFAULT_VIDEO_PRESET: VideoPresetName = "balanced";

/**
 * Suggest a preset from the clip's size.
 *
 * The goal is to keep uploads under ~15 MB, which is a reasonable ceiling on
 * mobile data while still looking good on a phone screen.
 */
export function suggestPreset(bytes: number, durationSeconds: number): VideoPresetName {
  const megabytes = bytes / (1024 * 1024);
  // Long clips benefit most from the smaller preset, since size scales with time.
  if (megabytes > 60 || durationSeconds > 90) return "dataSaver";
  if (megabytes < 15 && durationSeconds < 30) return "high";
  return "balanced";
}

/** Long edge cap for the default preset. 1280 ≈ 720p, fine on a phone. */
export const VIDEO_MAX_EDGE = VIDEO_PRESETS.balanced.maxEdge;
export const VIDEO_FPS = VIDEO_PRESETS.balanced.fps;
/** ~1.8 Mbps video — a good size/quality balance for phone-shot clips. */
export const VIDEO_BITRATE = VIDEO_PRESETS.balanced.videoBitsPerSecond;
export const VIDEO_AUDIO_BITRATE = VIDEO_PRESETS.balanced.audioBitsPerSecond;
/** Below this, the wait is not worth the saving. */
export const VIDEO_MIN_SIZE_BYTES = 6 * 1024 * 1024;
/** Real-time cost guard: skip compression for clips longer than this. */
export const VIDEO_MAX_DURATION_SECONDS = 120;
/** Hard cap on any single upload, applied before compression is attempted. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export interface VideoCompressionOptions {
  /** Named preset. Individual options below override it. */
  preset?: VideoPresetName;
  maxEdge?: number;
  fps?: number;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
  maxDurationSeconds?: number;
  minSizeBytes?: number;
  /** Called with 0-100 as the clip is re-encoded. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export interface VideoCompressionResult {
  file: File;
  compressed: boolean;
  /** Why compression was skipped, when it was. */
  reason?: string;
  originalBytes: number;
  bytes: number;
}

export function isCompressibleVideo(file: File): boolean {
  return /^video\//i.test(file.type);
}

/** Even dimensions — most encoders reject odd width/height. */
function toEven(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

/** Pick the first container/codec combination this browser can actually record. */
export function pickVideoMimeType(): string | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264,opus",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

/**
 * Resolve a video's duration.
 *
 * MediaRecorder-produced WebM files (and some Android clips) omit the duration
 * from their header because they were written as a stream, so `video.duration`
 * comes back as `Infinity`/`NaN`. The standard workaround is to seek far past
 * the end, which forces the browser to scan and compute the real duration.
 */
async function resolveDuration(video: HTMLVideoElement, signal?: AbortSignal): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;

  const restore = video.currentTime;
  await new Promise<void>((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    video.addEventListener("seeked", done, { once: true });
    signal?.addEventListener("abort", done, { once: true });
    try {
      // A huge target forces the browser to read to the end of the stream.
      video.currentTime = 1e101;
    } catch {
      done();
    }
    setTimeout(done, 4000);
  });

  const resolved = video.duration;
  try {
    video.currentTime = Number.isFinite(restore) ? restore : 0;
  } catch {
    /* ignore */
  }
  return Number.isFinite(resolved) && resolved > 0 ? resolved : 0;
}

function waitForMetadata(video: HTMLVideoElement, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("That video could not be read."));
    };
    const onAbort = () => {
      cleanup();
      reject(new Error("Compression cancelled."));
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Capture the element's audio without playing it out loud.
 *
 * We deliberately do NOT connect the source to `ctx.destination`; routing it
 * only into a MediaStreamDestination keeps the room silent while recording.
 */
function captureAudioTracks(
  video: HTMLVideoElement,
): { tracks: MediaStreamTrack[]; close: () => void } {
  const AudioCtor =
    typeof window !== "undefined"
      ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;

  if (!AudioCtor) return { tracks: [], close: () => undefined };

  try {
    const ctx = new AudioCtor();
    const source = ctx.createMediaElementSource(video);
    const destination = ctx.createMediaStreamDestination();
    source.connect(destination);
    return {
      tracks: destination.stream.getAudioTracks(),
      close: () => {
        void ctx.close().catch(() => undefined);
      },
    };
  } catch {
    // Some browsers refuse createMediaElementSource after the element has been
    // used elsewhere. Video-only compression is still better than nothing.
    return { tracks: [], close: () => undefined };
  }
}

/**
 * Compress a video file. Always resolves with a usable file — on any failure it
 * returns the original and explains why in `reason`.
 */
export async function compressVideo(
  file: File,
  options: VideoCompressionOptions = {},
): Promise<VideoCompressionResult> {
  const originalBytes = file.size;
  const bail = (reason: string): VideoCompressionResult => ({
    file,
    compressed: false,
    reason,
    originalBytes,
    bytes: originalBytes,
  });

  const chosen = VIDEO_PRESETS[options.preset ?? DEFAULT_VIDEO_PRESET] ?? VIDEO_PRESETS.balanced;
  const {
    maxEdge = chosen.maxEdge,
    fps = chosen.fps,
    videoBitsPerSecond = chosen.videoBitsPerSecond,
    audioBitsPerSecond = chosen.audioBitsPerSecond,
    maxDurationSeconds = VIDEO_MAX_DURATION_SECONDS,
    minSizeBytes = VIDEO_MIN_SIZE_BYTES,
    onProgress,
    signal,
  } = options;

  if (typeof window === "undefined") return bail("Not running in a browser.");
  if (file.size < minSizeBytes) return bail("Already small enough.");
  if (originalBytes > MAX_UPLOAD_BYTES) return bail("File exceeds the upload limit.");

  const mimeType = pickVideoMimeType();
  if (!mimeType) return bail("This browser cannot record video.");

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true; // silent playback; the audio is still captured below
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.src = objectUrl;

  let audio: { tracks: MediaStreamTrack[]; close: () => void } = { tracks: [], close: () => undefined };
  let raf = 0;

  try {
    await waitForMetadata(video, signal);

    const duration = await resolveDuration(video, signal);
    if (duration <= 0) return bail("Unknown video duration.");
    if (duration > maxDurationSeconds) {
      return bail(`Longer than ${maxDurationSeconds}s — uploading the original instead.`);
    }

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) return bail("Video has no readable dimensions.");

    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
    const width = toEven(sourceWidth * scale);
    const height = toEven(sourceHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return bail("Canvas is unavailable.");

    // Frames come from the canvas (so we control resolution); audio from Web Audio.
    const canvasStream = canvas.captureStream(fps);
    audio = captureAudioTracks(video);
    const combined = new MediaStream([...canvasStream.getVideoTracks(), ...audio.tracks]);

    const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond, audioBitsPerSecond });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    const recorded = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      recorder.onerror = () => reject(new Error("Recording failed."));
    });

    const stopEverything = () => {
      cancelAnimationFrame(raf);
      if (recorder.state !== "inactive") recorder.stop();
    };

    signal?.addEventListener("abort", stopEverything, { once: true });

    // Draw frames for as long as the video plays.
    const drawFrame = () => {
      if (video.ended || video.paused) return;
      ctx.drawImage(video, 0, 0, width, height);
      if (onProgress && duration > 0) {
        // Cap at 99 so 100% is only reported once the recorder has flushed.
        onProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)));
      }
      raf = requestAnimationFrame(drawFrame);
    };

    video.addEventListener("ended", stopEverything, { once: true });

    recorder.start(250); // periodic chunks, so memory stays bounded
    await video.play();
    raf = requestAnimationFrame(drawFrame);

    const blob = await recorded;
    onProgress?.(100);

    if (signal?.aborted) return bail("Compression cancelled.");
    if (!blob.size || blob.size >= originalBytes) return bail("Compression would not have saved space.");

    const name = file.name.replace(/\.[^.]+$/, "") || "clip";
    const extension = mimeType.includes("mp4") ? "mp4" : "webm";
    const compressed = new File([blob], `${name}-compressed.${extension}`, {
      type: mimeType,
      lastModified: Date.now(),
    });

    return { file: compressed, compressed: true, originalBytes, bytes: compressed.size };
  } catch (error) {
    return bail(error instanceof Error ? error.message : "Compression failed.");
  } finally {
    cancelAnimationFrame(raf);
    audio.close();
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
  }
}

/** Human-readable size, for progress copy. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
