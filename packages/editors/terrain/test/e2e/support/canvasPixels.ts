// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

export type Rgb = readonly [number, number, number];

export interface CanvasPixels {
  width: number;
  height: number;
  data: number[];
}

// CONSTANTS
const kHideOverlays = "#game-container > :not(canvas) { visibility: hidden !important; }";

export async function captureCanvas(
  canvas: Locator
): Promise<CanvasPixels> {
  const png = await canvas.screenshot({
    style: kHideOverlays,
    scale: "css"
  });

  return canvas.page().evaluate(async(base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const surface = new OffscreenCanvas(image.width, image.height);
    const context = surface.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);

    return {
      width: image.width,
      height: image.height,
      data: [...data]
    };
  }, png.toString("base64"));
}

export function pixelsAround(
  pixels: CanvasPixels,
  centre: { x: number; y: number; },
  radius: number
): CanvasPixels {
  const size = radius * 2 + 1;
  const data: number[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    const offset = ((Math.round(centre.y) + dy) * pixels.width + Math.round(centre.x) - radius) * 4;
    data.push(...pixels.data.slice(offset, offset + size * 4));
  }

  return { width: size, height: size, data };
}

export function averageColor(
  pixels: CanvasPixels
): Rgb {
  const sums = [0, 0, 0];
  for (let index = 0; index < pixels.data.length; index += 4) {
    for (let channel = 0; channel < 3; channel++) {
      sums[channel] += pixels.data[index + channel];
    }
  }
  const count = pixels.data.length / 4;

  return [sums[0] / count, sums[1] / count, sums[2] / count];
}

export function dominantColor(
  pixels: CanvasPixels
): Rgb {
  const { data } = pixels;
  const counts = new Map<number, number>();
  let bestKey = 0;
  let bestCount = 0;
  for (let index = 0; index < data.length; index += 4) {
    const key = (data[index] << 16) | (data[index + 1] << 8) | data[index + 2];
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }

  return [(bestKey >> 16) & 255, (bestKey >> 8) & 255, bestKey & 255];
}

export function countPixelsNear(
  pixels: CanvasPixels,
  color: Rgb,
  tolerance: number
): number {
  const { data } = pixels;
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (
      Math.abs(data[index] - color[0]) <= tolerance &&
      Math.abs(data[index + 1] - color[1]) <= tolerance &&
      Math.abs(data[index + 2] - color[2]) <= tolerance
    ) {
      count++;
    }
  }

  return count;
}
