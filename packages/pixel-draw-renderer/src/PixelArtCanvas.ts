// Import Third-party Dependencies
import Color from "colorjs.io";
import { fromUint8Array } from "js-base64";

// Import Internal Dependencies
import {
  Brush,
  type BrushColorSlot,
  type BrushOptions
} from "./tools/Brush.ts";
import {
  ToolControllers
} from "./tools/ToolControllers.ts";
import {
  CanvasBuffer
} from "./buffer/CanvasBuffer.ts";
import {
  CanvasRenderer
} from "./rendering/CanvasRenderer.ts";
import {
  HistoryController,
  type HistoryState
} from "./history/HistoryController.ts";
import {
  createInputActions
} from "./input/createInputActions.ts";
import {
  InputController,
  type WindowLike
} from "./input/InputController.ts";
import type {
  Keybindings,
  KeybindingsMap
} from "./input/Keybindings.ts";
import {
  SvgManager
} from "./rendering/SvgManager.ts";
import {
  Viewport,
  type DefaultViewport
} from "./rendering/Viewport.ts";
import type {
  Zoom,
  ZoomOptions
} from "./rendering/Zoom.ts";
import {
  SyncController
} from "./sync/SyncController.ts";
import { toRGBA } from "./utils/colors.ts";
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
  zoom?: ZoomOptions;
  backgroundTransparency?: {
    colors: { odd: string; even: string; };
    squareSize: number;
  };
  /**
    * Canvas color outside texture bounds.
   */
  backgroundColor?: ColorInput;
  brush?: BrushOptions;
  select?: {
    /**
     * Fill color for deleted pixels and moved selections.
     * @default transparent
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
  /**
   * History settings. If omitted, history is disabled.
   */
  history?: {
    enabled?: boolean;
    /**
     * @default 10
     */
    limit?: number;
  };
  onHistoryChange?: (state: HistoryState) => void;
  /**
   * Keybinding overrides.
   */
  keybindings?: Partial<KeybindingsMap>;
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
  #tools: ToolControllers;

  readonly brush: Brush;
  readonly viewport: DefaultViewport;

  constructor(
    parentHtmlElement: HTMLDivElement,
    options: PixelArtCanvasOptions = {}
  ) {
    this.#parentHtmlElement = parentHtmlElement;
    this.#onDrawEnd = options.onDrawEnd;
    this.#mode = options.defaultMode ?? "paint";
    const eraseColor = toRGBA(
      options.select?.eraseColor ?? { r: 0, g: 0, b: 0, a: 0 }
    );

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
    const backgroundColor = options.backgroundColor ?? (
      computedBackgroundColor && new Color(computedBackgroundColor).alpha > 0
        ? computedBackgroundColor
        : "#424242"
    );

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
        return self.#mode === "fill" || self.#tools.brush.pickArmed ? 1 : brushRef.size;
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

    this.#tools = new ToolControllers({
      brush: this.brush,
      canvasBuffer: this.#canvasBuffer,
      renderer: this.#renderer,
      linePreview: this.#svgManager.linePreview,
      selectionOverlay: this.#svgManager.selection,
      eraseColor,
      onStrokeCommit: (pixels, color, beforeColors) => {
        this.#sync.recordHistory({
          action: "stroke",
          positions: pixels,
          beforeColors,
          afterColor: color
        });
        this.#sync.emitHook({
          action: "stroke",
          metadata: { color, positions: pixels }
        });
        this.#onDrawEnd?.();
      },
      onCommitPixels: (pixels) => this.commitPixels(pixels),
      onFillCommitPixels: (pixels, slot) => this.commitPixels(pixels, slot),
      onGlobalFillCommit: ({ positions, beforeColors, fromColor, toColor }) => {
        this.#sync.applyStroke(toColor, positions);
        this.#sync.recordHistory({
          action: "stroke", positions,
          beforeColors,
          afterColor: toColor
        });
        this.#sync.emitHook({
          action: "global-fill",
          metadata: { fromColor, toColor }
        });
        this.#onDrawEnd?.();
      },
      onSelectCommit: (entry) => {
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
      actions: {
        ...createInputActions({
          getMode: () => this.#mode,
          renderer: this.#renderer,
          svgManager: this.#svgManager,
          viewport: this.#viewport,
          tools: this.#tools,
          stopDrawing: () => this.#input.stopDrawing()
        }),
        onUndo: () => this.undo(),
        onRedo: () => this.redo()
      },
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
      this.#tools.line.cancelIfArmed();
    }
    if (mode !== "select") {
      this.#tools.select.clear();
    }
    if (mode !== "paint") {
      this.#tools.brush.pickArmed = false;
    }
  }

  /**
   * Whether the next paint action picks a color.
   */
  get pickColorArmed(): boolean {
    return this.#tools.brush.pickArmed;
  }

  set pickColorArmed(
    armed: boolean
  ) {
    this.#tools.brush.pickArmed = armed;
  }

  /**
   * Samples a texture pixel into the primary brush color.
   */
  pickColorAt(
    x: number,
    y: number
  ): RGBA | null {
    return this.#tools.brush.pick(x, y);
  }

  /**
   * Whether fills recolor all matching pixels.
   */
  get fillGlobal(): boolean {
    return this.#tools.fill.global;
  }

  set fillGlobal(
    global: boolean
  ) {
    this.#tools.fill.global = global;
  }

  /**
   * Whether empty-space clicks create shape selections.
   */
  get selectShape(): boolean {
    return this.#tools.select.shape;
  }

  set selectShape(
    shape: boolean
  ) {
    this.#tools.select.shape = shape;
  }

  /**
   * Canvas color outside texture bounds.
   */
  get backgroundColor(): string {
    return this.#renderer.backgroundColor;
  }

  set backgroundColor(
    color: ColorInput
  ) {
    this.#renderer.backgroundColor = color;
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
    const beforePixels = this.#history.enabled ?
      Uint8ClampedArray.from(this.#canvasBuffer.pixels()) :
      null;

    this.#sync.resizeTexture(size);

    if (beforePixels) {
      this.#sync.recordHistory({
        action: "resized",
        beforeSize,
        beforePixels,
        afterSize: structuredClone(size),
        afterPixels: Uint8ClampedArray.from(
          this.#canvasBuffer.pixels()
        )
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

  get zoom(): Zoom {
    return this.#viewport.zoom;
  }

  get keybindings(): Keybindings {
    return this.#input.keybindings;
  }

  /**
   * Rotates the active selection clockwise.
   */
  rotateSelection(): boolean {
    return this.#tools.select.handleRotate();
  }

  /**
   * Mirrors the active selection horizontally.
   */
  flipSelectionHorizontal(): boolean {
    return this.#tools.select.handleFlipHorizontal();
  }

  /**
   * Mirrors the active selection vertically.
   */
  flipSelectionVertical(): boolean {
    return this.#tools.select.handleFlipVertical();
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
    const beforePixels = this.#history.enabled ?
      Uint8ClampedArray.from(this.#canvasBuffer.pixels()) :
      null;

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
        afterPixels: Uint8ClampedArray.from(
          this.#canvasBuffer.pixels()
        )
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
   * Commits pixels as a stroke edit.
   */
  commitPixels(
    pixels: Vec2[],
    slot: BrushColorSlot = "primary"
  ): void {
    if (pixels.length === 0) {
      return;
    }

    const color = toRGBA(this.brush[slot].asString());
    const beforeColors = this.#history.enabled ?
      this.#canvasBuffer.samplePixels(pixels) :
      [];

    this.#sync.applyStroke(color, pixels);

    this.#sync.recordHistory({
      action: "stroke",
      positions: pixels,
      beforeColors,
      afterColor: color
    });
    this.#sync.emitHook({
      action: "stroke",
      metadata: { color, positions: pixels }
    });
    this.#onDrawEnd?.();
  }

  /**
    * Reverts the latest local edit.
    */
  undo(): boolean {
    const entry = this.#history.undo();
    if (!entry) {
      return false;
    }

    this.#refreshAfterHistoryApply();
    if (entry.action === "select-edit") {
      this.#tools.select.syncSelectionAfterHistory(
        entry.oldRect,
        entry.oldMask
      );
    }
    for (const event of HistoryController.buildUndoReplayEvents(entry)) {
      this.#sync.emitHook(event);
    }
    this.#onDrawEnd?.();

    return true;
  }

  /**
    * Reapplies the latest reverted edit.
    */
  redo(): boolean {
    const entry = this.#history.redo();
    if (!entry) {
      return false;
    }

    this.#refreshAfterHistoryApply();
    if (entry.action === "select-edit") {
      this.#tools.select.syncSelectionAfterHistory(
        entry.newRect,
        entry.newMask
      );
    }
    for (const event of HistoryController.buildRedoReplayEvents(entry)) {
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
   * Applies a remote mutation without emitting it.
   */
  applyRemoteCommand(
    event: PixelBufferHookEvent
  ): void {
    this.#sync.applyRemoteCommand(event);
  }

  /**
   * Replaces the buffer from a remote snapshot.
   */
  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray
  ): void {
    this.#sync.loadSnapshot(size, pixels);
  }

  #refreshAfterHistoryApply(): void {
    this.#viewport.texture.resize(
      this.#canvasBuffer.size()
    );
    this.#renderer.drawFrame();
  }
}
