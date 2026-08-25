// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { PixelBuffer } from "../src/buffer/PixelBuffer.ts";
import { Fill } from "../src/tools/Fill.ts";
import type {
  RGBA8,
  Vec2
} from "../src/types.ts";

// CONSTANTS
const kWhite: RGBA8 = { r: 255, g: 255, b: 255, a: 255 };
const kBlack: RGBA8 = { r: 0, g: 0, b: 0, a: 255 };

/**
 * Uniform buffer fixture with `maxSize` pinned to the canvas size.
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

function islandBuffer(
  side: number,
  islandSide: number
): PixelBuffer {
  const buffer = new PixelBuffer({
    size: { x: side, y: side },
    defaultColor: kBlack,
    maxSize: side
  });
  const positions: Vec2[] = [];
  const offset = Math.floor((side - islandSide) / 2);

  for (let y = 0; y < islandSide; y++) {
    for (let x = 0; x < islandSide; x++) {
      positions.push({ x: offset + x, y: offset + y });
    }
  }
  buffer.drawPixels(positions, kWhite);

  return buffer;
}

function checkerboardBuffer(
  side: number
): PixelBuffer {
  const buffer = new PixelBuffer({
    size: { x: side, y: side },
    defaultColor: kBlack,
    maxSize: side
  });
  const positions: Vec2[] = [];

  for (let y = 0; y < side; y++) {
    for (let x = y & 1; x < side; x += 2) {
      positions.push({ x, y });
    }
  }
  buffer.drawPixels(positions, kWhite);

  return buffer;
}

/**
 * `Fill` is read-only, so per-scenario fixtures are reused across iterations.
 */
const suite = defineSuite("Flood fill (tools/Fill)", (bench) => {
  const buffer128 = uniformBuffer(128);
  const buffer256 = uniformBuffer(256);
  const buffer512 = uniformBuffer(512);
  const island256 = islandBuffer(256, 64);
  const checkerboard256 = checkerboardBuffer(256);

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
    .add("floodFill / 64x64 island in 256x256", () => {
      Fill.floodFill(island256, { x: 128, y: 128 }, kBlack);
    })
    .add("floodFill / checkerboard 256x256 (1 px)", () => {
      Fill.floodFill(checkerboard256, { x: 128, y: 128 }, kBlack);
    })
    .add("floodFill / same-color no-op 256x256", () => {
      Fill.floodFill(buffer256, { x: 128, y: 128 }, kWhite);
    })
    .add("connectedRegion / 256x256 (65k px)", () => {
      Fill.connectedRegion(buffer256, { x: 128, y: 128 });
    })
    .add("matchAll / 256x256 (all match)", () => {
      Fill.matchAll(buffer256, kWhite);
    })
    .add("matchAll / 512x512 (all match)", () => {
      Fill.matchAll(buffer512, kWhite);
    })
    .add("matchAll / 256x256 (no match)", () => {
      Fill.matchAll(buffer256, kBlack);
    });
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
