// Import Third-party Dependencies
import Color from "colorjs.io";
import { fromUint8Array } from "js-base64";

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
  FillController
} from "./tools/FillController.ts";
import {
  HistoryController,
  type HistoryState
} from "./history/HistoryController.ts";
import {
  buildRedoReplayEvents,
  buildUndoReplayEvents
} from "./history/replayEvents.ts";
import {
  createInputActions
} from "./input/createInputActions.ts";
import {
  InputController,
  type WindowLike
} from "./input/InputController.ts";
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
import {
  SyncController
} from "./sync/SyncController.ts";
import { toRGBA } from "./utils/colors.ts";
import type { Keybindings } from "./utils/keybindings.ts";
import type {
  BrushHighlight,
  ColorInput,
  Mode,
  Vec2
} from "./types.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "./buffer/hooks.ts";

export type { Mode };
export type { HistoryState };

export interface PixelArtCanvasOptions {
  /**
  * Initial interaction mode: `paint`, `move`, `fill`, or `select`.
  * @default "paint"
   */
  defaultMode?: Mode;
  /**
  * Global event target for drag continuation, keyboard, and blur events.
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
     * Fill color for deleted pixels and the source of moved selections.
     * Accepts a CSS color or `Color` instance.
     * @default "#FFFFFF"
     */
    eraseColor?: ColorInput;
  };
  /**
   * Called after a local edit is committed to the master buffer.
   */
  onDrawEnd?: () => void;
  /**
   * Called for local strokes, resizes, and texture replacements.
   */
  onBufferUpdated?: PixelBufferHookListener;
  /** Local undo/redo stack. Disabled by default. */
  history?: {
    enabled?: boolean;
    /** @default 10 */
    limit?: number;
  };
  /** Called whenever the undo/redo stack changes. */
  onHistoryChange?: (state: HistoryState) => void;
  /**
    * Keybinding overrides. Unspecified actions keep their defaults; Shift is fixed.
    * Can be updated with `patchKeybindings()`.
   */
  keybindings?: Partial<Keybindings>;
}

export class PixelArtCanvas {
  #parentHtmlElement: HTMLDivElement;
  #viewport: Viewport;
  #canvasBuffer: CanvasBuffer;
  #renderer: CanvasRenderer;
  #input: InputController;
  #svgManager: SvgManager;

  #sync: SyncController;
  #onDrawEnd?: () => void;
  #history: HistoryController;
  #mode: Mode;
  #brushController: BrushController;
  #fillController: FillController;
  #lineController: LineController;
  #selectController: SelectController;

  readonly brush: Brush;
  readonly viewport: DefaultViewport;

  constructor(
    parentHtmlElement: HTMLDivElement,
    options: PixelArtCanvasOptions = {}
  ) {
    this.#parentHtmlElement = parentHtmlElement;
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
      this.#canvasBuffer.loadTexture(options.texture.init);
    }

    this.#history = new HistoryController(this.#canvasBuffer, {
      enabled: options.history?.enabled,
      limit: options.history?.limit,
      onChange: options.onHistoryChange
    });

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

    this.#sync = new SyncController({
      canvasBuffer: this.#canvasBuffer,
      viewport: this.#viewport,
      renderer: this.#renderer,
      history: this.#history,
      onBufferUpdated: options.onBufferUpdated,
      onDrawEnd: options.onDrawEnd
    });

    this.#renderer.appendTo(parentHtmlElement);

    const bounds = parentHtmlElement.getBoundingClientRect();
    this.#renderer.resize(bounds.width, bounds.height);
    this.#viewport.updateCanvasSize(bounds.width, bounds.height);

    this.brush = new Brush(options.brush);

    const brushRef = this.brush;
    const viewportRef: DefaultViewport = this.#viewport;
    const self = this;

    const brushAdapter: BrushHighlight = {
      get size() {
        // Fill interactions always target one seed pixel.
        return self.#mode === "fill" ? 1 : brushRef.size;
      },
      get colorInline() {
        return brushRef.colorInline;
      },
      get colorOutline() {
        return brushRef.colorOutline;
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
      onCommit: (pixels, color, beforeColors) => {
        this.#sync.recordHistory({ action: "stroke", positions: pixels, beforeColors, afterColor: color });
        this.#sync.emitHook({ action: "stroke", metadata: { color, positions: pixels } });
        this.#onDrawEnd?.();
      }
    });

    this.#fillController = new FillController({
      brush: this.brush,
      canvasBuffer: this.#canvasBuffer,
      onCommit: (pixels) => this.commitPixels(pixels),
      onGlobalCommit: ({ positions, beforeColors, fromColor, toColor }) => {
        this.#sync.applyStroke(toColor, positions);
        this.#sync.recordHistory({ action: "stroke", positions, beforeColors, afterColor: toColor });
        this.#sync.emitHook({ action: "global-fill", metadata: { fromColor, toColor } });
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
      onCommit: (entry) => {
        this.#sync.recordHistory({
          action: "select-edit",
          ...entry
        });
        this.#onDrawEnd?.();
      }
    });

    this.#input = new InputController({
      canvas: this.#renderer.canvas(),
      viewport: this.#viewport,
      window: options.window,
      actions: createInputActions({
        getMode: () => this.#mode,
        brush: this.brush,
        canvasBuffer: this.#canvasBuffer,
        renderer: this.#renderer,
        svgManager: this.#svgManager,
        viewport: this.#viewport,
        brushController: this.#brushController,
        fillController: this.#fillController,
        lineController: this.#lineController,
        selectController: this.#selectController,
        undo: () => this.undo(),
        redo: () => this.redo(),
        stopDrawing: () => this.#input.stopDrawing()
      }),
      keybindings: options.keybindings
    });

    this.centerTexture();
  }

  get mode(): Mode {
    return this.#mode;
  }

  set mode(
    mode: Mode
  ) {
    this.#mode = mode;
    if (mode === "move") {
      this.#svgManager.brushHighlight.hide();
      this.#lineController.cancelIfArmed();
    }
    if (mode !== "select") {
      this.#selectController.clear();
    }
  }

  /**
    * Whether fill recolors all matching pixels instead of only the connected region.
   */
  get fillGlobal(): boolean {
    return this.#fillController.global;
  }

  set fillGlobal(
    global: boolean
  ) {
    this.#fillController.global = global;
  }

  get parentHtmlElement(): HTMLDivElement {
    return this.#parentHtmlElement;
  }

  reparentCanvasTo(
    newParentElement: HTMLDivElement
  ): void {
    if (!newParentElement) {
      console.error("PixelArtCanvas: Invalid parent element");

      return;
    }

    this.#renderer.reparentTo(newParentElement);
    this.#svgManager.reparentTo(newParentElement);
    this.#parentHtmlElement = newParentElement;
    this.onResize();
  }

  get textureSize(): Vec2 {
    return this.#canvasBuffer.size();
  }

  set textureSize(
    size: Vec2
  ) {
    if (
      size.x <= 0 ||
      size.y <= 0
    ) {
      console.error("PixelArtCanvas: Texture size must be positive");

      return;
    }

    const beforeSize = this.#canvasBuffer.size();
    const beforePixels = this.#history.enabled ? Uint8ClampedArray.from(this.#canvasBuffer.pixels()) : null;

    this.#sync.resizeTexture(size);

    if (beforePixels) {
      this.#sync.recordHistory({
        action: "resized",
        beforeSize,
        beforePixels,
        afterSize: structuredClone(size),
        afterPixels: Uint8ClampedArray.from(this.#canvasBuffer.pixels())
      });
    }

    this.#sync.emitHook({
      action: "resized",
      metadata: {
        size: structuredClone(size)
      }
    });
  }

  get camera(): Vec2 {
    return { ...this.#viewport.camera };
  }

  get zoom(): number {
    return this.#viewport.zoom;
  }

  get zoomSensitivity(): number {
    return this.#viewport.zoomSensitivity;
  }

  set zoomSensitivity(
    sensitivity: number
  ) {
    this.#viewport.zoomSensitivity = sensitivity;
  }

  /**
    * Applies a partial keybinding update to the current bindings.
   */
  patchKeybindings(
    patch: Partial<Keybindings>
  ): void {
    this.#input.patchKeybindings(patch);
  }

  get keybindings(): Readonly<Keybindings> {
    return this.#input.keybindings;
  }

  /**
    * Rotates the active selection clockwise. Returns `false` without a selection.
   */
  rotateSelection(): boolean {
    return this.#selectController.handleRotate();
  }

  /**
    * Mirrors the active selection horizontally. Returns `false` without a selection.
   */
  flipSelectionHorizontal(): boolean {
    return this.#selectController.handleFlipHorizontal();
  }

  /**
    * Mirrors the active selection vertically. Returns `false` without a selection.
   */
  flipSelectionVertical(): boolean {
    return this.#selectController.handleFlipVertical();
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
    this.#svgManager.resize(bounds.width, bounds.height);
    this.#renderer.drawFrame();
  }

  textureCanvas(): HTMLCanvasElement {
    return this.#canvasBuffer.canvas();
  }

  /**
    * Returns the interactive canvas used for input and overlays.
   */
  canvas(): HTMLCanvasElement {
    return this.#renderer.canvas();
  }

  destroy(): void {
    this.#input.destroy();
    const rendererCanvas = this.#renderer.canvas();
    if (rendererCanvas.parentElement) {
      rendererCanvas.remove();
    }
    this.#svgManager.destroy();
  }

  set texture(
    source: HTMLCanvasElement | HTMLImageElement
  ) {
    const beforeSize = this.#canvasBuffer.size();
    const beforePixels = this.#history.enabled ? Uint8ClampedArray.from(this.#canvasBuffer.pixels()) : null;

    this.#canvasBuffer.loadTexture(source);
    const size = this.#canvasBuffer.size();
    this.#viewport.texture.resize(size);
    this.#renderer.drawFrame();

    if (beforePixels) {
      this.#sync.recordHistory({
        action: "texture-replaced",
        beforeSize,
        beforePixels,
        afterSize: size,
        afterPixels: Uint8ClampedArray.from(this.#canvasBuffer.pixels())
      });
    }

    this.#sync.emitHook({
      action: "texture-replaced",
      metadata: {
        size,
        pixels: fromUint8Array(
          new Uint8Array(this.#canvasBuffer.pixels())
        )
      }
    });
  }

  get texture(): Uint8ClampedArray {
    return this.#canvasBuffer.pixels();
  }

  /**
    * Commits pixels as one atomic stroke edit.
   */
  commitPixels(
    pixels: Vec2[]
  ): void {
    if (pixels.length === 0) {
      return;
    }

    const color = toRGBA(this.brush.colorAsString());
    const beforeColors = this.#history.enabled ? this.#canvasBuffer.samplePixels(pixels) : [];

    this.#sync.applyStroke(color, pixels);

    this.#sync.recordHistory({ action: "stroke", positions: pixels, beforeColors, afterColor: color });
    this.#sync.emitHook({ action: "stroke", metadata: { color, positions: pixels } });
    this.#onDrawEnd?.();
  }

  /** Reverts the latest local edit. Returns `false` when history is unavailable. */
  undo(): boolean {
    const entry = this.#history.undo();
    if (!entry) {
      return false;
    }

    this.#refreshAfterHistoryApply();
    if (entry.action === "select-edit") {
      this.#selectController.syncSelectionAfterHistory(entry.oldRect);
    }
    for (const event of buildUndoReplayEvents(entry)) {
      this.#sync.emitHook(event);
    }
    this.#onDrawEnd?.();

    return true;
  }

  /** Re-applies the latest undone edit. Returns `false` when history is unavailable. */
  redo(): boolean {
    const entry = this.#history.redo();
    if (!entry) {
      return false;
    }

    this.#refreshAfterHistoryApply();
    if (entry.action === "select-edit") {
      this.#selectController.syncSelectionAfterHistory(entry.newRect);
    }
    for (const event of buildRedoReplayEvents(entry)) {
      this.#sync.emitHook(event);
    }
    this.#onDrawEnd?.();

    return true;
  }

  canUndo(): boolean {
    return this.#history.canUndo;
  }

  canRedo(): boolean {
    return this.#history.canRedo;
  }

  /**
    * Replaces the local buffer-mutation listener.
   */
  set onBufferUpdated(
    fn: PixelBufferHookListener | undefined
  ) {
    this.#sync.onBufferUpdated = fn;
  }

  /**
    * Applies a remote mutation without emitting it again.
   */
  applyRemoteCommand(
    event: PixelBufferHookEvent
  ): void {
    this.#sync.applyRemoteCommand(event);
  }

  /**
    * Replaces the buffer from a remote snapshot without emitting a mutation.
   */
  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray
  ): void {
    this.#sync.loadSnapshot(size, pixels);
  }

  #refreshAfterHistoryApply(): void {
    this.#viewport.texture.resize(this.#canvasBuffer.size());
    this.#renderer.drawFrame();
  }
}
