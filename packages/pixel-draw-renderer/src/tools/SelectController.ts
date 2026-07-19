// Import Internal Dependencies
import { Select } from "./Select.ts";
import { ShapeSelect } from "./ShapeSelect.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type {
  CanvasRenderer
} from "../rendering/CanvasRenderer.ts";
import type {
  SelectionOverlay
} from "../rendering/overlays/SelectionOverlay.ts";
import type {
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";

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
  renderer: CanvasRenderer;
  selectionOverlay: SelectionOverlay;
  eraseColor: RGBA;
  /**
   * Commits a selection edit.
   */
  onCommit: (entry: SelectEditEntry) => void;
}

/**
 * Coordinates selection state, rendering, and commits.
 */
export class SelectController {
  #select = new Select();
  #canvasBuffer: CanvasBuffer;
  #renderer: CanvasRenderer;
  #selectionOverlay: SelectionOverlay;
  #eraseColor: RGBA;
  #onCommit: (entry: SelectEditEntry) => void;
  #shapeMode = false;

  constructor(
    options: SelectControllerOptions
  ) {
    this.#canvasBuffer = options.canvasBuffer;
    this.#renderer = options.renderer;
    this.#selectionOverlay = options.selectionOverlay;
    this.#eraseColor = options.eraseColor;
    this.#onCommit = options.onCommit;
  }

  get rect(): SelectionRect | null {
    return this.#select.rect;
  }

  /**
   * Whether empty-space clicks create shape selections.
   */
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

  /**
   * Starts creating or moving a selection.
   */
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
      this.#renderer.floatingSelection.create({
        sourceRect: rect,
        pixels: snapshot,
        mask,
        eraseColor: this.#eraseColor,
        blankSource: !this.#select.willSkipErase
      });
      this.#renderer.drawFrame();
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
  }

  handleMove(
    pos: Vec2
  ): void {
    if (this.#select.state === "creating") {
      const rect = this.#select.updateCreate(pos);
      if (rect) {
        this.#selectionOverlay.drawRect(rect);
      }

      return;
    }

    if (this.#select.state === "moving") {
      const rect = this.#select.updateMove(pos);
      const mask = this.#select.mask;
      if (rect && mask) {
        this.#selectionOverlay.drawMask(rect, mask);
        this.#renderer.floatingSelection.updatePosition(rect);
        this.#renderer.drawFrame();
      }
    }
  }

  handleEnd(): void {
    if (this.#select.state === "creating") {
      const rect = this.#select.rect;
      if (rect) {
        if (rect.width === 1 && rect.height === 1) {
          this.#select.clear();
          this.#selectionOverlay.clear();
        }
        else {
          const snapshot = Select.captureSnapshot(
            this.#canvasBuffer,
            rect
          );
          this.#select.finishCreate(snapshot);
        }
      }

      return;
    }

    if (this.#select.state === "moving") {
      const snapshot = this.#select.snapshot;
      const mask = this.#select.mask;
      const result = this.#select.finishMove();
      this.#renderer.floatingSelection.clear();

      if (result && snapshot && mask) {
        this.#commitFootprintChange({
          oldRect: result.source,
          oldMask: mask,
          newRect: result.dest,
          newMask: mask,
          newContent: snapshot,
          skipErase: result.skipErase
        });
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

  /**
   * Copies the active selection.
   */
  handleCopy(): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    this.#select.copy();

    return true;
  }

  /**
   * Pastes the clipboard as the active selection.
   */
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

  /**
   * Erases the active selection.
   */
  handleDelete(): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    const rect = this.#select.rect;
    const mask = this.#select.mask;
    if (!rect || !mask) {
      return false;
    }

    const eraseColors: RGBA[] = new Array(
      rect.width * rect.height
    ).fill(this.#eraseColor);
    this.#commitFootprintChange({
      oldRect: rect,
      oldMask: mask,
      newRect: rect,
      newMask: mask,
      newContent: eraseColors,
      skipErase: true
    });
    this.#select.markErased(this.#eraseColor);

    return true;
  }

  /**
   * Rotates the active selection clockwise.
   */
  handleRotate(): boolean {
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

  handleFlipHorizontal(): boolean {
    return this.#handleFlip((select) => select.flipHorizontal());
  }

  handleFlipVertical(): boolean {
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
    this.#select.clear();
    this.#selectionOverlay.clear();
    this.#renderer.floatingSelection.clear();
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
      this.#canvasBuffer.drawPixels(
        maskedPositions({ rect: oldRect, mask: oldMask }),
        this.#eraseColor
      );
    }
    this.#canvasBuffer.drawMaskedRegion(
      newRect,
      newContent,
      newMask
    );
    this.#canvasBuffer.copyToMaster();

    const afterColors = this.#canvasBuffer.samplePixels(positions);
    this.#renderer.drawFrame();
    this.#onCommit({
      positions,
      beforeColors,
      afterColors,
      oldRect,
      newRect,
      oldMask,
      newMask
    });
  }

  /**
   * Restores selection state after a history replay.
   */
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
