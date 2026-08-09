// Import Third-party Dependencies
import Color from "colorjs.io";

// Import Internal Dependencies
import type { PixelDocument } from "./PixelDocument.ts";
import {
  CanvasRenderer
} from "./rendering/CanvasRenderer.ts";
import {
  OverlayLayer
} from "./rendering/OverlayLayer.ts";
import {
  Viewport
} from "./rendering/Viewport.ts";
import type { ZoomOptions } from "./rendering/Zoom.ts";
import { clamp } from "./utils/math.ts";
import type {
  BrushHighlight,
  ColorInput,
  Vec2
} from "./types.ts";

export interface CanvasViewOptions {
  /**
   * Element the canvas and SVG overlays are mounted into.
   */
  parent: HTMLDivElement;
  zoom?: ZoomOptions;
  /**
   * Canvas color outside texture bounds. When omitted it is resolved from
   * the parent's computed background color, falling back to `#424242`.
   */
  background?: ColorInput;
  backgroundTransparency?: {
    colors: { odd: string; even: string; };
    squareSize: number;
  };
  /**
   * Highlight spec (size + colors) driving the brush/line/selection overlays.
   */
  brushHighlight: BrushHighlight;
}

/**
 * The view: the pixel canvas, its SVG overlays, and the viewport camera. It
 * owns everything needed to paint the current document state
 */
export class CanvasView {
  readonly viewport: Viewport;
  readonly renderer: CanvasRenderer;
  readonly overlays: OverlayLayer;

  constructor(
    doc: PixelDocument,
    options: CanvasViewOptions
  ) {
    const { parent } = options;
    const textureSize = doc.size();

    const initialBounds = parent.getBoundingClientRect();
    const zoomDefault = options.zoom?.default ?? CanvasView.#computeFitZoom(
      initialBounds,
      textureSize,
      { min: options.zoom?.min, max: options.zoom?.max }
    );

    this.viewport = new Viewport({
      textureSize,
      zoom: zoomDefault,
      zoomMin: options.zoom?.min,
      zoomMax: options.zoom?.max,
      zoomSensitivity: options.zoom?.sensitivity
    });

    const computedBackgroundColor = getComputedStyle(parent).backgroundColor;
    const backgroundColor = options.background ?? (
      computedBackgroundColor && new Color(computedBackgroundColor).alpha > 0
        ? computedBackgroundColor
        : "#424242"
    );

    this.renderer = new CanvasRenderer({
      viewport: this.viewport,
      canvasBuffer: doc.buffer,
      bgSquareSize: options.backgroundTransparency?.squareSize,
      bgColors: options.backgroundTransparency?.colors,
      backgroundColor
    });

    this.renderer.appendTo(parent);

    const bounds = parent.getBoundingClientRect();
    this.renderer.resize(bounds.width, bounds.height);
    this.viewport.updateCanvasSize(bounds.width, bounds.height);

    this.overlays = new OverlayLayer({
      parent,
      viewport: this.viewport,
      brush: options.brushHighlight,
      uvMap: doc.uv
    });

    // The view repaints itself when the model's pixels change or the floating
    // selection moves — neither is a camera change, so no overlay refresh is
    // needed, just a redraw.
    doc.onChange(() => this.renderer.drawFrame());
    this.renderer.floatingSelection.on(
      "changed",
      () => this.renderer.drawFrame()
    );
    this.renderer.peerStrokeGhosts.on(
      "changed",
      () => this.renderer.drawFrame()
    );
  }

  get backgroundColor(): string {
    return this.renderer.backgroundColor;
  }

  set backgroundColor(
    color: ColorInput
  ) {
    this.renderer.backgroundColor = color;
  }

  canvas(): HTMLCanvasElement {
    return this.renderer.canvas();
  }

  drawFrame(): void {
    this.renderer.drawFrame();
  }

  resize(
    width: number,
    height: number
  ): void {
    // Resize the canvas and SVG first, then the viewport — its "changed"
    // signal drives the repaint + overlay refresh (see PixelArtCanvas), which
    // must run against the already-resized surfaces.
    this.renderer.resize(width, height);
    this.overlays.resize(width, height);
    this.viewport.resizeCanvas(width, height);
  }

  centerTexture(): void {
    // viewport.centerTexture() emits "changed"; the coordinator subscriber
    // repaints.
    this.viewport.centerTexture();
  }

  reparentTo(
    newParentElement: HTMLDivElement
  ): void {
    this.renderer.reparentTo(newParentElement);
    this.overlays.reparentTo(newParentElement);
  }

  destroy(): void {
    const rendererCanvas = this.renderer.canvas();
    if (rendererCanvas.parentElement) {
      rendererCanvas.remove();
    }
    this.overlays.destroy();
    this.renderer.peerStrokeGhosts.destroy();
  }

  /**
   * Picks a default zoom that fits the whole texture inside the container's
   * initial size, so a large texture in a small container doesn't start
   * zoomed in past what's visible. Only used when `zoom.default` is
   * omitted; an explicit value always wins. Falls back to `Zoom`'s own
   * default (4) when the container has no measurable size yet (e.g.
   * `display: none`).
   */
  static #computeFitZoom(
    containerSize: { width: number; height: number; },
    textureSize: Vec2,
    zoomBounds: { min?: number; max?: number; }
  ): number {
    const zoomMin = zoomBounds.min ?? 1;
    const zoomMax = zoomBounds.max ?? 32;

    if (containerSize.width <= 0 || containerSize.height <= 0) {
      return clamp(4, zoomMin, zoomMax);
    }

    // Leaves a small margin so the texture isn't flush against the edges.
    const kFitPadding = 0.9;
    const fit = Math.min(
      containerSize.width / textureSize.x,
      containerSize.height / textureSize.y
    ) * kFitPadding;

    return clamp(Math.floor(fit), zoomMin, zoomMax);
  }
}
