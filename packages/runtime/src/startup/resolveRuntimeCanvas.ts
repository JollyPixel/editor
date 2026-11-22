// Import Internal Dependencies
import { resolveElement } from "../dom/resolveElement.ts";

export type RuntimeCanvasTarget = HTMLCanvasElement | string;

export function resolveRuntimeCanvas(
  target: RuntimeCanvasTarget
): HTMLCanvasElement {
  return resolveElement(target, HTMLCanvasElement);
}
