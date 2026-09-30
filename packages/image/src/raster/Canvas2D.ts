// Import Internal Dependencies
import type { DecodedImage } from "../types.ts";

export interface Canvas2D {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
}

export function createCanvas2D(
  width: number,
  height: number
): Canvas2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", {
    willReadFrequently: true
  });
  if (context === null) {
    throw new Error(
      "Unable to acquire a 2D canvas context"
    );
  }
  context.imageSmoothingEnabled = false;

  return {
    canvas,
    context
  };
}

export function canvasFromRaster(
  image: DecodedImage
): Canvas2D {
  const { width, height, data } = image;
  const canvas2D = createCanvas2D(width, height);
  const imageData = canvas2D.context.createImageData(width, height);
  imageData.data.set(data);
  canvas2D.context.putImageData(imageData, 0, 0);

  return canvas2D;
}

export function rasterFromCanvas(
  canvas2D: Canvas2D
): DecodedImage {
  const { width, height } = canvas2D.canvas;

  return {
    width,
    height,
    data: canvas2D.context.getImageData(0, 0, width, height).data
  };
}
