// Import Internal Dependencies
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions
} from "#src/PixelArtCanvas.ts";
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import {
  makeContainer,
  overlayOf
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
    overlay: overlayOf(container),
    container
  };
}
