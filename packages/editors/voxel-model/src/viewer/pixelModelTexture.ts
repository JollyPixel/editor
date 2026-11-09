// Import Third-party Dependencies
import { PixelCanvasTexture } from "@jolly-pixel/editor.pixel-art/mesh-texturing";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { ModelViewTexture } from "./ModelView.ts";

export interface PixelModelTexture {
  readonly canvas: PixelCanvasTexture;
  readonly texture: ModelViewTexture;
}

export function pixelModelTexture(
  pixels: PixelDocument
): PixelModelTexture {
  const canvas = new PixelCanvasTexture({
    document: pixels,
    get textureSize() {
      return pixels.size();
    },
    textureCanvas: () => pixels.buffer.canvas()
  }, {
    flush: "immediate"
  });

  return {
    canvas,
    texture: {
      map: canvas.texture,
      size: () => pixels.size()
    }
  };
}
