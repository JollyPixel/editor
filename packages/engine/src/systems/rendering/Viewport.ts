// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { CanvasDimensions } from "./CanvasDimensions.ts";

export interface RenderViewport {
  /**
   * Normalized [0, 1]. x=0 is left
   */
  x: number;
  /**
   * Normalized [0, 1]. y=0 is bottom (WebGL convention)
   */
  y: number;
  /**
   * Normalized width [0, 1]
   */
  width: number;
  /**
   * Normalized height [0, 1]
   */
  height: number;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Viewport implements Readonly<RenderViewport> {
  static readonly full = new Viewport({
    x: 0,
    y: 0,
    width: 1,
    height: 1
  });

  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;

  constructor(
    rect: Readonly<RenderViewport>
  ) {
    this.x = normalize(rect.x);
    this.y = normalize(rect.y);
    this.width = normalize(rect.width);
    this.height = normalize(rect.height);
  }

  pixels(
    canvas: CanvasDimensions
  ): PixelRect {
    return {
      x: Math.round(this.x * canvas.width),
      y: Math.round(this.y * canvas.height),
      width: Math.round(this.width * canvas.width),
      height: Math.round(this.height * canvas.height)
    };
  }

  aspect(
    canvas: CanvasDimensions
  ): number {
    return (this.width * canvas.width) /
      Math.max(this.height * canvas.height, 1);
  }
}

function normalize(
  value: number
): number {
  return Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 0;
}
