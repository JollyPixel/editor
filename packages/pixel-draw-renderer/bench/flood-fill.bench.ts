// Import Internal Dependencies
import {
  createBench,
  reportBench
} from "./_harness.ts";
import { PixelBuffer } from "../src/buffer/PixelBuffer.ts";
import { Fill } from "../src/tools/Fill.ts";
import type { RGBA } from "../src/types.ts";

// CONSTANTS
const kWhite: RGBA = { r: 255, g: 255, b: 255, a: 255 };
const kBlack: RGBA = { r: 0, g: 0, b: 0, a: 255 };

/**
 * A uniform (single-color) buffer whose master is sized to the canvas, so the
 * fixture construction cost stays proportional to the region under test.
 */
function uniformBuffer(
  side: number
): PixelBuffer {
  return new PixelBuffer({
    size: { x: side, y: side },
    defaultColor: kWhite,
    maxSize: side
  });
}

/**
 * `Fill` is read-only (it returns positions, it does not mutate), so a single
 * fixture per size can be reused across every iteration. Seeds sit at the
 * center: `PixelBuffer.#fill` forces the origin pixel transparent, so seeding
 * at (0,0) would flood a degenerate 1-pixel region instead of the canvas.
 */
export async function run(): Promise<void> {
  const bench = createBench("Flood fill (tools/Fill)");

  const buffer128 = uniformBuffer(128);
  const buffer256 = uniformBuffer(256);
  const buffer512 = uniformBuffer(512);

  bench
    .add("floodFill / uniform 128x128 (16k px)", () => {
      Fill.floodFill(buffer128, { x: 64, y: 64 }, kBlack);
    })
    .add("floodFill / uniform 256x256 (65k px)", () => {
      Fill.floodFill(buffer256, { x: 128, y: 128 }, kBlack);
    })
    .add("floodFill / uniform 512x512 (262k px)", () => {
      Fill.floodFill(buffer512, { x: 256, y: 256 }, kBlack);
    })
    .add("connectedRegion / 256x256 (65k px)", () => {
      Fill.connectedRegion(buffer256, { x: 128, y: 128 });
    })
    .add("matchAll / 256x256 (all match)", () => {
      Fill.matchAll(buffer256, kWhite);
    })
    .add("matchAll / 512x512 (all match)", () => {
      Fill.matchAll(buffer512, kWhite);
    });

  await reportBench(bench);
}

if (import.meta.main) {
  await run();
}
