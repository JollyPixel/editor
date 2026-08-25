// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { Select } from "./Select.ts";
import { ShapeSelect } from "./ShapeSelect.ts";
import type { SelectEngineEvent } from "./SelectEngine.events.ts";
import type { SelectionSnapshot } from "../clipboard/types.ts";
import { clipRectToBounds } from "../utils/math.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type {
  FloatingSelection
} from "../rendering/compositing/FloatingSelection.ts";
import type {
  SelectionOutline
} from "../rendering/overlays/SelectionOutline.ts";
import type { EditPipeline } from "../sync/EditPipeline.ts";
import type {
  RGBA8,
  SelectionRect,
  Vec2
} from "../types.ts";

export type {
  SelectEngineEvent,
  SelectionProgressEvent
} from "./SelectEngine.events.ts";

export interface SelectEditEntry {
  positions: Vec2[];
  beforeColors: RGBA8[];
  afterColors: RGBA8[];
  oldRect: SelectionRect;
  newRect: SelectionRect;
  oldMask: boolean[];
  newMask: boolean[];
}

export interface SelectEngineOptions {
  canvasBuffer: CanvasBuffer;
  floatingSelection: FloatingSelection;
  selectionOverlay: SelectionOutline;
  /**
   * Explicit fill for a vacated footprint (Move/Rotate/Flip source, or
   * Delete), overriding the smart default below. `null` when not
   * configured by the consumer.
   */
  eraseColor: RGBA8 | null;
  pipeline: EditPipeline;
}

export interface SelectTool {
  /**
   * Whether empty-space clicks create shape selections.
   */
  shape: boolean;
  readonly hasSelection: boolean;
  /**
   * Whether the selection is a not-yet-deposited paste. Deselecting it
   * deposits it; `delete()` cancels it.
   */
  readonly isFloating: boolean;
  /**
   * Returns `false` when there is no active selection.
   */
  rotate(): boolean;
  flipHorizontal(): boolean;
  flipVertical(): boolean;
  delete(): boolean;
}

export class SelectEngine extends Emitter<SelectEngineEvent> implements SelectTool {
  #select = new Select();
  #canvasBuffer: CanvasBuffer;
  #floatingSelection: FloatingSelection;
  #selectionOverlay: SelectionOutline;
  #eraseColor: RGBA8 | null;
  #pipeline: EditPipeline;
  #shapeMode = false;
  #moveSourceRect: SelectionRect | null = null;
  #moveBlankSource = true;
  #publishedHasSelection = false;
  #publishedIsFloating = false;

  constructor(
    options: SelectEngineOptions
  ) {
    super();
    this.#canvasBuffer = options.canvasBuffer;
    this.#floatingSelection = options.floatingSelection;
    this.#selectionOverlay = options.selectionOverlay;
    this.#eraseColor = options.eraseColor;
    this.#pipeline = options.pipeline;
  }

  /**
   * Uses the explicit erase color or the dominant border color.
   */
  #resolveEraseColor(
    rect: SelectionRect
  ): RGBA8 {
    return Select.resolveEraseColor(
      this.#canvasBuffer,
      rect,
      this.#eraseColor
    );
  }

  get rect(): SelectionRect | null {
    return this.#select.rect;
  }

  get isDragging(): boolean {
    return this.#select.state === "moving";
  }

  get hasSelection(): boolean {
    return this.#select.state === "selected" || this.#select.state === "moving";
  }

  get isFloating(): boolean {
    return this.#select.floating;
  }

  get shape(): boolean {
    return this.#shapeMode;
  }

  set shape(
    shapeMode: boolean
  ) {
    if (this.#shapeMode === shapeMode) {
      return;
    }

    this.#shapeMode = shapeMode;
    this.clear();
  }

  handleStart(
    pos: Vec2
  ): void {
    if (
      this.#select.state === "selected" &&
      this.#select.hitTest(pos)
    ) {
      this.#startMoveAt(pos);

      return;
    }

    this.clear();

    if (this.#shapeMode) {
      this.#startShapeSelection(pos);
    }
    else {
      const rect = this.#select.startCreate(pos);
      this.#selectionOverlay.drawRect(rect);
    }
  }

  #startMoveAt(
    pos: Vec2
  ): void {
    this.#select.startMove(pos);

    const rect = this.#select.rect;
    const snapshot = this.#select.snapshot;
    const mask = this.#select.mask;
    if (rect && snapshot && mask) {
      const blankSource = !this.#select.floating;
      const eraseColor = this.#resolveEraseColor(rect);
      this.#floatingSelection.create({
        sourceRect: rect,
        pixels: snapshot,
        mask,
        eraseColor,
        blankSource
      });
      this.#moveSourceRect = rect;
      this.#moveBlankSource = blankSource;
    }
  }

  #startShapeSelection(
    pos: Vec2
  ): void {
    const shape = ShapeSelect.compute(
      this.#canvasBuffer,
      pos
    );
    if (!shape) {
      return;
    }

    const snapshot = Select.captureSnapshot(
      this.#canvasBuffer,
      shape.rect
    );
    this.#select.selectRegion(
      shape.rect,
      snapshot,
      shape.mask
    );
    this.#selectionOverlay.drawMask(
      shape.rect,
      shape.mask
    );
    this.#publishSelectionState();
    // Shape selection has no command, so clear its peer ghost explicitly.
    this.emit("selection-idle");
  }

  handleMove(
    pos: Vec2
  ): void {
    if (this.#select.state === "creating") {
      const rect = this.#select.updateCreate(pos);
      if (rect) {
        this.#selectionOverlay.drawRect(rect);
        this.emit(
          "selection-progress",
          { phase: "creating", rect }
        );
      }

      return;
    }

    if (this.#select.state === "moving") {
      const rect = this.#select.updateMove(pos);
      const mask = this.#select.mask;
      if (rect && mask) {
        this.#selectionOverlay.drawMask(rect, mask);
        this.#floatingSelection.updatePosition(rect);
      }
      if (rect && mask && this.#moveSourceRect) {
        this.emit(
          "selection-progress",
          {
            phase: "moving",
            sourceRect: this.#moveSourceRect,
            liveRect: rect,
            mask,
            blankSource: this.#moveBlankSource
          }
        );
      }
    }
  }

  handleEnd(): void {
    if (this.#select.state === "creating") {
      const rect = this.#select.rect;
      const finalRect = rect
        ? clipRectToBounds(rect, this.#canvasBuffer.size())
        : null;
      if (
        !finalRect ||
        (finalRect.width === 1 && finalRect.height === 1)
      ) {
        this.clear();

        return;
      }

      const snapshot = Select.captureSnapshot(
        this.#canvasBuffer,
        finalRect
      );
      this.#select.finishCreate(
        snapshot,
        finalRect
      );
      this.#selectionOverlay.drawRect(finalRect);
      this.#publishSelectionState();
      // Creation has no command, so clear its peer ghost explicitly.
      this.emit("selection-idle");

      return;
    }

    if (this.#select.state === "moving") {
      const snapshot = this.#select.snapshot;
      const mask = this.#select.mask;
      const result = this.#select.finishMove();
      this.#floatingSelection.clear();
      this.#moveSourceRect = null;

      if (result && snapshot && mask) {
        this.#commitFootprintChange({
          oldRect: result.source,
          oldMask: mask,
          newRect: result.dest,
          newMask: mask,
          newContent: snapshot,
          skipErase: result.skipErase
        });
        // Drop the pending ghost tick after sending the command.
        this.emit("selection-committed");
      }
      else {
        // A no-op drag has no command, so clear its peer ghost explicitly.
        this.emit("selection-idle");
      }

      const rect = this.#select.rect;
      const currentMask = this.#select.mask;
      if (rect && currentMask) {
        this.#selectionOverlay.drawMask(
          rect,
          currentMask
        );
      }
      // A completed move writes the content, so a floating selection stops
      // being floating here.
      this.#publishSelectionState();
    }
  }

  exportSelection(): SelectionSnapshot | null {
    if (this.#select.state !== "selected") {
      return null;
    }

    return this.#select.exportSnapshot();
  }

  /**
   * Installs `snapshot` as a floating selection. Any selection already active
   * is deselected first, which deposits it if it was itself floating.
   */
  importSelection(
    snapshot: SelectionSnapshot
  ): boolean {
    const expectedLength = snapshot.rect.width * snapshot.rect.height;
    if (
      snapshot.pixels.length !== expectedLength ||
      snapshot.mask.length !== expectedLength ||
      !snapshot.mask.some(Boolean)
    ) {
      return false;
    }

    this.clear();
    this.#select.importSnapshot(snapshot);
    this.#showFloatingSelection(
      snapshot.rect,
      snapshot.pixels,
      snapshot.mask
    );
    this.#selectionOverlay.drawMask(
      snapshot.rect,
      snapshot.mask
    );
    this.#publishSelectionState();

    return true;
  }

  delete(): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    // A floating selection owns no buffer footprint: deleting it cancels the
    // paste rather than depositing it.
    if (this.#select.floating) {
      this.discard();

      return true;
    }

    const rect = this.#select.rect;
    const mask = this.#select.mask;
    if (!rect || !mask) {
      return false;
    }

    const eraseColor = this.#resolveEraseColor(rect);
    const eraseColors: RGBA8[] = new Array(
      rect.width * rect.height
    ).fill(eraseColor);
    this.#commitFootprintChange({
      oldRect: rect,
      oldMask: mask,
      newRect: rect,
      newMask: mask,
      newContent: eraseColors,
      skipErase: true
    });
    this.#select.markErased(eraseColor);

    return true;
  }

  rotate(): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    const isFloating = this.#select.floating;
    const oldMask = this.#select.mask;
    const result = this.#select.rotate();
    const snapshot = this.#select.snapshot;
    const newMask = this.#select.mask;
    if (!result || !snapshot || !oldMask || !newMask) {
      return false;
    }

    if (isFloating) {
      this.#showFloatingSelection(
        result.newRect,
        snapshot,
        newMask
      );
    }
    else {
      this.#commitFootprintChange({
        oldRect: result.oldRect,
        oldMask,
        newRect: result.newRect,
        newMask,
        newContent: snapshot,
        skipErase: false
      });
    }
    this.#selectionOverlay.drawMask(
      result.newRect,
      newMask
    );

    return true;
  }

  flipHorizontal(): boolean {
    return this.#handleFlip((select) => select.flipHorizontal());
  }

  flipVertical(): boolean {
    return this.#handleFlip((select) => select.flipVertical());
  }

  #handleFlip(
    flip: (select: Select) => SelectionRect | null
  ): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    const isFloating = this.#select.floating;
    const oldMask = this.#select.mask;
    const rect = flip(this.#select);
    const snapshot = this.#select.snapshot;
    const newMask = this.#select.mask;
    if (!rect || !snapshot || !oldMask || !newMask) {
      return false;
    }

    if (isFloating) {
      this.#showFloatingSelection(
        rect,
        snapshot,
        newMask
      );
    }
    else {
      this.#commitFootprintChange({
        oldRect: rect,
        oldMask,
        newRect: rect,
        newMask,
        newContent: snapshot,
        skipErase: false
      });
    }
    this.#selectionOverlay.drawMask(rect, newMask);

    return true;
  }

  /**
   * Deselects, depositing a floating selection into the buffer first so that
   * pixels the user can see are never destroyed by a stray click or a mode
   * change.
   */
  clear(): void {
    this.#depositFloating();
    this.discard();
  }

  /**
   * Deselects without depositing. For callers that replace the buffer
   * wholesale (resize, texture replacement, snapshot load), where the
   * floating rect no longer maps to anything.
   */
  discard(): void {
    const interruptedGesture = this.#select.state === "creating" || this.#select.state === "moving";

    this.#select.clear();
    this.#selectionOverlay.clear();
    this.#floatingSelection.clear();
    this.#moveSourceRect = null;

    // An interrupted gesture has no command, so clear its peer ghost explicitly.
    if (interruptedGesture) {
      this.emit("selection-idle");
    }
    this.#publishSelectionState();
  }

  /**
   * Writes floating content at its current rect. No source is erased: a
   * floating selection has no footprint to vacate.
   */
  #depositFloating(): void {
    if (
      this.#select.state !== "selected" ||
      !this.#select.floating
    ) {
      return;
    }

    const rect = this.#select.rect;
    const mask = this.#select.mask;
    const snapshot = this.#select.snapshot;
    if (!rect || !mask || !snapshot) {
      return;
    }

    // Flip the flag first: the commit runs history and hook callbacks that
    // may read back the tool's state.
    this.#select.markDeposited();
    this.#commitFootprintChange({
      oldRect: rect,
      oldMask: mask,
      newRect: rect,
      newMask: mask,
      newContent: snapshot,
      skipErase: true
    });
    this.emit("selection-committed");
  }

  refreshOverlay(): void {
    const rect = this.#select.rect;
    const mask = this.#select.mask;

    if (rect && mask) {
      this.#selectionOverlay.drawMask(rect, mask);
    }
  }

  #showFloatingSelection(
    rect: SelectionRect,
    pixels: RGBA8[],
    mask: boolean[]
  ): void {
    this.#floatingSelection.create({
      sourceRect: rect,
      pixels,
      mask,
      eraseColor: this.#resolveEraseColor(rect),
      blankSource: false
    });
  }

  #commitFootprintChange(
    change: {
      oldRect: SelectionRect;
      oldMask: boolean[];
      newRect: SelectionRect;
      newMask: boolean[];
      newContent: RGBA8[];
      skipErase: boolean;
    }
  ): void {
    const {
      oldRect,
      oldMask,
      newRect,
      newMask,
      newContent,
      skipErase
    } = change;

    const positions = unionMaskedPositions(
      { rect: oldRect, mask: oldMask },
      { rect: newRect, mask: newMask }
    );
    const beforeColors = this.#canvasBuffer.samplePixels(
      positions
    );

    if (!skipErase) {
      const eraseColor = this.#resolveEraseColor(oldRect);
      this.#canvasBuffer.drawPixels(
        maskedPositions({ rect: oldRect, mask: oldMask }),
        eraseColor
      );
    }
    this.#canvasBuffer.drawMaskedRegion(
      newRect,
      newContent,
      newMask
    );
    this.#canvasBuffer.copyToMaster();

    // Sampling after repaint still reads the updated buffer state.
    const afterColors = this.#canvasBuffer.samplePixels(
      positions
    );
    this.#pipeline.commitSelectionEdit({
      positions,
      beforeColors,
      afterColors,
      oldRect,
      newRect,
      oldMask,
      newMask
    });
  }

  syncSelectionAfterHistory(
    rect: SelectionRect,
    mask: boolean[]
  ): void {
    const snapshot = Select.captureSnapshot(
      this.#canvasBuffer,
      rect
    );
    this.#select.restoreRect(rect, snapshot, mask);
    this.#selectionOverlay.drawMask(rect, mask);
    this.#publishSelectionState();
  }

  #publishSelectionState(): void {
    const hasSelection = this.hasSelection;
    const isFloating = this.isFloating;
    if (
      hasSelection === this.#publishedHasSelection &&
      isFloating === this.#publishedIsFloating
    ) {
      return;
    }

    this.#publishedHasSelection = hasSelection;
    this.#publishedIsFloating = isFloating;
    this.emit(
      "selection-state-changed",
      {
        hasSelection,
        isFloating
      }
    );
  }
}

interface MaskedFootprint {
  rect: SelectionRect;
  mask: boolean[];
}

function* maskedPositions(
  footprint: MaskedFootprint
): IterableIterator<Vec2> {
  const { rect, mask } = footprint;

  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      if (mask[(y * rect.width) + x]) {
        yield {
          x: rect.x + x,
          y: rect.y + y
        };
      }
    }
  }
}

function unionMaskedPositions(
  a: MaskedFootprint,
  b: MaskedFootprint
): Vec2[] {
  const seen = new Set<string>();
  const result: Vec2[] = [];

  const positions = [
    ...maskedPositions(a),
    ...maskedPositions(b)
  ];
  for (const pos of positions) {
    const key = `${pos.x},${pos.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(pos);
    }
  }

  return result;
}
