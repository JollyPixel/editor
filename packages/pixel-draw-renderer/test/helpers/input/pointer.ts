// Import Internal Dependencies
import {
  PointerController,
  type PointerControllerOptions
} from "#src/input/PointerController.ts";
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

export type CreatePointerControllerOptions =
  Omit<PointerControllerOptions, "shouldPanOnPrimary" | "onCtrlWheel"> &
  Partial<Pick<PointerControllerOptions, "shouldPanOnPrimary" | "onCtrlWheel">>;

export function createPointerController(
  options: CreatePointerControllerOptions
): PointerController {
  return new PointerController({
    shouldPanOnPrimary: () => false,
    onCtrlWheel: () => false,
    ...options
  });
}
