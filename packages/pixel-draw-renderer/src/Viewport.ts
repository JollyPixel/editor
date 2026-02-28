// Import Internal Dependencies
import type { DefaultViewport, Vec2 } from "./types.ts";

export interface ViewportOptions {
  /**
   * Size of the texture to display in the viewport.
   * This is used to calculate the camera bounds and the zoom level.
   */
  textureSize: Vec2;
  /**
   * Default zoom level.
   * Can be overridden by passing a texture with a different size than the default one.
   * @default 4
   */
  zoom?: number;
  /**
   * Minimum zoom level. Must be under the max zoom level.
   * @default 1
   */
  zoomMin?: number;
  /**
   * Maximum zoom level. Must be above the min zoom level.
   * @default 32
   */
  zoomMax?: number;
  /**
   * Sensitivity of zooming when using the mouse wheel. The higher, the faster the zoom changes.
   * If the zoom level is under 1, the sensitivity is divided by 10 to allow finer control.
   * @default 0.1
   */
  zoomSensitivity?: number;
}

/**
 * Viewport manages the camera position and zoom level for a pixel drawing application.
 * It provides methods to convert between screen coordinates and texture coordinates, as well as to apply zooming and panning transformations.
 */
export class Viewport implements DefaultViewport {
  #camera: Vec2 = {
    x: 0,
    y: 0
  };
  #zoom: number;
  #zoomMin: number;
  #zoomMax: number;
  #zoomSensitivity: number;
  #textureSize: Vec2;
  #canvasWidth: number = 0;
  #canvasHeight: number = 0;

  constructor(
    options: ViewportOptions
  ) {
    const {
      zoom = 4,
      zoomMin = 1,
      zoomMax = 32,
      zoomSensitivity = 0.1,
      textureSize
    } = options;

    this.#zoomMin = zoomMin;
    this.#zoomMax = zoomMax;

    if (this.#zoomMax < this.#zoomMin) {
      throw new Error(`Max zoom (${this.#zoomMax}) can't be under min zoom (${this.#zoomMin})`);
    }

    this.#zoom = Math.max(this.#zoomMin, Math.min(this.#zoomMax, zoom));
    this.#zoomSensitivity = zoomSensitivity;
    this.#textureSize = structuredClone(textureSize);
  }

  get zoom(): number {
    return this.#zoom;
  }

  get camera(): Readonly<Vec2> {
    return this.#camera;
  }

  getTexturePixelSize(): Vec2 {
    return {
      x: this.#textureSize.x * this.#zoom,
      y: this.#textureSize.y * this.#zoom
    };
  }

  updateCanvasSize(
    width: number,
    height: number
  ): void {
    this.#canvasWidth = width;
    this.#canvasHeight = height;
  }

  setTextureSize(
    size: Vec2
  ): void {
    this.#textureSize = structuredClone(size);
  }

  centerTexture(): void {
    const texPx = this.getTexturePixelSize();
    this.#camera.x = this.#canvasWidth / 2 - texPx.x / 2;
    this.#camera.y = this.#canvasHeight / 2 - texPx.y / 2;
    this.clampCamera();
  }

  clampCamera(): void {
    const texPx = this.getTexturePixelSize();
    const margin = this.#zoom;

    const minX = -texPx.x + margin;
    const maxX = this.#canvasWidth - margin;
    const minY = -texPx.y + margin;
    const maxY = this.#canvasHeight - margin;

    this.#camera.x = Math.max(minX, Math.min(maxX, this.#camera.x));
    this.#camera.y = Math.max(minY, Math.min(maxY, this.#camera.y));
  }

  /**
   * Updates the canvas size while preserving the current camera position.
   * Shifts the camera by half the size delta so the same world point stays
   * at the center of the screen. Use this for interactive resizes.
   */
  resizeCanvas(
    width: number,
    height: number
  ): void {
    const dx = (width - this.#canvasWidth) / 2;
    const dy = (height - this.#canvasHeight) / 2;
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
    const worldX = (mx - this.#camera.x) / this.#zoom;
    const worldY = (my - this.#camera.y) / this.#zoom;

    const signDelta = Math.sign(delta);
    const smoothSensitivity =
      this.#zoom - signDelta * this.#zoomSensitivity < 1 || this.#zoom < 1
        ? this.#zoomSensitivity / 10
        : this.#zoomSensitivity;

    const newZoom = Math.max(
      this.#zoomMin,
      Math.min(this.#zoomMax, this.#zoom - signDelta * smoothSensitivity)
    );

    this.#camera.x -= worldX * newZoom - worldX * this.#zoom;
    this.#camera.y -= worldY * newZoom - worldY * this.#zoom;
    this.#zoom = newZoom;

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

  getMouseCanvasPosition(
    mx: number,
    my: number,
    bounds: DOMRect
  ): Vec2 {
    return {
      x: Math.floor(mx - bounds.left),
      y: Math.floor(my - bounds.top)
    };
  }

  getMouseTexturePosition(
    mx: number,
    my: number,
    parameters: { bounds: DOMRect; limit?: boolean; }
  ): Vec2 | null {
    const { bounds, limit } = parameters;
    const x = Math.floor((mx - bounds.left - this.#camera.x) / this.#zoom);
    const y = Math.floor((my - bounds.top - this.#camera.y) / this.#zoom);

    if (limit) {
      if (x < 0 || x >= this.#textureSize.x || y < 0 || y >= this.#textureSize.y) {
        return null;
      }
    }

    return { x, y };
  }
}
