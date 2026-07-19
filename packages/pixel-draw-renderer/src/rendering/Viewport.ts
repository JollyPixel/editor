// Import Internal Dependencies
import { clamp } from "../utils/math.ts";
import { ViewportTexture } from "./ViewportTexture.ts";
import { Zoom } from "./Zoom.ts";
import type {
  Vec2
} from "../types.ts";

export interface DefaultViewport {
  readonly zoom: Zoom;
  readonly camera: Readonly<Vec2>;
}

export interface ViewportOptions {
  /**
   * Displayed texture size.
   */
  textureSize: Vec2;
  /**
   * Default zoom level.
   * @default 4
   */
  zoom?: number;
  /**
   * Minimum zoom level.
   * @default 1
   */
  zoomMin?: number;
  /**
   * Maximum zoom level.
   * @default 32
   */
  zoomMax?: number;
  /**
   * Mouse-wheel zoom sensitivity.
   * @default 0.1
   */
  zoomSensitivity?: number;
}

/**
 * Manages viewport camera and zoom state.
 */
export class Viewport implements DefaultViewport {
  #camera: Vec2 = {
    x: 0,
    y: 0
  };
  #texture: ViewportTexture;
  #canvasWidth: number = 0;
  #canvasHeight: number = 0;

  readonly zoom: Zoom;

  constructor(
    options: ViewportOptions
  ) {
    const {
      zoom,
      zoomMin,
      zoomMax,
      zoomSensitivity,
      textureSize
    } = options;

    this.zoom = new Zoom({
      default: zoom,
      min: zoomMin,
      max: zoomMax,
      sensitivity: zoomSensitivity
    });
    this.#texture = new ViewportTexture({
      size: textureSize,
      onResize: () => this.clampCamera()
    });
  }

  get camera(): Readonly<Vec2> {
    return this.#camera;
  }

  get texture(): ViewportTexture {
    return this.#texture;
  }

  updateCanvasSize(
    width: number,
    height: number
  ): void {
    this.#canvasWidth = width;
    this.#canvasHeight = height;
  }

  centerTexture(): void {
    const texPx = this.#texture.pixelSize(
      this.zoom.value
    );
    this.#camera.x = this.#canvasWidth / 2 - texPx.x / 2;
    this.#camera.y = this.#canvasHeight / 2 - texPx.y / 2;

    this.clampCamera();
  }

  clampCamera(): void {
    const texPx = this.#texture.pixelSize(
      this.zoom.value
    );
    const margin = this.zoom.value;

    const minX = -texPx.x + margin;
    const maxX = this.#canvasWidth - margin;
    const minY = -texPx.y + margin;
    const maxY = this.#canvasHeight - margin;

    this.#camera.x = clamp(this.#camera.x, minX, maxX);
    this.#camera.y = clamp(this.#camera.y, minY, maxY);
  }

  /**
   * Resizes the canvas while preserving its center point.
   */
  resizeCanvas(
    width: number,
    height: number
  ): void {
    const dx = (
      width - this.#canvasWidth
    ) / 2;
    const dy = (
      height - this.#canvasHeight
    ) / 2;

    this.#canvasWidth = width;
    this.#canvasHeight = height;
    this.#camera.x += dx;
    this.#camera.y += dy;

    this.clampCamera();
  }

  applyZoom(
    delta: number,
    mx: number,
    my: number
  ): void {
    const oldZoom = this.zoom.value;
    const worldX = (mx - this.#camera.x) / oldZoom;
    const worldY = (my - this.#camera.y) / oldZoom;

    const newZoom = this.zoom.applyDelta(delta);

    this.#camera.x -= worldX * newZoom - worldX * oldZoom;
    this.#camera.y -= worldY * newZoom - worldY * oldZoom;

    this.clampCamera();
  }

  applyPan(
    dx: number,
    dy: number
  ): void {
    this.#camera.x += dx;
    this.#camera.y += dy;
    this.clampCamera();
  }

  mouseCanvasPosition(
    mx: number,
    my: number,
    bounds: DOMRect
  ): Vec2 {
    return {
      x: Math.floor(mx - bounds.left),
      y: Math.floor(my - bounds.top)
    };
  }

  mouseTexturePosition(
    mx: number,
    my: number,
    parameters: { bounds: DOMRect; limit?: boolean; }
  ): Vec2 | null {
    const {
      bounds,
      limit
    } = parameters;

    const x = Math.floor(
      (mx - bounds.left - this.#camera.x) / this.zoom.value
    );
    const y = Math.floor(
      (my - bounds.top - this.#camera.y) / this.zoom.value
    );

    if (limit && !this.#texture.contains({ x, y })) {
      return null;
    }

    return { x, y };
  }
}
