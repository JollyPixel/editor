// Import Third-party Dependencies
import type * as THREE from "three";
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "../rendering/BlockRenderSources.ts";
import { BlockGrid } from "./BlockGrid.ts";
import { CellRepaints } from "./CellRepaints.ts";
import { TurntableAngles } from "./TurntableAngles.ts";
import { BlockTurntable } from "../rendering/BlockTurntable.ts";
import {
  PREVIEW_ROTATION_STEP,
  PREVIEW_STILL_ROTATION
} from "../rendering/blockPreviewMesh.ts";

// CONSTANTS
const kSettleFrames = 6;

export class BlockLibraryRenderer extends BlockTurntable {
  onLayoutChange: (() => void) | null = null;
  selectedId: number | null = null;
  hoveredId: number | null = null;

  #repaints = new CellRepaints<THREE.Mesh>();
  #angles = new TurntableAngles(PREVIEW_STILL_ROTATION, PREVIEW_ROTATION_STEP);
  #clearPending = true;
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
    super(container, sources, {
      preserveDrawingBuffer: true
    });
    this.renderer.autoClear = false;
  }

  get grid(): BlockGrid {
    return this.#grid;
  }

  setBlocks(
    blocks: ResolvedBlockDefinition[]
  ): void {
    this.meshes.sync(blocks);
    this.#angles.keep(blocks.map((block) => block.id));
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

    if (this.#clearPending) {
      this.#clearPending = false;
      this.renderer.setScissorTest(false);
      this.renderer.clear();
    }

    const { cols, cellSize } = this.#grid;
    const drawnCellSize = this.#drawnCellSize;
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    const { entries } = this.meshes;
    const paints = this.#repaints.due(
      entries,
      {
        first: Math.floor(scrollTop / cellSize) * cols,
        last: (Math.ceil((scrollTop + containerHeight) / cellSize) * cols) - 1
      },
      this.#spins
    );

    for (const { index, mode } of paints) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * drawnCellSize;
      const y = (this.#drawnRows - 1 - row) * drawnCellSize;
      this.renderer.setViewport(x, y, drawnCellSize, drawnCellSize);
      this.renderer.setScissor(x, y, drawnCellSize, drawnCellSize);
      this.renderer.setScissorTest(true);
      this.renderer.clear();
      if (mode !== "erase") {
        const { block, mesh } = entries[index];
        this.renderMesh(
          mesh,
          mode === "spinning" ?
            this.#angles.advance(block.id) :
            this.#angles.angleForBlock(block.id)
        );
      }
    }

    this.renderer.setScissorTest(false);
  }

  readonly #spins = (
    blockId: number
  ): boolean => blockId === this.selectedId || blockId === this.hoveredId;

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
    this.#repaints.invalidate();
    this.#clearPending = true;
  }
}
