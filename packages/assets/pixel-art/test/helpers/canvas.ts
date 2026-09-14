// Import Third-party Dependencies
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { makeContainer } from "./dom.ts";

export interface CreatedPixelArtCanvas {
  manager: PixelArtCanvas;
  canvas: HTMLCanvasElement;
  container: HTMLDivElement;
  children: HTMLCanvasElement[];
}

// CONSTANTS
const kDefaultTexture = {
  maxSize: 32,
  size: { x: 8, y: 8 }
};

export function asCanvas(
  host: object
): PixelArtCanvas {
  return host as unknown as PixelArtCanvas;
}

export function createPixelArtCanvas(
  overrides: PixelArtCanvasOptions = {},
  containerSize?: number
): CreatedPixelArtCanvas {
  const { container, children } = makeContainer(
    containerSize
  );
  const { texture, ...rest } = overrides;

  const manager = new PixelArtCanvas(container, {
    texture: {
      ...kDefaultTexture,
      ...texture
    },
    ...rest
  });

  return {
    manager,
    canvas: children[0],
    container,
    children
  };
}
