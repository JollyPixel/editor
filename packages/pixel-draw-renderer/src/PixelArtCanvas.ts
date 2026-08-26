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
import type { SelectEngineEvent } from "./tools/SelectEngine.events.ts";
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
import { resolveColor } from "./utils/colors.ts";
import type {
  BrushHighlight,
  ByteColorInput,
  Mode,
  PeerStrokePixel,
  SelectionRect,
  Vec2
} from "./types.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "./buffer/hooks.ts";
import { SelectionClipboard } from "./clipboard/SelectionClipboard.ts";
import { placeSelection } from "./tools/selectionPlacement.ts";
import type {
  ClipboardAdapter,
  ClipboardOperationResult,
  DecodedSelection
} from "./clipboard/types.ts";

export type { Mode };
export type { HistoryState };

export interface PixelArtCanvasOptions {
  /**
   * Initial interaction mode.
   * @default "paint"
   */
  defaultMode?: Mode;
  /**
   * Target for drag continuation, keyboard, and blur events.
   * @default window
   */
  window?: WindowLike;
  texture?: {
    defaultColor?: ByteColorInput;
    size?: {
      x: number;
      y?: number;
    };
    maxSize?: number;
    init?: HTMLCanvasElement;
  };
  /**
   * Fits the texture when `zoom.default` is omitted.
   */
  zoom?: ZoomOptions;
  backgroundTransparency?: {
    colors: { odd: string; even: string; };
    squareSize: number;
  };
  backgroundColor?: ByteColorInput;
  brush?: BrushOptions;
  select?: {
    /**
     * Fill for deleted pixels and vacated selections.
     * @default dominant neighbor color, then transparent
     */
    eraseColor?: ByteColorInput;
  };
  /**
   * Called after a local edit commits to the master buffer.
   */
  onDrawEnd?: () => void;
  /**
   * Called for local strokes, resizes, and texture replacements.
   */
  onBufferUpdated?: PixelBufferHookListener;
  /**
   * Omit to disable history.
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
   * Clipboard override; null forces internal-only behavior.
   */
  clipboard?: ClipboardAdapter | null;
  onClipboardResult?: (result: ClipboardOperationResult) => void;
  onModeChange?: (mode: Mode, previousMode: Mode) => void;
  keybindings?: Partial<KeybindingsMap>;
}

export class PixelArtCanvas {
  #parentHtmlElement: HTMLDivElement;
  #view: CanvasView;
  #input: InputController;

  #edits: EditPipeline;
  #onDrawEnd?: () => void;
  #onStrokeProgress?: (pixels: PeerStrokePixel[]) => void;
  #router: InteractionRouter;
  #tools: Tools;
  #clipboard: SelectionClipboard;
  #clipboardPending = false;
  #onClipboardResult?: (result: ClipboardOperationResult) => void;
  #onViewportChanged = () => {
    this.#view.refresh();
    this.#tools.line.refreshPreview();
    this.#tools.select.refreshOverlay();
  };

  readonly document: PixelDocument;
  readonly brush: Brush;
  readonly viewport: DefaultViewport;
  readonly uv: UVMap;
  readonly tools: Toolset;
  readonly peerPresence: PeerPresence;
  /**
   * Read-only select progress events for SelectionGhostSync.
   */
  readonly selectionEvents: Pick<Emitter<SelectEngineEvent>, "on" | "off">;

  constructor(
    parentHtmlElement: HTMLDivElement,
    options: PixelArtCanvasOptions = {}
  ) {
    this.#parentHtmlElement = parentHtmlElement;
    this.#onDrawEnd = options.onDrawEnd;
    this.#onClipboardResult = options.onClipboardResult;
    const defaultMode: Mode = options.defaultMode ?? "paint";
    const eraseColor = options.select?.eraseColor === undefined ?
      null :
      resolveColor(options.select.eraseColor);

    const textureSize: Vec2 = options.texture?.size
      ? { x: options.texture.size.x, y: options.texture.size.y ?? options.texture.size.x }
      : { x: 64, y: 32 };

    this.document = new PixelDocument({
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
    this.uv = this.document.uv;

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

    this.#view = new CanvasView(this.document, {
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
      canvasBuffer: this.document.buffer,
      viewport: this.#view.viewport,
      renderer: this.#view.renderer,
      history: this.document.history,
      uvMap: this.document.uv,
      onBufferUpdated: options.onBufferUpdated,
      onDrawEnd: options.onDrawEnd
    });

    this.#tools = new Tools({
      brush: this.brush,
      canvasBuffer: this.document.buffer,
      renderer: this.#view.renderer,
      linePreview: this.#view.overlays.linePreview,
      selectionOverlay: this.#view.overlays.selection,
      eraseColor,
      uvMap: this.document.uv,
      uvOverlay: this.#view.overlays.uvOverlay,
      pipeline: this.#edits,
      onProgress: (pixels) => this.#onStrokeProgress?.(pixels)
    });
    this.tools = this.#tools;
    this.selectionEvents = this.#tools.select;
    this.#clipboard = new SelectionClipboard({
      adapter: resolveClipboardAdapter(options.clipboard)
    });

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
      onCopy: () => this.#handleCopyShortcut(),
      onPaste: () => this.#handlePasteShortcut(),
      onModeChange: options.onModeChange,
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
    color: ByteColorInput
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
    return this.document.buffer.size();
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
    this.#tools.select.discard();
  }

  get maxTextureSize(): number {
    return this.document.buffer.maxSize;
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

    // Viewport resize runs last and emits the repaint.
    this.#view.resize(bounds.width, bounds.height);
  }

  textureCanvas(): HTMLCanvasElement {
    return this.document.buffer.canvas();
  }

  hasTransparency(
    rect: SelectionRect
  ): boolean {
    return this.document.buffer.hasTransparency(rect);
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
    this.#tools.select.discard();
  }

  get texture(): Uint8ClampedArray {
    return this.document.buffer.pixels();
  }

  commitPixels(
    pixels: Vec2[],
    slot: BrushColorSlot = "primary"
  ): void {
    this.#edits.commitPixels(pixels, slot);
  }

  undo(): boolean {
    const previousSize = this.textureSize;
    const entry = this.#edits.runHistoryReplay(() => this.document.history.undo());
    if (!entry) {
      return false;
    }

    this.#refreshAfterHistoryApply();
    if (
      previousSize.x !== this.textureSize.x ||
      previousSize.y !== this.textureSize.y
    ) {
      this.#tools.select.discard();
    }
    else if (entry.action === "select-edit" && this.#router.mode === "select") {
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
    const previousSize = this.textureSize;
    const entry = this.#edits.runHistoryReplay(() => this.document.history.redo());
    if (!entry) {
      return false;
    }

    this.#refreshAfterHistoryApply();
    if (
      previousSize.x !== this.textureSize.x ||
      previousSize.y !== this.textureSize.y
    ) {
      this.#tools.select.discard();
    }
    else if (
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
    return this.document.history.canUndo;
  }

  canRedo(): boolean {
    return this.document.history.canRedo;
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

  set onCursorMove(
    fn: ExternalCursorMoveListener | undefined
  ) {
    this.#router.onExternalCursorMove = fn;
  }

  get onStrokeProgress(): ((pixels: PeerStrokePixel[]) => void) | undefined {
    return this.#onStrokeProgress;
  }

  set onStrokeProgress(
    fn: ((pixels: PeerStrokePixel[]) => void) | undefined
  ) {
    this.#onStrokeProgress = fn;
  }

  applyRemoteCommand(
    event: PixelBufferHookEvent
  ): void {
    this.#edits.applyRemoteCommand(event);
    if (
      event.action === "resized" ||
      event.action === "texture-replaced"
    ) {
      this.#tools.select.discard();
    }
  }

  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray,
    uvRegions: (UVRegion | UVRegionData)[] = []
  ): void {
    this.#edits.loadSnapshot(size, pixels, uvRegions);
    this.#tools.select.discard();
  }

  async copySelection(): Promise<ClipboardOperationResult> {
    if (this.#clipboardPending) {
      return this.#reportClipboardResult({
        operation: "copy",
        code: "busy"
      });
    }

    const snapshot = this.#tools.select.exportSelection();
    if (!snapshot) {
      return this.#reportClipboardResult({
        operation: "copy",
        code: "no-selection"
      });
    }

    this.#clipboardPending = true;
    try {
      return this.#reportClipboardResult(
        await this.#clipboard.copy(snapshot)
      );
    }
    finally {
      this.#clipboardPending = false;
    }
  }

  async pasteClipboard(): Promise<ClipboardOperationResult> {
    if (this.#clipboardPending) {
      return this.#reportClipboardResult({
        operation: "paste",
        code: "busy"
      });
    }

    this.#clipboardPending = true;
    try {
      const { result, selection } = await this.#clipboard.read(
        this.maxTextureSize
      );
      if (result.code !== "pasted" || !selection) {
        return this.#reportClipboardResult(result);
      }

      return this.#reportClipboardResult(
        this.#floatPastedSelection(selection, result)
      );
    }
    finally {
      this.#clipboardPending = false;
    }
  }

  /**
   * Placement needs the canvas cursor, camera, and texture bounds.
   */
  #floatPastedSelection(
    selection: DecodedSelection,
    result: ClipboardOperationResult
  ): ClipboardOperationResult {
    const rect = placeSelection(selection, {
      cursor: this.#router.textureCursor,
      viewCenter: this.#view.viewport.visibleCenter(),
      bounds: this.textureSize
    });

    const previousMode = this.mode;
    this.mode = "select";

    let imported: boolean;
    try {
      imported = this.#tools.select.importSelection({
        rect,
        pixels: selection.pixels,
        mask: selection.mask
      });
    }
    catch {
      imported = false;
    }
    if (imported) {
      return result;
    }

    // Restore state after a partial selection import.
    this.#tools.select.discard();
    this.mode = previousMode;

    return {
      operation: "paste",
      code: "paste-failed",
      source: result.source
    };
  }

  #handleCopyShortcut(): boolean {
    if (!this.#tools.select.hasSelection) {
      return false;
    }

    void this.copySelection();

    return true;
  }

  #handlePasteShortcut(): boolean {
    void this.pasteClipboard();

    return true;
  }

  #reportClipboardResult(
    result: ClipboardOperationResult
  ): ClipboardOperationResult {
    this.#onClipboardResult?.(result);

    return result;
  }

  #refreshAfterHistoryApply(): void {
    this.#view.viewport.texture.resize(
      this.document.buffer.size()
    );
    this.#view.drawFrame();
  }
}

function resolveClipboardAdapter(
  adapter: ClipboardAdapter | null | undefined
): ClipboardAdapter | null {
  if (adapter !== undefined) {
    return adapter;
  }
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.read === "function" &&
    typeof navigator.clipboard.write === "function"
  ) {
    return navigator.clipboard;
  }

  return null;
}
