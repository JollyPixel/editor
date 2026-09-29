// Import Third-party Dependencies
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "../rendering/BlockRenderSources.ts";
import { BlockGrid } from "./BlockGrid.ts";
import { BlockTurntable } from "../rendering/BlockTurntable.ts";

// CONSTANTS
const kSettleFrames = 6;

export class BlockLibraryRenderer extends BlockTurntable {
  onLayoutChange: (() => void) | null = null;

  #grid = new BlockGrid(1, 1);
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

  get grid(): BlockGrid {
    return this.#grid;
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
    const index = this.#grid.indexAt(px, py);

    return index === null ?
      null :
      this.meshes.entries[index]?.block.id ?? null;
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

    const { cols, cellSize } = this.#grid;
    const drawnCellSize = this.#drawnCellSize;
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;

    this.meshes.entries.forEach((entry, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
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
    const grid = BlockGrid.fit(this.container.clientWidth - paddingH);

    const changed = !grid.equals(this.#grid);
    this.#grid = grid;
    if (changed) {
      this.onLayoutChange?.();
    }
  }

  #syncCanvasSize(): void {
    const { cols, cellSize } = this.#grid;
    const rows = this.#grid.rows(this.meshes.entries.length);
    const width = cols * cellSize;
    const height = rows * cellSize;
    if (width !== this.#canvasWidth || height !== this.#canvasHeight) {
      this.#canvasWidth = width;
      this.#canvasHeight = height;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }

    const reflowed = cols !== this.#drawnCols ||
      rows !== this.#drawnRows;
    if (!reflowed) {
      if (cellSize === this.#drawnCellSize) {
        this.#stableFrames = 0;

        return;
      }

      if (cellSize === this.#pendingCellSize) {
        this.#stableFrames++;
      }
      else {
        this.#pendingCellSize = cellSize;
        this.#stableFrames = 0;
      }
      if (this.#stableFrames < kSettleFrames) {
        return;
      }
    }

    this.#drawnCols = cols;
    this.#drawnRows = rows;
    this.#drawnCellSize = cellSize;
    this.#stableFrames = 0;
    this.renderer.setSize(width, height, false);
  }
}
