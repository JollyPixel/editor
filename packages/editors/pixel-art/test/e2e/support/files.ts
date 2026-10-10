// Import Node.js Dependencies
import { Buffer } from "node:buffer";

// Import Third-party Dependencies
import { encodePng } from "@jolly-pixel/image";

// Import Internal Dependencies
import type {
  PixelRect,
  TexturePoint
} from "./canvas.ts";

export interface PngFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export function uniqueName(
  slug: string
): string {
  return `e2e-${slug}-${Date.now()}`;
}

export async function pngFile(
  name: string,
  size: TexturePoint,
  rects: PixelRect[] = []
): Promise<PngFile> {
  const data = new Uint8ClampedArray(size.x * size.y * 4);
  for (const rect of rects) {
    const rgba = Buffer.from(rect.color.slice(1).padEnd(8, "f"), "hex");
    for (let y = rect.y; y < rect.y + (rect.height ?? 1); y++) {
      for (let x = rect.x; x < rect.x + (rect.width ?? 1); x++) {
        data.set(rgba, ((y * size.x) + x) * 4);
      }
    }
  }
  const png = await encodePng({
    width: size.x,
    height: size.y,
    data
  });

  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(png)
  };
}
