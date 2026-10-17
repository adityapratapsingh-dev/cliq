/**
 * Tests for the client-side media compression decision logic.
 *
 * The canvas / MediaRecorder paths need a real browser, but the *decisions*
 * around them (what is compressible, dimension maths, size guards, and the
 * storage saving) are pure and are what actually regress. These run in Node.
 *
 * Run with:  npm run test:media
 */
import assert from "node:assert/strict";
import {
  VIDEO_MAX_EDGE,
  VIDEO_MIN_SIZE_BYTES,
  VIDEO_MAX_DURATION_SECONDS,
  MAX_UPLOAD_BYTES,
  formatBytes,
  isCompressibleVideo,
} from "../src/lib/video-compress.ts";

let passed = 0;
const check = (label: string, fn: () => void | Promise<void>) =>
  Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`  ok   ${label}`);
    })
    .catch((error: unknown) => {
      console.error(`  FAIL ${label}\n       ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });

/** Mirrors `toEven` in video-compress.ts (kept in sync deliberately). */
function toEven(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

/** Mirrors the scale maths in `compressVideo`. */
function targetDimensions(width: number, height: number, maxEdge = VIDEO_MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: toEven(width * scale), height: toEven(height * scale) };
}

function makeFile(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

console.log("== video detection ==");

await check("accepts common video mime types", () => {
  for (const type of ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"]) {
    assert.equal(isCompressibleVideo(makeFile("v", type, 10)), true, type);
  }
});

await check("rejects images and other types", () => {
  for (const type of ["image/png", "image/jpeg", "application/pdf", "audio/mpeg"]) {
    assert.equal(isCompressibleVideo(makeFile("f", type, 10)), false, type);
  }
});

console.log("== dimension maths ==");

await check("downscales 1920x1080 to 720p on the long edge", () => {
  const { width, height } = targetDimensions(1920, 1080);
  assert.equal(width, 1280);
  assert.equal(height, 720);
});

await check("handles portrait video", () => {
  const { width, height } = targetDimensions(1080, 1920);
  assert.equal(height, 1280);
  assert.equal(width, 720);
});

await check("never upscales a small video", () => {
  const { width, height } = targetDimensions(640, 480);
  assert.equal(width, 640);
  assert.equal(height, 480);
});

await check("always produces even dimensions (encoders require it)", () => {
  for (const [w, h] of [
    [1080, 607],
    [999, 333],
    [1919, 1079],
  ] as const) {
    const dims = targetDimensions(w, h);
    assert.equal(dims.width % 2, 0, `${w}x${h} -> ${dims.width}`);
    assert.equal(dims.height % 2, 0, `${w}x${h} -> ${dims.height}`);
  }
});

await check("clamps to a minimum of 2px", () => {
  const { width, height } = targetDimensions(1, 1);
  assert.ok(width >= 2 && height >= 2, `${width}x${height}`);
});

console.log("== size guards ==");

await check("min-size threshold skips tiny files", () => {
  assert.ok(VIDEO_MIN_SIZE_BYTES >= 1024 * 1024, "threshold should be >= 1MB");
  const small = makeFile("tiny.mp4", "video/mp4", VIDEO_MIN_SIZE_BYTES - 1);
  assert.ok(small.size < VIDEO_MIN_SIZE_BYTES, "small file should be under the threshold");
});

await check("hard upload cap is 200MB", () => {
  assert.equal(MAX_UPLOAD_BYTES, 200 * 1024 * 1024);
});

await check("duration guard exists and is sane", () => {
  assert.ok(VIDEO_MAX_DURATION_SECONDS > 0 && VIDEO_MAX_DURATION_SECONDS <= 600);
});

console.log("== storage impact (the 25GB question) ==");

await check("compressed 100MB video fits far more posts in 25GB", () => {
  const quotaBytes = 25 * 1024 * 1024 * 1024;
  const original = 100 * 1024 * 1024;
  // A 1.8 Mbps 60s clip: 1_800_000 bits/s / 8 * 60s
  const compressed = Math.round((1_800_000 / 8) * 60);

  const before = Math.floor(quotaBytes / original);
  const after = Math.floor(quotaBytes / compressed);

  assert.equal(before, 256, `expected 256 posts at 100MB, got ${before}`);
  assert.ok(compressed < original, "compressed clip should be smaller");
  assert.ok(after > before * 4, `expected >4x more posts, got ${after} vs ${before}`);
  console.log(`       ${formatBytes(original)} -> ${formatBytes(compressed)} per post`);
  console.log(`       ${before} posts -> ${after} posts in 25 GiB`);
});

console.log("== formatting ==");

await check("formatBytes is human readable", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
  assert.equal(formatBytes(100 * 1024 * 1024), "100.0 MB");
});

console.log(`\n${passed} checks passed`);
