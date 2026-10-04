// Import Internal Dependencies
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import type {
  RGBA8,
  Vec2
} from "#src/types.ts";

export const TEST_MAX_SIZE = 32;
export const COLOR_A: RGBA8 = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};
export const COLOR_B: RGBA8 = {
  r: 0,
  g: 0,
  b: 255,
  a: 255
};
export const FILL_COLOR: RGBA8 = {
  r: 0,
  g: 255,
  b: 0,
  a: 255
};

export function filledBuffer(
  size: Vec2,
  color: RGBA8
): PixelBuffer {
  const buf = new PixelBuffer({
    size,
    maxSize: TEST_MAX_SIZE
  });
  const all: Vec2[] = [];
  for (let y = 0; y < size.y; y++) {
    for (let x = 0; x < size.x; x++) {
      all.push({ x, y });
    }
  }
  buf.drawPixels(
    all,
    color
  );

  return buf;
}

export function sortPositions(
  positions: Vec2[]
): Vec2[] {
  return [...positions].sort(
    (a, b) => (a.y - b.y) || (a.x - b.x)
  );
}
