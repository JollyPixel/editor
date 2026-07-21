// Import Internal Dependencies
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions
} from "#src/PixelArtCanvas.ts";
import { makeContainer } from "./dom.ts";

export interface CreatedPixelArtCanvas {
  manager: PixelArtCanvas;
  canvas: HTMLCanvasElement;
  container: HTMLDivElement;
  children: HTMLCanvasElement[];
}

const kDefaultTexture = {
  maxSize: 32,
  size: { x: 8, y: 8 }
};

/**
 * Builds a container + PixelArtCanvas with sensible defaults (an 8x8
 * texture), so specs only pass the options that actually vary per test.
 */
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
