// Import Third-party Dependencies
import type * as THREE from "three";
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "../rendering/BlockRenderSources.ts";
import { BlockPreviewMeshes } from "../rendering/BlockPreviewMeshes.ts";
import { BlockGrid } from "./BlockGrid.ts";
import { CellCaptures } from "./CellCaptures.ts";
import {
  CellRepaints,
  type CellLook
} from "./CellRepaints.ts";
import { TurntableAngles } from "./TurntableAngles.ts";
import { Turntable } from "../../preview/Turntable.ts";
import {
  PREVIEW_ROTATION_STEP,
  PREVIEW_STILL_ROTATION,
  type PreviewStage
} from "../../preview/PreviewStage.ts";

// CONSTANTS
const kSettleFrames = 6;

interface LiftedBlock {
  blockId: number;
  target: CanvasRenderingContext2D;
}

export class BlockLibraryRenderer extends Turntable {
  onLayoutChange: (() => void) | null = null;
  selectedId: number | null = null;
  hoveredId: number | null = null;
  libraryHovered = false;

  readonly #meshes: BlockPreviewMeshes;
  readonly #cell: THREE.RenderTarget;
  readonly #stopWatchingCompiles: () => void;
  #repaints = new CellRepaints<THREE.Mesh>();
  #captures = new CellCaptures();
  #capturing = new Set<number>();
  #capturingGhost = false;
  #angles = new TurntableAngles(PREVIEW_STILL_ROTATION, PREVIEW_ROTATION_STEP);
  #grid = new BlockGrid(1, 1);
  #canvasWidth = 0;
  #canvasHeight = 0;
  #drawnCols = 0;
  #drawnRows = 0;
  #drawnCellSize = 0;
  #cellPixels = 0;
  #pendingCellSize = 0;
  #stableFrames = 0;
  #layoutDirty = true;
  #lifted: LiftedBlock | null = null;

  constructor(
    container: HTMLElement,
    stage: PreviewStage,
    sources: BlockRenderSources
  ) {
    super(container, stage);
    this.#meshes = new BlockPreviewMeshes(sources);
    this.#cell = stage.createTarget();
    this.#stopWatchingCompiles = stage.watchCompiles(
      () => this.#repaints.invalidate()
    );
  }

  get grid(): BlockGrid {
    return this.#grid;
  }

  setBlocks(
    blocks: readonly ResolvedBlockDefinition[]
  ): void {
    this.#meshes.sync(blocks);
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
      this.#meshes.entries[index]?.block.id ?? null;
  }

  lift(
    blockId: number,
    target: HTMLCanvasElement
  ): void {
    const context = target.getContext("2d");
    if (context === null) {
      return;
    }

    if (this.#lifted?.target === context) {
      this.#lifted.blockId = blockId;
    }
    else {
      this.#lifted = {
        blockId,
        target: context
      };
    }
    this.hoveredId = null;
  }

  drop(): void {
    this.#lifted = null;
  }

  override dispose(): void {
    this.#stopWatchingCompiles();
    this.drop();
    this.#meshes.dispose();
    this.#cell.dispose();
    super.dispose();
  }

  protected override refresh(
    time: number
  ): void {
    this.#meshes.refresh(time);
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

    const { cols, cellSize } = this.#grid;
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    const { entries } = this.#meshes;
    const paints = this.#repaints.due(
      entries,
      {
        first: Math.floor(scrollTop / cellSize) * cols,
        last: (Math.ceil((scrollTop + containerHeight) / cellSize) * cols) - 1
      },
      this.#lookFor
    );

    for (const { index, mode } of paints) {
      if (mode === "erase") {
        this.#captures.erase(index);
        this.#clearCell(index);
        continue;
      }
      if (mode === "spinning" && this.#capturing.has(index)) {
        continue;
      }

      const { block, mesh } = entries[index];
      this.#paintCell(
        index,
        mesh,
        mode === "spinning" ?
          this.#angles.advance(block.id) :
          this.#angles.angleForBlock(block.id)
      );
    }

    this.#drawLifted();
  }

  readonly #lookFor = (
    blockId: number
  ): CellLook => {
    if (blockId === this.#lifted?.blockId) {
      return "hidden";
    }

    const spinning = blockId === this.hoveredId ||
      (this.libraryHovered && blockId === this.selectedId);

    return spinning ? "spinning" : "still";
  };

  #paintCell(
    index: number,
    mesh: THREE.Mesh,
    rotation: number
  ): void {
    const ticket = this.#captures.issue();
    this.#capturing.add(index);
    this.stage.capture(this.#cell, mesh, rotation)
      .then((image) => {
        if (this.#captures.land(index, ticket)) {
          const { x, y } = this.#cellOrigin(index);
          this.context?.putImageData(image, x, y);
        }
      })
      .finally(() => this.#capturing.delete(index));
  }

  #drawLifted(): void {
    const lifted = this.#lifted;
    if (lifted === null || this.#capturingGhost) {
      return;
    }

    const entry = this.#meshes.entries.find(
      (candidate) => candidate.block.id === lifted.blockId
    );
    if (entry === undefined) {
      return;
    }

    const pixels = this.#cellPixels;
    this.#capturingGhost = true;
    this.stage.capture(
      this.#cell,
      entry.mesh,
      this.#angles.advance(entry.block.id)
    )
      .then((image) => {
        if (lifted !== this.#lifted || image.width !== pixels) {
          return;
        }

        const { canvas } = lifted.target;
        if (canvas.width !== pixels || canvas.height !== pixels) {
          canvas.width = pixels;
          canvas.height = pixels;
        }
        lifted.target.putImageData(image, 0, 0);
      })
      .finally(() => {
        this.#capturingGhost = false;
      });
  }

  #cellOrigin(
    index: number
  ): { x: number; y: number; } {
    const pixels = this.#cellPixels;

    return {
      x: (index % this.#drawnCols) * pixels,
      y: Math.floor(index / this.#drawnCols) * pixels
    };
  }

  #clearCell(
    index: number
  ): void {
    const { x, y } = this.#cellOrigin(index);
    this.context?.clearRect(x, y, this.#cellPixels, this.#cellPixels);
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
    const rows = this.#grid.rows(this.#meshes.entries.length);
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
    this.#cellPixels = cellSize * this.stage.pixelRatio;
    this.#stableFrames = 0;
    this.canvas.width = cols * this.#cellPixels;
    this.canvas.height = rows * this.#cellPixels;
    this.#cell.setSize(this.#cellPixels, this.#cellPixels);
    this.#captures.reset();
    this.#repaints.invalidate();
  }
}
