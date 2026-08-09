// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { Select } from "./Select.ts";
import { ShapeSelect } from "./ShapeSelect.ts";
import type { SelectControllerEvent } from "./SelectController.events.ts";
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
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";

export type {
  SelectControllerEvent,
  SelectionProgressEvent
} from "./SelectController.events.ts";

export interface SelectEditEntry {
  positions: Vec2[];
  beforeColors: RGBA[];
  afterColors: RGBA[];
  oldRect: SelectionRect;
  newRect: SelectionRect;
  oldMask: boolean[];
  newMask: boolean[];
}

export interface SelectControllerOptions {
  canvasBuffer: CanvasBuffer;
  floatingSelection: FloatingSelection;
  selectionOverlay: SelectionOutline;
  /**
   * Explicit fill for a vacated footprint (Move/Rotate/Flip source, or
   * Delete), overriding the smart default below. `null` when not
   * configured by the consumer.
   */
  eraseColor: RGBA | null;
  pipeline: EditPipeline;
}

export interface SelectTool {
  /**
   * Whether empty-space clicks create shape selections.
   */
  shape: boolean;
  readonly hasSelection: boolean;
  /**
   * Returns `false` when there is no active selection.
   */
  rotate(): boolean;
  flipHorizontal(): boolean;
  flipVertical(): boolean;
}

export class SelectController extends Emitter<SelectControllerEvent> implements SelectTool {
  #select = new Select();
  #canvasBuffer: CanvasBuffer;
  #floatingSelection: FloatingSelection;
  #selectionOverlay: SelectionOutline;
  #eraseColor: RGBA | null;
  #pipeline: EditPipeline;
  #shapeMode = false;
  #moveSourceRect: SelectionRect | null = null;
  #moveBlankSource = true;

  constructor(
    options: SelectControllerOptions
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
  ): RGBA {
    return Select.resolveEraseColor(this.#canvasBuffer, rect, this.#eraseColor);
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
      const blankSource = !this.#select.willSkipErase;
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
    const shape = ShapeSelect.compute(this.#canvasBuffer, pos);
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
    this.#selectionOverlay.drawMask(shape.rect, shape.mask);
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
        this.emit("selection-progress", { phase: "creating", rect });
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
        this.emit("selection-progress", {
          phase: "moving",
          sourceRect: this.#moveSourceRect,
          liveRect: rect,
          mask,
          blankSource: this.#moveBlankSource
        });
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
        this.#select.clear();
        this.#selectionOverlay.clear();
        this.emit("selection-idle");

        return;
      }

      const snapshot = Select.captureSnapshot(
        this.#canvasBuffer,
        finalRect
      );
      this.#select.finishCreate(snapshot, finalRect);
      this.#selectionOverlay.drawRect(finalRect);
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
    }
  }

  handleCopy(): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    this.#select.copy();

    return true;
  }

  handlePaste(): boolean {
    const result = this.#select.paste();
    if (!result) {
      return false;
    }

    this.#commitFootprintChange({
      oldRect: result.rect,
      oldMask: result.mask,
      newRect: result.rect,
      newMask: result.mask,
      newContent: result.pixels,
      skipErase: true
    });
    this.#selectionOverlay.drawMask(
      result.rect,
      result.mask
    );

    return true;
  }

  handleDelete(): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    const rect = this.#select.rect;
    const mask = this.#select.mask;
    if (!rect || !mask) {
      return false;
    }

    const eraseColor = this.#resolveEraseColor(rect);
    const eraseColors: RGBA[] = new Array(
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

    const oldMask = this.#select.mask;
    const result = this.#select.rotate();
    const snapshot = this.#select.snapshot;
    const newMask = this.#select.mask;
    if (!result || !snapshot || !oldMask || !newMask) {
      return false;
    }

    this.#commitFootprintChange({
      oldRect: result.oldRect,
      oldMask,
      newRect: result.newRect,
      newMask,
      newContent: snapshot,
      skipErase: false
    });
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

    const oldMask = this.#select.mask;
    const rect = flip(this.#select);
    const snapshot = this.#select.snapshot;
    const newMask = this.#select.mask;
    if (!rect || !snapshot || !oldMask || !newMask) {
      return false;
    }

    this.#commitFootprintChange({
      oldRect: rect,
      oldMask,
      newRect: rect,
      newMask,
      newContent: snapshot,
      skipErase: false
    });
    this.#selectionOverlay.drawMask(rect, newMask);

    return true;
  }

  clear(): void {
    const interruptedGesture = this.#select.state === "creating" || this.#select.state === "moving";

    this.#select.clear();
    this.#selectionOverlay.clear();
    this.#floatingSelection.clear();
    this.#moveSourceRect = null;

    // An interrupted gesture has no command, so clear its peer ghost explicitly.
    if (interruptedGesture) {
      this.emit("selection-idle");
    }
  }

  refreshOverlay(): void {
    const rect = this.#select.rect;
    const mask = this.#select.mask;

    if (rect && mask) {
      this.#selectionOverlay.drawMask(rect, mask);
    }
  }

  #commitFootprintChange(
    change: {
      oldRect: SelectionRect;
      oldMask: boolean[];
      newRect: SelectionRect;
      newMask: boolean[];
      newContent: RGBA[];
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
    const beforeColors = this.#canvasBuffer.samplePixels(positions);

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
    const afterColors = this.#canvasBuffer.samplePixels(positions);
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
        yield { x: rect.x + x, y: rect.y + y };
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

  for (const pos of [...maskedPositions(a), ...maskedPositions(b)]) {
    const key = `${pos.x},${pos.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(pos);
    }
  }

  return result;
}
