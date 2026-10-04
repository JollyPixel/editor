// Import Internal Dependencies
import { CanvasBuffer } from "#src/buffer/CanvasBuffer.ts";
import { SelectionEraseColor } from "#src/selection/SelectionEraseColor.ts";
import type { RGBA8 } from "#src/types.ts";

// CONSTANTS
const kTestMaxSize = 32;

export const FLOATING_SOURCE_RED: RGBA8 = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};
export const FLOATING_SOURCE_BLUE: RGBA8 = {
  r: 0,
  g: 0,
  b: 255,
  a: 255
};
export const FLOATING_ERASE_COLOR = new SelectionEraseColor({
  r: 9,
  g: 9,
  b: 9,
  a: 255
});

export function makeFloatingSourceBuffer(): CanvasBuffer {
  const buf = new CanvasBuffer({
    size: {
      x: 8,
      y: 8
    },
    maxSize: kTestMaxSize
  });
  buf.drawPixels([
    { x: 0, y: 0 }
  ], FLOATING_SOURCE_RED);
  buf.drawPixels([
    { x: 1, y: 0 }
  ], FLOATING_SOURCE_BLUE);

  return buf;
}
