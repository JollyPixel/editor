// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import type { Cell } from "./viewport.ts";

export interface SeedVoxel extends Cell {
  blockId: number;
}

export class MapWorld {
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
  }

  blocks(
    cells: Cell[]
  ): Promise<Array<number | null>> {
    return this.#page.evaluate((targets) => {
      const { world } = window.voxelMapEditor!.workspace.view.document;

      return targets.map(
        (cell) => world.getVoxelAt(cell)?.blockId ?? null
      );
    }, cells);
  }

  voxelCount(): Promise<number> {
    return this.#page.evaluate(
      () => window.voxelMapEditor!.workspace.view.document.world.voxelCount
    );
  }

  async seed(
    voxels: SeedVoxel[],
    layerName = "Ground"
  ): Promise<void> {
    await this.#page.evaluate((args) => {
      const { view } = window.voxelMapEditor!.workspace;
      view.document.world.setVoxelBulk(
        args.layerName,
        args.voxels.map((voxel) => {
          return {
            position: {
              x: voxel.x,
              y: voxel.y,
              z: voxel.z
            },
            blockId: voxel.blockId
          };
        })
      );
    }, {
      voxels,
      layerName
    });
    await this.#page.waitForFunction((targets) => {
      const { view } = window.voxelMapEditor!.workspace;

      return targets.every((cell) => view.document.world.getVoxelAt(cell) !== undefined);
    }, voxels);
    await this.#page.evaluate(
      () => window.voxelMapEditor!.workspace.view.whenIdle()
    );
    await nextFrames(this.#page);
  }
}
