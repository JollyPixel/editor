// Import Third-party Dependencies
import Color from "colorjs.io";
import {
  fromUint8Array,
  toUint8Array
} from "js-base64";

// Import Internal Dependencies
import {
  Brush,
  type BrushOptions
} from "./tools/Brush.ts";
import {
  BrushController
} from "./tools/BrushController.ts";
import {
  CanvasBuffer
} from "./buffer/CanvasBuffer.ts";
import {
  CanvasRenderer
} from "./rendering/CanvasRenderer.ts";
import {
  Fill
} from "./tools/Fill.ts";
import {
  InputController,
  type InputActions,
  type WindowLike
} from "./InputController.ts";
import {
  LineController
} from "./tools/LineController.ts";
import {
  SelectController
} from "./tools/SelectController.ts";
import {
  SvgManager
} from "./rendering/SvgManager.ts";
import {
  Viewport,
  type DefaultViewport
} from "./rendering/Viewport.ts";
import { rgbToHex, toRGBA } from "./utils/colors.ts";
import type {
  BrushHighlight,
  ColorInput,
  Mode,
  RGBA,
  Vec2
} from "./types.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "./buffer/hooks.ts";

export type { Mode };

export interface CanvasManagerOptions {
  /**
   * Default interaction mode for the canvas.
   * "paint" for drawing, "move" for panning, or "fill" for the paint-bucket
   * flood-fill tool. If not specified, the default mode will be "paint".
   */
  defaultMode?: Mode;
  /**
   * Global event target used by InputController for drag-continuation
   * mouse tracking and keyboard/blur reporting.
   * @default window
   */
  window?: WindowLike;
  texture?: {
    defaultColor?: ColorInput;
    size?: {
      x: number;
      y?: number;
    };
    maxSize?: number;
    init?: HTMLCanvasElement;
  };
  zoom?: {
    default: number;
    sensitivity?: number;
    min?: number;
    max?: number;
  };
  backgroundTransparency?: {
    colors: { odd: string; even: string; };
    squareSize: number;
  };
  brush?: BrushOptions;
  select?: {
    /**
     * Color used to fill the pixels vacated by a Delete or the source side
     * of a Move in "select" mode. Accepts a CSS color string or a colorjs.io
     * `Color` instance.
     * @default "#FFFFFF"
     */
    eraseColor?: ColorInput;
  };
  /**
   * Called after a draw stroke is committed to the master buffer.
   * Use this hook to synchronize the edited texture with an external consumer.
   */
  onDrawEnd?: () => void;
  /**
   * Called for every local mutation (stroke, resize, texture replace).
   * Used by PixelSyncSession to forward mutations over the network.
   */
  onBufferUpdated?: PixelBufferHookListener;
}

export class CanvasManager {
  #parentHtmlElement: HTMLDivElement;
  #viewport: Viewport;
  #canvasBuffer: CanvasBuffer;
  #renderer: CanvasRenderer;
  #input: InputController;
  #svgManager: SvgManager;

  #onBufferUpdated?: PixelBufferHookListener;
  #onDrawEnd?: () => void;
  #isApplyingRemote = false;
  #mode: Mode;
  #brushController: BrushController;
  #lineController: LineController;
  #selectController: SelectController;

  readonly brush: Brush;
  readonly viewport: DefaultViewport;

  constructor(
    parentHtmlElement: HTMLDivElement,
    options: CanvasManagerOptions = {}
  ) {
    this.#parentHtmlElement = parentHtmlElement;
    this.#onBufferUpdated = options.onBufferUpdated;
    this.#onDrawEnd = options.onDrawEnd;
    this.#mode = options.defaultMode ?? "paint";
    const eraseColor = toRGBA(options.select?.eraseColor ?? "#FFFFFF");

    const textureSize: Vec2 = options.texture?.size
      ? { x: options.texture.size.x, y: options.texture.size.y ?? options.texture.size.x }
      : { x: 64, y: 32 };

    this.#viewport = new Viewport({
      textureSize,
      zoom: options.zoom?.default,
      zoomMin: options.zoom?.min,
      zoomMax: options.zoom?.max,
      zoomSensitivity: options.zoom?.sensitivity
    });
    this.viewport = this.#viewport;

    this.#canvasBuffer = new CanvasBuffer({
      size: textureSize,
      defaultColor: options.texture?.defaultColor,
      maxSize: options.texture?.maxSize
    });

    if (options.texture?.init) {
      this.#canvasBuffer.setTexture(options.texture.init);
    }

    const computedBackgroundColor = getComputedStyle(parentHtmlElement).backgroundColor;
    const backgroundColor = computedBackgroundColor && new Color(computedBackgroundColor).alpha > 0
      ? computedBackgroundColor
      : "#555555";

    this.#renderer = new CanvasRenderer({
      viewport: this.#viewport,
      canvasBuffer: this.#canvasBuffer,
      bgSquareSize: options.backgroundTransparency?.squareSize,
      bgColors: options.backgroundTransparency?.colors,
      backgroundColor
    });

    this.#renderer.appendTo(parentHtmlElement);

    const bounds = parentHtmlElement.getBoundingClientRect();
    this.#renderer.resize(bounds.width, bounds.height);
    this.#viewport.updateCanvasSize(bounds.width, bounds.height);

    this.brush = new Brush(options.brush);

    const brushRef = this.brush;
    const viewportRef: DefaultViewport = this.#viewport;

    const brushAdapter: BrushHighlight = {
      get size() {
        return brushRef.getSize();
      },
      get colorInline() {
        return brushRef.getColorInline();
      },
      get colorOutline() {
        return brushRef.getColorOutline();
      }
    };

    this.#svgManager = new SvgManager({
      parent: parentHtmlElement,
      viewport: viewportRef,
      brush: brushAdapter
    });

    this.#brushController = new BrushController({
      brush: this.brush,
      canvasBuffer: this.#canvasBuffer,
      renderer: this.#renderer,
      onCommit: (pixels, color) => {
        this.#emitHook({
          action: "stroke",
          metadata: { color, positions: pixels }
        });
        this.#onDrawEnd?.();
      }
    });

    this.#lineController = new LineController({
      brush: this.brush,
      linePreview: this.#svgManager.linePreview,
      onCommit: (pixels) => this.commitPixels(pixels)
    });

    this.#selectController = new SelectController({
      canvasBuffer: this.#canvasBuffer,
      renderer: this.#renderer,
      selectionOverlay: this.#svgManager.selection,
      eraseColor,
      onCommit: () => this.#onDrawEnd?.()
    });

    this.#input = new InputController({
      canvas: this.#renderer.getCanvas(),
      viewport: this.#viewport,
      window: options.window,
      actions: this.#buildInputActions()
    });

    this.centerTexture();
  }

  /**
   * Translates InputController's mode-agnostic pointer/keyboard actions into
   * calls onto the brush/line/select controllers, routed by the current
   * `Mode` — InputController itself has no concept of what a primary-button
   * drag means. Broken out from the constructor purely to keep the
   * constructor readable as a flat sequence of collaborator wiring.
   */
  #buildInputActions(): InputActions {
    return {
      onPrimaryDown: (tx, ty) => {
        switch (this.#mode) {
          case "paint":
            if (
              this.#lineController.isArmed &&
              this.#lineController.commitTrigger === "mousedown"
            ) {
              this.#lineController.commit();

              return false;
            }

            this.#brushController.startStroke(tx, ty);

            return true;

          case "fill":
            this.#fill(tx, ty);

            return false;

          case "select":
            this.#selectController.handleStart({ x: tx, y: ty });

            return true;

          default:
            return false;
        }
      },
      onPrimaryMove: (tx, ty) => {
        switch (this.#mode) {
          case "paint":
            this.#brushController.continueStroke(tx, ty);
            break;

          case "select":
            this.#selectController.handleMove({ x: tx, y: ty });
            break;

          default:
        }
      },
      onPrimaryUp: () => {
        switch (this.#mode) {
          case "paint":
            this.#brushController.endStroke();
            break;

          case "select":
            this.#selectController.handleEnd();
            break;

          default:
        }
      },
      onPanStart: (_mx, _my) => {
        // pan tracking is inside InputController
      },
      onPanMove: (dx, dy) => {
        this.#viewport.applyPan(dx, dy);
        this.#renderer.drawFrame();
        this.#lineController.refreshPreview();
        this.#selectController.refreshOverlay();
      },
      onPanEnd: () => {
        // nothing extra needed
      },
      onZoom: (delta, cx, cy) => {
        this.#viewport.applyZoom(delta, cx, cy);
        this.#renderer.drawFrame();
        this.#lineController.refreshPreview();
        this.#selectController.refreshOverlay();
      },
      onColorPick: (tx, ty) => {
        if (this.#mode !== "paint") {
          return;
        }

        const [r, g, b, a] = this.#canvasBuffer.samplePixel(tx, ty);
        const hex = rgbToHex(r, g, b);
        const opacity = a / 255;
        this.brush.setColor(hex, opacity);

        const event = new CustomEvent("colorpicked", {
          detail: { hex, opacity },
          bubbles: true,
          composed: true
        });
        this.#renderer.getCanvas().dispatchEvent(event);
      },
      onMouseMove: (cx, cy) => {
        if (cx < 0 || cy < 0) {
          this.#svgManager.brushHighlight.update(null, null);
        }
        else if (this.#mode === "paint") {
          this.#svgManager.brushHighlight.update(cx, cy);
        }
      },
      onCursorMove: (pos) => {
        this.#lineController.updateCursor(pos);
      },
      onMouseUp: () => {
        if (
          this.#lineController.isArmed &&
          this.#lineController.commitTrigger === "mouseup"
        ) {
          this.#lineController.commit();
        }
      },
      onShiftDown: () => {
        this.#lineController.setShiftHeld(true);
        if (this.#mode !== "paint") {
          return;
        }

        if (this.#brushController.isActive) {
          // Mouse button already held: no future mousedown to commit on,
          // so the line commits on the eventual mouseup instead.
          this.#input.stopDrawing();
          this.#brushController.endStroke();
          this.#lineController.arm("mouseup");

          return;
        }

        this.#lineController.arm("mousedown");
      },
      onShiftUp: () => {
        this.#lineController.setShiftHeld(false);
        this.#lineController.cancelIfArmed();
      },
      onBlur: () => {
        this.#lineController.setShiftHeld(false);
        this.#lineController.cancelIfArmed();
      },
      onCopy: () => this.#selectController.handleCopy(),
      onPaste: () => this.#selectController.handlePaste(),
      onDelete: () => this.#selectController.handleDelete()
    };
  }

  getMode(): Mode {
    return this.#mode;
  }

  setMode(
    mode: Mode
  ): void {
    this.#mode = mode;
    if (mode === "move") {
      this.#svgManager.brushHighlight.hide();
      this.#lineController.cancelIfArmed();
    }
    if (mode !== "select") {
      this.#selectController.clear();
    }
  }

  getParentHtmlElement(): HTMLDivElement {
    return this.#parentHtmlElement;
  }

  reparentCanvasTo(
    newParentElement: HTMLDivElement
  ): void {
    if (!newParentElement) {
      console.error("CanvasManager: Invalid parent element");

      return;
    }

    this.#renderer.reparentTo(newParentElement);
    this.#svgManager.reparentSvgTo(newParentElement);
    this.#parentHtmlElement = newParentElement;
    this.onResize();
  }

  getTextureSize(): Vec2 {
    return this.#canvasBuffer.getSize();
  }

  setTextureSize(
    size: Vec2
  ): void {
    if (
      size.x <= 0 ||
      size.y <= 0
    ) {
      console.error("CanvasManager: Texture size must be positive");

      return;
    }

    this.#canvasBuffer.setSize(size);
    this.#viewport.setTextureSize(size);
    this.#renderer.drawFrame();

    this.#emitHook({
      action: "resized",
      metadata: {
        size: structuredClone(size)
      }
    });
  }

  getCamera(): Vec2 {
    return { ...this.#viewport.camera };
  }

  getZoom(): number {
    return this.#viewport.zoom;
  }

  getZoomSensitivity(): number {
    return this.#viewport.zoomSensitivity;
  }

  setZoomSensitivity(
    sensitivity: number
  ): void {
    this.#viewport.setZoomSensitivity(sensitivity);
  }

  centerTexture(): void {
    this.#viewport.centerTexture();
    this.#renderer.drawFrame();
  }

  onResize(): void {
    const bounds = this.#parentHtmlElement.getBoundingClientRect();

    if (
      bounds.width === 0 ||
      bounds.height === 0
    ) {
      return;
    }

    this.#renderer.resize(bounds.width, bounds.height);
    this.#viewport.resizeCanvas(bounds.width, bounds.height);
    this.#svgManager.updateSvgSize(bounds.width, bounds.height);
    this.#renderer.drawFrame();
  }

  getTextureCanvas(): HTMLCanvasElement {
    return this.#canvasBuffer.getCanvas();
  }

  /**
   * The interactive (on-screen) canvas InputController listens on. Useful
   * for attaching additional event listeners or overlays.
   */
  getCanvas(): HTMLCanvasElement {
    return this.#renderer.getCanvas();
  }

  destroy(): void {
    this.#input.destroy();
    const rendererCanvas = this.#renderer.getCanvas();
    if (rendererCanvas.parentElement) {
      rendererCanvas.remove();
    }
    this.#svgManager.destroy();
  }

  setTexture(
    source: HTMLCanvasElement | HTMLImageElement
  ): void {
    this.#canvasBuffer.setTexture(source);
    const size = this.#canvasBuffer.getSize();
    this.#viewport.setTextureSize(size);
    this.#renderer.drawFrame();

    this.#emitHook({
      action: "texture-replaced",
      metadata: {
        size,
        pixels: fromUint8Array(
          new Uint8Array(this.#canvasBuffer.getPixels())
        )
      }
    });
  }

  getTexture(): Uint8ClampedArray {
    return this.#canvasBuffer.getPixels();
  }

  /**
   * Commits an already-computed pixel set as a single atomic edit (one draw
   * call, one "stroke" hook emission). Used by the Shift-to-line tool (to
   * avoid redrawing the canvas once per rasterized point) and the fill tool
   * (to commit a flood-filled region in one shot).
   */
  commitPixels(
    pixels: Vec2[]
  ): void {
    if (pixels.length === 0) {
      return;
    }

    const color = toRGBA(this.brush.getColor());

    this.#applyStroke(color, pixels);

    this.#emitHook({
      action: "stroke",
      metadata: {
        color,
        positions: pixels
      }
    });
    this.#onDrawEnd?.();
  }

  /**
   * Replace the settable hook after construction. Used by PixelSyncSession
   * to attach itself to an already-constructed CanvasManager.
   */
  set onBufferUpdated(
    fn: PixelBufferHookListener | undefined
  ) {
    this.#onBufferUpdated = fn;
  }

  /**
   * Applies a mutation received from a remote peer without re-emitting the
   * onBufferUpdated hook, preventing an echo loop back to the network.
   */
  applyRemoteCommand(
    event: PixelBufferHookEvent
  ): void {
    this.#isApplyingRemote = true;
    try {
      switch (event.action) {
        case "stroke":
          this.#applyStroke(
            event.metadata.color,
            event.metadata.positions
          );
          this.#onDrawEnd?.();
          break;

        case "resized":
          this.setTextureSize(event.metadata.size);
          break;

        case "texture-replaced":
          this.#applyPixelReplace(
            event.metadata.size,
            new Uint8ClampedArray(
              toUint8Array(event.metadata.pixels)
            )
          );
          break;
      }
    }
    finally {
      this.#isApplyingRemote = false;
    }
  }

  /**
   * Hydrates the buffer from a network snapshot (join flow). Unlike
   * applyRemoteCommand, this is never itself broadcast as a command.
   */
  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray
  ): void {
    this.#isApplyingRemote = true;
    try {
      this.#applyPixelReplace(size, pixels);
    }
    finally {
      this.#isApplyingRemote = false;
    }
  }

  #applyPixelReplace(
    size: Vec2,
    pixels: Uint8ClampedArray
  ): void {
    this.#canvasBuffer.setPixels(pixels, size);
    this.#viewport.setTextureSize(size);
    this.#renderer.drawFrame();
  }

  /**
   * Shared buffer mutation used by both local stroke commits and remote
   * "stroke" command replay, so the two paths can't drift apart.
   */
  #applyStroke(
    color: RGBA,
    positions: Vec2[]
  ): void {
    this.#canvasBuffer.drawPixels(positions, color);
    this.#canvasBuffer.copyToMaster();
    this.#renderer.drawFrame();
  }

  #emitHook(
    event: PixelBufferHookEvent
  ): void {
    if (this.#isApplyingRemote || !this.#onBufferUpdated) {
      return;
    }

    this.#onBufferUpdated(event);
  }

  /**
   * Flood-fills the connected region of same-colored pixels reachable from
   * (tx, ty) with the current brush color/opacity, committed as a single
   * atomic edit. No-ops when the target position is out of bounds or already
   * matches the fill color (see Fill.floodFill).
   */
  #fill(
    tx: number,
    ty: number
  ): void {
    const fillColor = toRGBA(this.brush.getColor());

    const positions = Fill.floodFill(
      this.#canvasBuffer,
      { x: tx, y: ty },
      fillColor
    );
    this.commitPixels(positions);
  }
}
