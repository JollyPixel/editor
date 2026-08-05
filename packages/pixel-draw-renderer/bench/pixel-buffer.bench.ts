// Import Internal Dependencies
import {
  createBench,
  mulberry32,
  randomColor,
  randomPositions,
  reportBench
} from "./_harness.ts";
import { PixelBuffer } from "../src/buffer/PixelBuffer.ts";
import type { RGBA } from "../src/types.ts";

// CONSTANTS
const kBlack: RGBA = { r: 0, g: 0, b: 0, a: 255 };

/**
 * Covers edit-path primitives: construction (`#fill` over `maxSize²`),
 * `copyToMaster`, `drawPixels`, `resize`, and snapshot clone cost.
 */
export async function run(): Promise<void> {
  const bench = createBench("PixelBuffer (buffer/PixelBuffer)");

  const rng = mulberry32();

  const buffer256 = new PixelBuffer({ size: { x: 256, y: 256 }, maxSize: 256 });
  const buffer512 = new PixelBuffer({ size: { x: 512, y: 512 }, maxSize: 512 });
  const resizeSource = new PixelBuffer({ size: { x: 1024, y: 1024 } });

  const stroke64 = randomPositions(64, { x: 256, y: 256 }, rng);
  const stroke1024 = randomPositions(1024, { x: 256, y: 256 }, rng);
  const color = randomColor(rng);

  bench
    .add(
      "construct / 256x256, default maxSize 2048 (16.7M-cell #fill)",
      () => new PixelBuffer({ size: { x: 256, y: 256 } })
    )
    .add(
      "construct / 256x256, maxSize 256 (baseline)",
      () => new PixelBuffer({ size: { x: 256, y: 256 }, maxSize: 256 })
    )
    .add("copyToMaster / 256x256", () => {
      buffer256.copyToMaster();
    })
    .add("copyToMaster / 512x512", () => {
      buffer512.copyToMaster();
    })
    .add("drawPixels / 64-px stroke", () => {
      buffer256.drawPixels(stroke64, color);
    })
    .add("drawPixels / 1024-px stroke", () => {
      buffer256.drawPixels(stroke1024, color);
    })
    .add("drawPixels + copyToMaster / 64-px commit", () => {
      buffer256.drawPixels(stroke64, kBlack);
      buffer256.copyToMaster();
    })
    .add("resize / 1024x1024 -> 512x512", () => {
      resizeSource.resize({ x: 512, y: 512 });
    })
    .add("samplePixels / 1024 positions (history before-colors)", () => {
      buffer256.samplePixels(stroke1024);
    })
    .add("snapshot clone / Uint8ClampedArray.from 512x512", () => {
      Uint8ClampedArray.from(buffer512.pixels());
    });

  await reportBench(bench);
}

if (import.meta.main) {
  await run();
}
