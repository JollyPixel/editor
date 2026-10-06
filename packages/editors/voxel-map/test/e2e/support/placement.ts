// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import type { Object3D } from "three";
import { pressAt } from "@jolly-pixel/e2e";
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  cellTopPoint,
  type Cell
} from "./scene.ts";

export interface PlacementSnapshot {
  kind: string;
  position: Cell;
  rotation: number;
  cells: Cell[];
  top: number;
}

export function placement(
  page: Page
): Promise<PlacementSnapshot | null> {
  return page.evaluate(() => {
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

export function peerPlacementCount(
  page: Page
): Promise<number> {
  return page.evaluate(() => {
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

export async function dragPlacement(
  page: Page,
  from: Cell,
  to: Cell
): Promise<void> {
  await pressAt(page, [
    await cellTopPoint(page, from),
    await cellTopPoint(page, to)
  ], { settle: nextFrames });
}

export async function hoverCell(
  page: Page,
  cell: Cell
): Promise<void> {
  const point = await cellTopPoint(page, cell);
  await page.mouse.move(point.x, point.y);
}
