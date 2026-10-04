// Import Internal Dependencies
import { createCanvas2D } from "../Canvas2D.ts";
import type {
  RGBA8,
  SelectionRect
} from "../../types.ts";

export function buildMaskedFillCanvas(
  rect: SelectionRect,
  mask: readonly boolean[],
  color: RGBA8
): HTMLCanvasElement {
  const {
    canvas,
    context: ctx
  } = createCanvas2D(rect.width, rect.height);

  const imageData = ctx.createImageData(
    rect.width,
    rect.height
  );
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) {
      continue;
    }
    const index = i * 4;
    imageData.data[index] = color.r;
    imageData.data[index + 1] = color.g;
    imageData.data[index + 2] = color.b;
    imageData.data[index + 3] = color.a;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

export function buildMaskedContentCanvas(
  rect: SelectionRect,
  pixels: readonly RGBA8[],
  mask: readonly boolean[]
): HTMLCanvasElement {
  const {
    canvas,
    context: ctx
  } = createCanvas2D(rect.width, rect.height);

  const imageData = ctx.createImageData(
    rect.width,
    rect.height
  );
  for (let i = 0; i < pixels.length; i++) {
    const { r, g, b, a } = pixels[i];
    const index = i * 4;
    imageData.data[index] = r;
    imageData.data[index + 1] = g;
    imageData.data[index + 2] = b;
    imageData.data[index + 3] = mask[i] ? a : 0;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}
