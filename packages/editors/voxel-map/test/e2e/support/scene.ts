// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// CONSTANTS
const kCameraPose = {
  position: {
    x: 0.5,
    y: 14,
    z: 10.5
  },
  pitch: -Math.atan2(14, 10)
};

export type MouseButton = "left" | "right";

export interface Cell {
  x: number;
  y: number;
  z: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export async function pinCamera(
  page: Page
): Promise<void> {
  await page.evaluate((pose) => {
    const orbit = window.voxelMapEditor!.scene.camera!;
    const { camera } = orbit;
    const rotation = camera.rotation.clone().set(pose.pitch, 0, 0, "YXZ");
    orbit.teleport({
      position: pose.position,
      quaternion: camera.quaternion.clone().setFromEuler(rotation)
    });
  }, kCameraPose);
  await nextFrames(page);
}

export function nextFrames(
  page: Page,
  count = 2
): Promise<void> {
  return page.evaluate(async(frames) => {
    const { world } = window.voxelMapEditor!.runtime;
    for (let index = 0; index < frames; index++) {
      await new Promise<void>((resolve) => {
        world.once("afterUpdate", () => resolve());
      });
    }
  }, count);
}

export function cellTopPoint(
  page: Page,
  cell: Cell
): Promise<ScreenPoint> {
  return page.evaluate((target) => {
    const { scene } = window.voxelMapEditor!;
    const camera = scene.camera!.camera;
    const canvas = scene.world.renderer.canvas;
    const bounds = canvas.getBoundingClientRect();
    const point = camera.position.clone().set(
      target.x + 0.5,
      target.y,
      target.z + 0.5
    );
    camera.updateMatrixWorld(true);
    point.project(camera);

    return {
      x: bounds.left + ((point.x + 1) / 2 * bounds.width),
      y: bounds.top + ((1 - point.y) / 2 * bounds.height)
    };
  }, cell);
}

export async function pressAt(
  page: Page,
  points: ScreenPoint[],
  button: MouseButton = "left"
): Promise<void> {
  const [first, ...rest] = points;
  await page.mouse.move(first.x, first.y);
  await nextFrames(page);
  await page.mouse.down({ button });
  await nextFrames(page);
  for (const point of rest) {
    await page.mouse.move(point.x, point.y, { steps: 4 });
    await nextFrames(page);
  }
  await page.mouse.up({ button });
  await nextFrames(page);
}

export async function clickCell(
  page: Page,
  cell: Cell,
  button: MouseButton = "left"
): Promise<void> {
  await pressAt(page, [await cellTopPoint(page, cell)], button);
}

export async function strokeCells(
  page: Page,
  cells: Cell[],
  button: MouseButton = "left"
): Promise<void> {
  const points: ScreenPoint[] = [];
  for (const cell of cells) {
    points.push(await cellTopPoint(page, cell));
  }
  await pressAt(page, points, button);
}

export function blocksAt(
  page: Page,
  cells: Cell[]
): Promise<Array<number | null>> {
  return page.evaluate((targets) => {
    const { world } = window.voxelMapEditor!.workspace.engine;

    return targets.map(
      (cell) => world.getVoxelAt(cell)?.blockId ?? null
    );
  }, cells);
}

export function voxelCount(
  page: Page
): Promise<number> {
  return page.evaluate(
    () => window.voxelMapEditor!.workspace.engine.world.voxelCount
  );
}

export async function seedVoxels(
  page: Page,
  cells: Array<Cell & { blockId: number; }>,
  layerName = "Ground"
): Promise<void> {
  await page.evaluate((args) => {
    const { engine } = window.voxelMapEditor!.workspace;
    engine.world.setVoxelBulk(
      args.layerName,
      args.cells.map((cell) => {
        return {
          position: {
            x: cell.x,
            y: cell.y,
            z: cell.z
          },
          blockId: cell.blockId
        };
      })
    );
  }, {
    cells,
    layerName
  });
  await page.waitForFunction((targets) => {
    const { engine } = window.voxelMapEditor!.workspace;

    return targets.every((cell) => engine.world.getVoxelAt(cell) !== undefined) &&
      engine.inspector.mesh.stats.voxels === engine.world.voxelCount;
  }, cells);
  await nextFrames(page);
}
