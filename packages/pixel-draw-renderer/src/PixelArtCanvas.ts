// Import Third-party Dependencies
import type { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  Brush,
  type BrushColorSlot,
  type BrushOptions
} from "./tools/Brush.ts";
import {
  Tools,
  type Toolset
} from "./tools/Tools.ts";
import type { SelectControllerEvent } from "./tools/SelectController.events.ts";
import {
  History,
  type HistoryState
} from "./history/History.ts";
import {
  InteractionRouter,
  type ExternalCursorMoveListener
} from "./input/InteractionRouter.ts";
import { PaintMode } from "./input/modes/PaintMode.ts";
import { FillMode } from "./input/modes/FillMode.ts";
import { SelectMode } from "./input/modes/SelectMode.ts";
import { UVMode } from "./input/modes/UVMode.ts";
import { MoveMode } from "./input/modes/MoveMode.ts";
import { InputController } from "./input/InputController.ts";
import type {
  Keybindings,
  KeybindingsMap
} from "./input/Keybindings.ts";
import type { WindowLike } from "./input/WindowLike.ts";
import type {
  DefaultViewport
} from "./rendering/Viewport.ts";
import type {
  Zoom,
  ZoomOptions
} from "./rendering/Zoom.ts";
import {
  EditPipeline
} from "./sync/EditPipeline.ts";
import {
  PixelDocument
} from "./PixelDocument.ts";
import {
  CanvasView
} from "./CanvasView.ts";
import type { UVMap } from "./uv/UVMap.ts";
import type {
  UVRegion,
  UVRegionData
} from "./uv/UVRegion.ts";
import type { PeerPresence } from "./rendering/presence/PeerPresence.ts";
import { toRGBA } from "./utils/colors.ts";
import type {
  BrushHighlight,
  ColorInput,
  Mode,
  PeerStrokePixel,
  SelectionRect,
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
  /**
   * Zoom default: if omitted, computed to fit the texture in the container.
   * Pass an explicit `default` to opt out.
   */
  zoom?: ZoomOptions;
  backgroundTransparency?: {
    colors: { odd: string; even: string; };
    squareSize: number;
  };
  backgroundColor?: ColorInput;
  brush?: BrushOptions;
  select?: {
    /**
     * Explicit fill for deleted pixels and vacated selection footprints.
     * Omit to use the dominant neighbor color (transparent as fallback).
     * @default dominant neighbor color, transparent as the ultimate fallback
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
  keybindings?: Partial<KeybindingsMap>;
}

export class PixelArtCanvas {
  #parentHtmlElement: HTMLDivElement;
  #doc: PixelDocument;
  #view: CanvasView;
  #input: InputController;

  #edits: EditPipeline;
  #onDrawEnd?: () => void;
  #onStrokeProgress?: (pixels: PeerStrokePixel[]) => void;
  #router: InteractionRouter;
  #tools: Tools;
  #onViewportChanged = () => {
    this.#view.refresh();
    this.#tools.line.refreshPreview();
    this.#tools.select.refreshOverlay();
  };

  readonly brush: Brush;
  readonly viewport: DefaultViewport;
  readonly uv: UVMap;
  readonly tools: Toolset;
  readonly peerPresence: PeerPresence;
  /**
   * Read-only subscription to the select tool's progress events.
   * Consumed by SelectionGhostSync; nothing outside sync should emit on it.
   */
  readonly selectionEvents: Pick<Emitter<SelectControllerEvent>, "on" | "off">;

  constructor(
    parentHtmlElement: HTMLDivElement,
    options: PixelArtCanvasOptions = {}
  ) {
    this.#parentHtmlElement = parentHtmlElement;
    this.#onDrawEnd = options.onDrawEnd;
    const defaultMode: Mode = options.defaultMode ?? "paint";
    const eraseColor = options.select?.eraseColor === undefined ?
      null :
      toRGBA(options.select.eraseColor);

    const textureSize: Vec2 = options.texture?.size
      ? { x: options.texture.size.x, y: options.texture.size.y ?? options.texture.size.x }
      : { x: 64, y: 32 };

    this.#doc = new PixelDocument({
      size: textureSize,
      defaultColor: options.texture?.defaultColor,
      maxSize: options.texture?.maxSize,
      init: options.texture?.init,
      history: {
        enabled: options.history?.enabled,
        limit: options.history?.limit,
        onChange: options.onHistoryChange
      }
    });
    this.uv = this.#doc.uv;

    this.brush = new Brush(options.brush);

    const brushRef = this.brush;
    const self = this;

    const brushAdapter: BrushHighlight = {
      get size() {
        return self.#router.highlightBrushSize(brushRef.size);
      },
      get colorInline() {
        return brushRef.colorInline;
      },
      get colorOutline() {
        return brushRef.colorOutline;
      }
    };

    this.#view = new CanvasView(this.#doc, {
      parent: parentHtmlElement,
      zoom: options.zoom,
      background: options.backgroundColor,
      backgroundTransparency: options.backgroundTransparency,
      brushHighlight: brushAdapter,
      eraseColor
    });
    this.viewport = this.#view.viewport;
    this.peerPresence = this.#view.peerPresence;

    this.#edits = new EditPipeline({
      brush: this.brush,
      canvasBuffer: this.#doc.buffer,
      viewport: this.#view.viewport,
      renderer: this.#view.renderer,
      history: this.#doc.history,
      uvMap: this.#doc.uv,
      onBufferUpdated: options.onBufferUpdated,
      onDrawEnd: options.onDrawEnd
    });

    this.#tools = new Tools({
      brush: this.brush,
      canvasBuffer: this.#doc.buffer,
      renderer: this.#view.renderer,
      linePreview: this.#view.overlays.linePreview,
      selectionOverlay: this.#view.overlays.selection,
      eraseColor,
      uvMap: this.#doc.uv,
      uvOverlay: this.#view.overlays.uvOverlay,
      pipeline: this.#edits,
      onProgress: (pixels) => this.#onStrokeProgress?.(pixels)
    });
    this.tools = this.#tools;
    this.selectionEvents = this.#tools.select;

    // Camera changes repaint and re-place all camera-dependent overlays.
    this.#view.viewport.on("changed", this.#onViewportChanged);

    this.#router = new InteractionRouter({
      defaultMode,
      viewport: this.#view.viewport,
      setCursor: (cursor) => {
        this.#view.renderer.cursor = cursor;
      },
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      modes: [
        new PaintMode({
          brush: this.#tools.brush,
          line: this.#tools.line,
          highlight: this.#view.overlays.brushHighlight,
          stopDrawing: () => this.#input.stopDrawing()
        }),
        new FillMode({
          fill: this.#tools.fill,
          highlight: this.#view.overlays.brushHighlight
        }),
        new SelectMode({ select: this.#tools.select }),
        new UVMode({ uv: this.#tools.uv }),
        new MoveMode()
      ]
    });

    this.#input = new InputController({
      canvas: this.#view.renderer.canvas(),
      viewport: this.#view.viewport,
      window: options.window,
      actions: this.#router,
      keybindings: options.keybindings,
      // In "move" mode a plain left-drag pans.
      shouldPanOnPrimary: () => this.#router.mode === "move",
      onCtrlWheel: (delta) => {
        if (this.#router.mode !== "paint" || delta === 0) {
          return false;
        }

        this.brush.size -= Math.sign(delta);
        this.#view.overlays.brushHighlight.refresh();

        return true;
      }
    });

    this.centerTexture();
  }

  get mode(): Mode {
    return this.#router.mode;
  }

  set mode(
    mode: Mode
  ) {
    this.#router.mode = mode;
  }

  get backgroundColor(): string {
    return this.#view.backgroundColor;
  }

  set backgroundColor(
    color: ColorInput
  ) {
    this.#view.backgroundColor = color;
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

    this.#view.reparentTo(newParentElement);
    this.#parentHtmlElement = newParentElement;
    this.onResize();
  }

  get textureSize(): Vec2 {
    return this.#doc.buffer.size();
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

    this.#edits.resize(size);
  }

  get camera(): Vec2 {
    return { ...this.#view.viewport.camera };
  }

  get zoom(): Zoom {
    return this.#view.viewport.zoom;
  }

  get keybindings(): Keybindings {
    return this.#input.keybindings;
  }

  centerTexture(): void {
    this.#view.centerTexture();
  }

  onResize(): void {
    const bounds = this.#parentHtmlElement.getBoundingClientRect();

    if (
      bounds.width === 0 ||
      bounds.height === 0
    ) {
      return;
    }

    // view.resize() resizes the viewport last; its "changed" signal repaints.
    this.#view.resize(bounds.width, bounds.height);
  }

  textureCanvas(): HTMLCanvasElement {
    return this.#doc.buffer.canvas();
  }

  hasTransparency(
    rect: SelectionRect
  ): boolean {
    return this.#doc.buffer.hasTransparency(rect);
  }

  canvas(): HTMLCanvasElement {
    return this.#view.canvas();
  }

  destroy(): void {
    this.#input.destroy();
    this.#view.viewport.off("changed", this.#onViewportChanged);
    this.#view.destroy();
  }

  set texture(
    source: HTMLCanvasElement | HTMLImageElement
  ) {
    this.#edits.replaceTexture(source);
  }

  get texture(): Uint8ClampedArray {
    return this.#doc.buffer.pixels();
  }

  commitPixels(
    pixels: Vec2[],
    slot: BrushColorSlot = "primary"
  ): void {
    this.#edits.commitPixels(pixels, slot);
  }

  undo(): boolean {
    const entry = this.#edits.runHistoryReplay(() => this.#doc.history.undo());
    if (!entry) {
      return false;
    }

    this.#refreshAfterHistoryApply();
    if (entry.action === "select-edit" && this.#router.mode === "select") {
      this.#tools.select.syncSelectionAfterHistory(
        entry.oldRect,
        entry.oldMask
      );
    }
    for (const event of History.buildUndoReplayEvents(entry)) {
      this.#edits.emitHook(event);
    }
    this.#onDrawEnd?.();

    return true;
  }

  redo(): boolean {
    const entry = this.#edits.runHistoryReplay(() => this.#doc.history.redo());
    if (!entry) {
      return false;
    }

    this.#refreshAfterHistoryApply();
    if (
      entry.action === "select-edit" &&
      this.#router.mode === "select"
    ) {
      this.#tools.select.syncSelectionAfterHistory(
        entry.newRect,
        entry.newMask
      );
    }
    for (const event of History.buildRedoReplayEvents(entry)) {
      this.#edits.emitHook(event);
    }
    this.#onDrawEnd?.();

    return true;
  }

  canUndo(): boolean {
    return this.#doc.history.canUndo;
  }

  canRedo(): boolean {
    return this.#doc.history.canRedo;
  }

  get onBufferUpdated(): PixelBufferHookListener | undefined {
    return this.#edits.onBufferUpdated;
  }

  set onBufferUpdated(
    fn: PixelBufferHookListener | undefined
  ) {
    this.#edits.onBufferUpdated = fn;
  }

  get onCursorMove(): ExternalCursorMoveListener | undefined {
    return this.#router.onExternalCursorMove;
  }

  /**
   * Reports bounded texture positions, or `null` outside the texture.
   */
  set onCursorMove(
    fn: ExternalCursorMoveListener | undefined
  ) {
    this.#router.onExternalCursorMove = fn;
  }

  get onStrokeProgress(): ((pixels: PeerStrokePixel[]) => void) | undefined {
    return this.#onStrokeProgress;
  }

  /**
   * Reports live brush and line pixels before commit.
   */
  set onStrokeProgress(
    fn: ((pixels: PeerStrokePixel[]) => void) | undefined
  ) {
    this.#onStrokeProgress = fn;
  }

  applyRemoteCommand(
    event: PixelBufferHookEvent
  ): void {
    this.#edits.applyRemoteCommand(event);
  }

  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray,
    uvRegions: (UVRegion | UVRegionData)[] = []
  ): void {
    this.#edits.loadSnapshot(size, pixels, uvRegions);
  }

  #refreshAfterHistoryApply(): void {
    this.#view.viewport.texture.resize(
      this.#doc.buffer.size()
    );
    this.#view.drawFrame();
  }
}
