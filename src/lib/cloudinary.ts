/**
 * Direct-to-Cloudinary media uploads from the browser.
 *
 * Uploads go straight from the client to Cloudinary, bypassing Vercel's request
 * body limit entirely — the server only ever stores the resulting `secure_url`.
 *
 * Configure with:
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME      e.g. "cliq-media"
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET   an *unsigned* upload preset
 *
 * Both are NEXT_PUBLIC_* because the browser performs the upload.
 */

import { compressVideo, formatBytes, isCompressibleVideo, MAX_UPLOAD_BYTES } from "@/lib/video-compress";

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}

export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloudName || !uploadPreset) return null;
  return { cloudName, uploadPreset };
}

export function isCloudinaryConfigured(): boolean {
  return getCloudinaryConfig() !== null;
}

/** Thrown when Cloudinary is not configured, so callers can show setup guidance. */
export class CloudinaryNotConfiguredError extends Error {
  constructor() {
    super(
      "Media uploads are not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.",
    );
    this.name = "CloudinaryNotConfiguredError";
  }
}

export interface UploadResult {
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  resourceType: string;
}

export interface UploadOptions {
  /** Called with 0-100 as the upload progresses. */
  onProgress?: (percent: number) => void;
  /**
   * Called while media is being compressed, before the upload starts. Lets the
   * UI say "Optimising..." rather than showing a stalled 0%.
   */
  onPrepare?: (info: { phase: "compressing"; percent: number; detail: string }) => void;
  /** AbortSignal so the UI can cancel an in-flight upload. */
  signal?: AbortSignal;
  /** Compress before upload (default true). Applies to images and videos. */
  compress?: boolean;
}

/** Thrown when a file is too large to upload at all. */
export class FileTooLargeError extends Error {
  constructor(public readonly bytes: number) {
    super(`That file is ${formatBytes(bytes)}. The maximum upload size is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
    this.name = "FileTooLargeError";
  }
}

const MAX_IMAGE_EDGE = 2048;
const WEBP_QUALITY = 0.8;

/* ------------------------------------------------------------- compression */

/** True for files the canvas pipeline can safely decode and re-encode. */
export function isCompressibleImage(file: File): boolean {
  return /^image\/(jpeg|jpg|png|webp|avif|bmp)$/i.test(file.type);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be read."));
    };
    image.src = url;
  });
}

/**
 * Downscale + re-encode an image to WebP in the browser.
 *
 * Keeps uploads small so they finish fast on mobile data, and normalises every
 * format to WebP. Falls back to the original file if anything goes wrong, so a
 * decode failure never blocks the user.
 */
export async function compressImage(file: File, maxEdge = MAX_IMAGE_EDGE, quality = WEBP_QUALITY): Promise<File> {
  if (!isCompressibleImage(file)) return file;

  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/webp", quality);
  });

  // Only use the compressed version if it actually helped.
  if (!blob || blob.size === 0 || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") || "upload";
  return new File([blob], `${name}.webp`, { type: "image/webp", lastModified: Date.now() });
}

/* -------------------------------------------------------------- uploading */

/**
 * Upload a file to Cloudinary with progress reporting.
 *
 * Uses XMLHttpRequest because `fetch` still cannot report upload progress in
 * any stable browser API.
 */
export function uploadToCloudinary(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  const config = getCloudinaryConfig();
  if (!config) return Promise.reject(new CloudinaryNotConfiguredError());

  const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`;

  return new Promise<UploadResult>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", config.uploadPreset);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let payload: Record<string, unknown> | null = null;
      try {
        payload = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        payload = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload?.secure_url) {
        options.onProgress?.(100);
        resolve({
          secureUrl: String(payload.secure_url),
          publicId: String(payload.public_id ?? ""),
          width: typeof payload.width === "number" ? payload.width : undefined,
          height: typeof payload.height === "number" ? payload.height : undefined,
          bytes: typeof payload.bytes === "number" ? payload.bytes : undefined,
          resourceType: String(payload.resource_type ?? "image"),
        });
        return;
      }

      const message =
        (payload?.error as { message?: string } | undefined)?.message ??
        `Upload failed (${xhr.status || "network error"}).`;
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("Upload failed — check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Please try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort();
        return;
      }
      options.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(form);
  });
}

/**
 * Compress then upload. Returns the permanent `secure_url`.
 * This is the function the UI should call.
 *
 * Images are re-encoded on a canvas (fast, near-instant). Videos are re-recorded
 * through MediaRecorder, which runs in real time — see `video-compress.ts`.
 * Every failure path falls back to the original file so posting never blocks.
 */
export async function uploadMedia(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) throw new FileTooLargeError(file.size);

  const shouldCompress = options.compress !== false;
  let prepared = file;

  if (shouldCompress && isCompressibleImage(file)) {
    prepared = await compressImage(file);
  } else if (shouldCompress && isCompressibleVideo(file)) {
    const result = await compressVideo(file, {
      signal: options.signal,
      onProgress: (percent) =>
        options.onPrepare?.({
          phase: "compressing",
          percent,
          detail: "Compressing video...",
        }),
    });
    prepared = result.file;
  }

  return uploadToCloudinary(prepared, options);
}
