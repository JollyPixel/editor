// Import Internal Dependencies
import type {
  RGBA,
  Vec2
} from "../types.ts";
import type { DefaultPixelBuffer } from "../buffer/types.ts";

function isInBounds(
  point: Vec2,
  size: Vec2
): boolean {
  return Number.isInteger(point.x) &&
    Number.isInteger(point.y) &&
    point.x >= 0 && point.x < size.x &&
    point.y >= 0 && point.y < size.y;
}

function connectedRegion(
  pixels: Uint8ClampedArray,
  size: Vec2,
  seed: Vec2
): Vec2[] {
  const { x: width, y: height } = size;
  const seedIndex = (seed.y * width) + seed.x;
  const seedByteIndex = seedIndex * 4;
  const tr = pixels[seedByteIndex];
  const tg = pixels[seedByteIndex + 1];
  const tb = pixels[seedByteIndex + 2];
  const ta = pixels[seedByteIndex + 3];
  const visited = new Uint8Array(width * height);
  const positions: Vec2[] = [];
  const stack = new Uint32Array(width * height);
  let stackSize = 1;
  stack[0] = seedIndex;
  visited[seedIndex] = 1;

  while (stackSize > 0) {
    const pointIndex = stack[--stackSize];
    const byteIndex = pointIndex * 4;
    if (
      pixels[byteIndex] !== tr ||
      pixels[byteIndex + 1] !== tg ||
      pixels[byteIndex + 2] !== tb ||
      pixels[byteIndex + 3] !== ta
    ) {
      continue;
    }

    const x = pointIndex % width;
    const y = Math.floor(pointIndex / width);
    positions.push({ x, y });

    let neighbor: number;
    if (x + 1 < width) {
      neighbor = pointIndex + 1;
      if (visited[neighbor] === 0) {
        visited[neighbor] = 1;
        stack[stackSize++] = neighbor;
      }
    }
    if (x > 0) {
      neighbor = pointIndex - 1;
      if (visited[neighbor] === 0) {
        visited[neighbor] = 1;
        stack[stackSize++] = neighbor;
      }
    }
    if (y + 1 < height) {
      neighbor = pointIndex + width;
      if (visited[neighbor] === 0) {
        visited[neighbor] = 1;
        stack[stackSize++] = neighbor;
      }
    }
    if (y > 0) {
      neighbor = pointIndex - width;
      if (visited[neighbor] === 0) {
        visited[neighbor] = 1;
        stack[stackSize++] = neighbor;
      }
    }
  }

  return positions;
}

export class Fill {
  static floodFill(
    buffer: DefaultPixelBuffer,
    seed: Vec2,
    fillColor: RGBA
  ): Vec2[] {
    const size = buffer.size();
    if (!isInBounds(seed, size)) {
      return [];
    }

    const pixels = buffer.pixels();
    const seedIndex = ((seed.y * size.x) + seed.x) * 4;
    if (
      pixels[seedIndex] === fillColor.r &&
      pixels[seedIndex + 1] === fillColor.g &&
      pixels[seedIndex + 2] === fillColor.b &&
      pixels[seedIndex + 3] === fillColor.a
    ) {
      return [];
    }

    return connectedRegion(pixels, size, seed);
  }

  /**
   * Uses four-connectivity from the seed pixel.
   */
  static connectedRegion(
    buffer: DefaultPixelBuffer,
    seed: Vec2
  ): Vec2[] {
    const size = buffer.size();
    if (!isInBounds(seed, size)) {
      return [];
    }

    return connectedRegion(buffer.pixels(), size, seed);
  }

  static matchAll(
    buffer: DefaultPixelBuffer,
    color: RGBA
  ): Vec2[] {
    const size = buffer.size();
    const pixels = buffer.pixels();
    const positions: Vec2[] = [];
    let byteIndex = 0;

    for (let y = 0; y < size.y; y++) {
      for (let x = 0; x < size.x; x++) {
        if (
          pixels[byteIndex] === color.r &&
          pixels[byteIndex + 1] === color.g &&
          pixels[byteIndex + 2] === color.b &&
          pixels[byteIndex + 3] === color.a
        ) {
          positions.push({ x, y });
        }
        byteIndex += 4;
      }
    }

    return positions;
  }
}
