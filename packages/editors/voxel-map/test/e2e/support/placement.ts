// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import type { Object3D } from "three";

// Import Internal Dependencies
import type { Cell } from "./viewport.ts";

export interface PlacementSnapshot {
  kind: string;
  position: Cell;
  rotation: number;
  cells: Cell[];
  top: number;
}

export class Placement {
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
  }

  current(): Promise<PlacementSnapshot | null> {
    return this.#page.evaluate(() => {
      const { workspace } = window.voxelMapEditor!;
      const current = workspace.placement.current;
      if (current === null) {
        return null;
      }

      const { template, placement: { position, transform } } = current;
      const cells = [...template.placedVoxels(position, transform)]
        .map(([x, y, z]) => {
          return { x, y, z };
        });

      return {
        kind: current.kind,
        position: { ...position },
        rotation: transform.rotation,
        cells,
        top: Math.max(...cells.map((cell) => cell.y)) + 1
      };
    });
  }

  peerPreviews(): Promise<number> {
    return this.#page.evaluate(() => {
      let root: Object3D = window.voxelMapEditor!.workspace.view.root;
      while (root.parent !== null) {
        root = root.parent;
      }

      let count = 0;
      root.traverseVisible((object) => {
        if (object.name.startsWith("peer-placement:")) {
          count++;
        }
      });

      return count;
    });
  }
}
