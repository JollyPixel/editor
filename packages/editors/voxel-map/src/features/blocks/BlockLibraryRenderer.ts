// Import Third-party Dependencies
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "./blockGeometry.ts";
import {
  blockGridRows,
  computeBlockGridLayout,
  type BlockGridLayout
} from "./blockGridLayout.ts";
import { BlockTurntable } from "./BlockTurntable.ts";

// CONSTANTS
const kSettleFrames = 6;

export class BlockLibraryRenderer extends BlockTurntable {
  onLayoutChange: (() => void) | null = null;

  #cols = 1;
  #cellSize = 1;
  #canvasWidth = 0;
  #canvasHeight = 0;
  #drawnCols = 0;
  #drawnRows = 0;
  #drawnCellSize = 0;
  #pendingCellSize = 0;
  #stableFrames = 0;
  #layoutDirty = true;

  constructor(
    container: HTMLElement,
    sources: BlockRenderSources
  ) {
    super(container, sources);
    this.renderer.autoClear = false;
  }

  get layout(): BlockGridLayout {
    return {
      cols: this.#cols,
      cellSize: this.#cellSize
    };
  }

  setBlocks(
    blocks: ResolvedBlockDefinition[]
  ): void {
    this.meshes.sync(blocks);
    this.#relayout();
  }

  blockAt(
    px: number,
    py: number
  ): number | null {
    const col = Math.floor(px / this.#cellSize);
    const row = Math.floor(py / this.#cellSize);
    if (col < 0 || row < 0 || col >= this.#cols) {
      return null;
    }

    return this.meshes.entries[(row * this.#cols) + col]?.block.id ?? null;
  }

  protected override resized(): void {
    this.#layoutDirty = true;
  }

  protected override draw(): void {
    if (this.#layoutDirty) {
      this.#relayout();
    }
    this.#syncCanvasSize();
    if (this.#canvasWidth === 0 || this.#canvasHeight === 0) {
      return;
    }

    this.renderer.clear();

    const cellSize = this.#cellSize;
    const drawnCellSize = this.#drawnCellSize;
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;

    this.meshes.entries.forEach((entry, index) => {
      const col = index % this.#cols;
      const row = Math.floor(index / this.#cols);
      const cellTop = row * cellSize;
      if (cellTop + cellSize <= scrollTop || cellTop >= scrollTop + containerHeight) {
        return;
      }

      const x = col * drawnCellSize;
      const y = (this.#drawnRows - 1 - row) * drawnCellSize;
      this.renderer.setViewport(x, y, drawnCellSize, drawnCellSize);
      this.renderer.setScissor(x, y, drawnCellSize, drawnCellSize);
      this.renderer.setScissorTest(true);
      this.renderer.clearDepth();
      this.renderMesh(entry.mesh);
    });

    this.renderer.setScissorTest(false);
  }

  #relayout(): void {
    this.#layoutDirty = false;

    const style = getComputedStyle(this.container);
    const paddingH = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const layout = computeBlockGridLayout(
      this.container.clientWidth - paddingH
    );

    const changed = layout.cols !== this.#cols ||
      layout.cellSize !== this.#cellSize;
    this.#cols = layout.cols;
    this.#cellSize = layout.cellSize;
    if (changed) {
      this.onLayoutChange?.();
    }
  }

  #syncCanvasSize(): void {
    const rows = blockGridRows(this.meshes.entries.length, this.#cols);
    const width = this.#cols * this.#cellSize;
    const height = rows * this.#cellSize;
    if (width !== this.#canvasWidth || height !== this.#canvasHeight) {
      this.#canvasWidth = width;
      this.#canvasHeight = height;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }

    const reflowed = this.#cols !== this.#drawnCols ||
      rows !== this.#drawnRows;
    if (!reflowed) {
      if (this.#cellSize === this.#drawnCellSize) {
        this.#stableFrames = 0;

        return;
      }

      if (this.#cellSize === this.#pendingCellSize) {
        this.#stableFrames++;
      }
      else {
        this.#pendingCellSize = this.#cellSize;
        this.#stableFrames = 0;
      }
      if (this.#stableFrames < kSettleFrames) {
        return;
      }
    }

    this.#drawnCols = this.#cols;
    this.#drawnRows = rows;
    this.#drawnCellSize = this.#cellSize;
    this.#stableFrames = 0;
    this.renderer.setSize(width, height, false);
  }
}
