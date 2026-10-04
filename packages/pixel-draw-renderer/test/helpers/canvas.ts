// Import Internal Dependencies
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions
} from "#src/PixelArtCanvas.ts";
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

export interface CreatedPixelArtCanvas {
  manager: PixelArtCanvas;
  canvas: HTMLCanvasElement;
  overlay: SVGSVGElement;
  container: HTMLDivElement;
}

export function createPixelArtCanvas(
  overrides: PixelArtCanvasOptions = {},
  containerSize?: number
): CreatedPixelArtCanvas {
  const container = makeContainer(containerSize);
  const {
    texture,
    ...rest
  } = overrides;

  const manager = new PixelArtCanvas(container, {
    texture: {
      ...kDefaultTexture,
      ...texture
    },
    ...rest
  });

  return {
    manager,
    canvas: manager.canvas(),
    overlay: overlayOf(container),
    container
  };
}
