// Import Internal Dependencies
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions
} from "#src/PixelArtCanvas.ts";
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import type { Vec2 } from "#src/types.ts";
import {
  canvasPixels,
  readPixel
} from "../fixtures/canvas.ts";
import {
  makeContainer,
  findOverlay
} from "./dom.ts";

// CONSTANTS
const kDefaultTexture = {
  maxSize: 32,
  size: {
    x: 8,
    y: 8
  }
};

export interface TestCanvasOptions extends PixelArtCanvasOptions {
  onCommand?: (command: PixelCommand) => void;
}

export interface CreatedPixelArtCanvas {
  manager: PixelArtCanvas;
  canvas: HTMLCanvasElement;
  overlay: SVGSVGElement;
  container: HTMLDivElement;
}

export function shownPixel(
  manager: PixelArtCanvas,
  texel: Vec2
): [number, number, number, number] {
  const canvas = manager.canvas();
  const screen = manager.viewport.toScreen({
    x: texel.x + 0.5,
    y: texel.y + 0.5
  });

  return readPixel(
    canvasPixels(canvas),
    {
      x: Math.floor(screen.x),
      y: Math.floor(screen.y)
    },
    canvas.width
  );
}

export function createPixelArtCanvas(
  overrides: TestCanvasOptions = {},
  containerSize?: number
): CreatedPixelArtCanvas {
  const container = makeContainer(containerSize);
  const {
    texture,
    onCommand,
    ...rest
  } = overrides;

  const manager = new PixelArtCanvas(container, {
    texture: {
      ...kDefaultTexture,
      ...texture
    },
    ...rest
  });
  if (onCommand) {
    manager.document.on("command", onCommand);
  }

  return {
    manager,
    canvas: manager.canvas(),
    overlay: findOverlay(container),
    container
  };
}
