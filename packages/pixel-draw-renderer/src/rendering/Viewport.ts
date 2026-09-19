// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { clamp } from "../utils/math.ts";
import { ViewportTexture } from "./ViewportTexture.ts";
import { Zoom } from "./Zoom.ts";
import type {
  Vec2
} from "../types.ts";

// CONSTANTS
const kFramePadding = 8;

export interface DefaultViewport {
  readonly zoom: Zoom;
  readonly camera: Readonly<Vec2>;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}

export type ViewportEvent = {
  changed: () => void;
  animating: () => void;
};

export interface MouseTexturePositionOptions {
  /**
   * The bounding rectangle of the canvas.
   */
  bounds: DOMRect;
  /**
   * Whether to limit the returned position to the texture bounds.
   * @default false
   */
  limit?: boolean;
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
   * Relative zoom change per mouse-wheel notch at `zoomMin`.
   * @default 0.25
   */
  zoomSensitivity?: number;
  /**
   * Zoom easing time constant in milliseconds; `0` disables easing.
   * @default 50
   */
  zoomSmoothing?: number;
}

interface ZoomAnchor {
  screen: Vec2;
  world: Vec2;
}

export class Viewport extends Emitter<
  ViewportEvent
> implements DefaultViewport {
  #camera: Vec2 = {
    x: 0,
    y: 0
  };
  #texture: ViewportTexture;
  #canvasWidth: number = 0;
  #canvasHeight: number = 0;
  #anchor: ZoomAnchor | null = null;

  readonly zoom: Zoom;

  constructor(
    options: ViewportOptions
  ) {
    super();

    const {
      zoom,
      zoomMin,
      zoomMax,
      zoomSensitivity,
      zoomSmoothing,
      textureSize
    } = options;

    this.zoom = new Zoom({
      default: zoom,
      min: zoomMin,
      max: zoomMax,
      sensitivity: zoomSensitivity,
      smoothing: zoomSmoothing
    });
    this.#texture = new ViewportTexture({
      size: textureSize,
      onResize: (previous) => this.#onTextureResized(previous)
    });
  }

  get camera(): Readonly<Vec2> {
    return this.#camera;
  }

  get texture(): ViewportTexture {
    return this.#texture;
  }

  get canvasWidth(): number {
    return this.#canvasWidth;
  }

  get canvasHeight(): number {
    return this.#canvasHeight;
  }

  updateCanvasSize(
    width: number,
    height: number
  ): void {
    this.#canvasWidth = width;
    this.#canvasHeight = height;
  }

  centerTexture(): void {
    this.#settle();
    this.#frame();
    this.emit("changed");
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

  resizeCanvas(
    width: number,
    height: number
  ): void {
    this.#settle();
    const previousSlack = this.#slack();
    const unsized = this.#canvasWidth === 0 || this.#canvasHeight === 0;
    this.#canvasWidth = width;
    this.#canvasHeight = height;
    if (unsized) {
      this.#frame();
    }
    else {
      this.#reframe(previousSlack);
    }

    this.emit("changed");
  }

  #onTextureResized(
    previous: Readonly<Vec2>
  ): void {
    this.#settle();
    const zoom = this.zoom.value;
    const { x, y } = this.#camera;
    this.#reframe({
      x: this.#canvasWidth - (previous.x * zoom),
      y: this.#canvasHeight - (previous.y * zoom)
    });

    if (
      this.#camera.x !== x ||
      this.#camera.y !== y
    ) {
      this.emit("changed");
    }
  }

  #slack(): Vec2 {
    const texPx = this.#texture.pixelSize(
      this.zoom.value
    );

    return {
      x: this.#canvasWidth - texPx.x,
      y: this.#canvasHeight - texPx.y
    };
  }

  #frame(): void {
    const slack = this.#slack();
    this.#camera.x = frameAxis(slack.x);
    this.#camera.y = frameAxis(slack.y);

    this.clampCamera();
  }

  #reframe(
    previousSlack: Readonly<Vec2>
  ): void {
    const slack = this.#slack();
    this.#camera.x = reframeAxis(
      this.#camera.x,
      previousSlack.x,
      slack.x
    );
    this.#camera.y = reframeAxis(
      this.#camera.y,
      previousSlack.y,
      slack.y
    );

    this.clampCamera();
  }

  #settle(): void {
    this.zoom.settle();
    this.#anchor = null;
  }

  #followAnchor(): void {
    if (this.#anchor === null) {
      return;
    }

    const { screen, world } = this.#anchor;
    const zoom = this.zoom.value;
    this.#camera.x = Math.round(screen.x - (world.x * zoom));
    this.#camera.y = Math.round(screen.y - (world.y * zoom));

    this.clampCamera();
  }

  #anchorAt(
    screen: Vec2
  ): ZoomAnchor {
    const zoom = this.zoom.value;

    return {
      screen,
      world: {
        x: (screen.x - this.#camera.x) / zoom,
        y: (screen.y - this.#camera.y) / zoom
      }
    };
  }

  applyZoom(
    delta: number,
    mx: number,
    my: number
  ): void {
    const wasAnimating = this.zoom.isAnimating;
    this.#anchor = this.#anchorAt({
      x: mx,
      y: my
    });
    this.zoom.applyDelta(delta);

    if (this.zoom.isAnimating) {
      if (!wasAnimating) {
        this.emit("animating");
      }

      return;
    }

    this.#followAnchor();
    this.#anchor = null;
    this.emit("changed");
  }

  update(
    elapsedMs: number
  ): boolean {
    if (!this.zoom.isAnimating) {
      return false;
    }

    const animating = this.zoom.update(elapsedMs);
    this.#followAnchor();
    if (!animating) {
      this.#anchor = null;
    }
    this.emit("changed");

    return animating;
  }

  applyPan(
    dx: number,
    dy: number
  ): void {
    this.#camera.x += dx;
    this.#camera.y += dy;
    this.clampCamera();

    if (this.#anchor !== null) {
      this.#anchor = this.#anchorAt({
        x: this.#anchor.screen.x + dx,
        y: this.#anchor.screen.y + dy
      });
    }
    this.emit("changed");
  }

  visibleCenter(): Vec2 {
    const size = this.#texture.size;
    const zoom = this.zoom.value;

    return {
      x: clamp(
        Math.floor((this.#canvasWidth / 2 - this.#camera.x) / zoom),
        0,
        Math.max(0, size.x - 1)
      ),
      y: clamp(
        Math.floor((this.#canvasHeight / 2 - this.#camera.y) / zoom),
        0,
        Math.max(0, size.y - 1)
      )
    };
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
    parameters: MouseTexturePositionOptions
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

function fitsAxis(
  slack: number
): boolean {
  return slack >= kFramePadding * 2;
}

function frameAxis(
  slack: number
): number {
  return fitsAxis(slack) ? slack / 2 : kFramePadding;
}

function reframeAxis(
  camera: number,
  previousSlack: number,
  slack: number
): number {
  const fits = fitsAxis(slack);
  if (fitsAxis(previousSlack) !== fits) {
    return frameAxis(slack);
  }

  return fits ? camera + ((slack - previousSlack) / 2) : camera;
}
