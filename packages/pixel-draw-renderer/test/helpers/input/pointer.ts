// Import Internal Dependencies
import { Viewport } from "#src/rendering/Viewport.ts";

export function makeCenteredViewport(): Viewport {
  const viewport = new Viewport({
    textureSize: {
      x: 16,
      y: 16
    },
    zoom: 4
  });
  viewport.updateCanvasSize(
    200,
    200
  );
  viewport.centerTexture();

  return viewport;
}
