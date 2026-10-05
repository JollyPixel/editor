// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import { pressAt } from "@jolly-pixel/e2e";
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  brushState,
  ghostState,
  setBrush
} from "./support/brush.ts";
import {
  cellTopPoint,
  clickCell,
  pinCamera,
  pointAt,
  seedVoxels,
  voxelCount,
  type Cell
} from "./support/scene.ts";

// CONSTANTS
const kSlabBottom = 2;
const kSlabTop = 3;
const kOtherSlabTop = 4;
const kCell = { x: 0, y: 0, z: 0 };
const kUpperHalf = { x: 0, y: 1, z: 0 };
const kLowerHalfFront = { x: 0.5, y: 0.25, z: 1 };

async function defineSlabs(
  page: Page
): Promise<void> {
  await page.evaluate((slabs) => {
    const { workspace } = window.voxelMapEditor!;
    for (const [id, shapeId] of slabs) {
      workspace.tilesets.defineBlock({
        ...workspace.view.document.blocks.get(id)!,
        shapeId
      });
    }
  }, [
    [kSlabBottom, "slabBottom"],
    [kSlabTop, "slabTop"],
    [kOtherSlabTop, "slabTop"]
  ] as const);
}

async function seedSlabPair(
  page: Page
): Promise<void> {
  await defineSlabs(page);
  await page.evaluate((args) => {
    const { world } = window.voxelMapEditor!.workspace.view.document;
    world.setVoxel("Ground", { position: args.cell, blockId: args.bottom });
    world.setVoxel("Ground", {
      position: args.cell,
      blockId: args.top,
      merge: true
    });
  }, {
    cell: kCell,
    bottom: kSlabBottom,
    top: kSlabTop
  });
}

function cellParts(
  page: Page
): Promise<Array<number | null>> {
  return page.evaluate((cell) => {
    const { world } = window.voxelMapEditor!.workspace.view.document;
    const entry = world.getVoxelAt(cell);

    return [entry?.blockId ?? null, entry?.partner?.blockId ?? null];
  }, kCell);
}

function removalSpan(
  page: Page
) {
  return page.evaluate(() => {
    const { localBrush } = window.voxelMapEditor!.workspace;
    const ghost = localBrush.actor.object3D.getObjectByName("removal-ghost");
    const mesh = ghost?.children[0] as { geometry?: any; } | undefined;
    if (!ghost?.visible || mesh?.geometry === undefined) {
      return null;
    }

    mesh.geometry.computeBoundingBox();
    const { min, max } = mesh.geometry.boundingBox;

    return [min.y, max.y].map((local: number) => {
      const height = ghost.position.y + (ghost.scale.y * (local - 0.5));

      return (Math.round(height * 10) / 10) + 0;
    });
  });
}

async function hover(
  page: Page,
  point: Cell
): Promise<void> {
  const screen = await pointAt(page, point);
  await page.mouse.move(screen.x, screen.y);
}

async function pickAt(
  page: Page,
  point: Cell
): Promise<void> {
  const screen = await pointAt(page, point);
  await page.keyboard.down("Control");
  await pressAt(page, [screen], { settle: nextFrames });
  await page.keyboard.up("Control");
}

test.beforeEach(async({ page }) => {
  await pinCamera(page);
});

test("a click on a half block merges its complement into the same cell", async({ page }) => {
  await defineSlabs(page);
  await seedVoxels(page, [{ ...kCell, blockId: kSlabBottom }]);
  await setBrush(page, { blockId: kSlabTop });
  const slabTop = { x: 0, y: 0.5, z: 0 };

  await test.step("the ghost previews the merge inside the cell", async() => {
    await page.locator("voxel-brush-toolbar")
      .getByRole("button", { name: /^Ghost block/ })
      .click();
    const point = await cellTopPoint(page, slabTop);
    await page.mouse.move(point.x, point.y);
    await expect.poll(() => ghostState(page)).toEqual({
      visible: true,
      position: [0.5, 0.5, 0.5]
    });
  });

  await test.step("a click merges the two halves into one voxel", async() => {
    await clickCell(page, slabTop);
    await expect.poll(() => cellParts(page)).toEqual([kSlabBottom, kSlabTop]);
    expect(await voxelCount(page)).toBe(1);
  });
});

test("a right click removes the aimed half and undo brings it back", async({ page }) => {
  await seedSlabPair(page);

  await test.step("the cursor outlines the aimed half", async() => {
    await hover(page, kLowerHalfFront);
    await expect.poll(() => removalSpan(page)).toEqual([0, 0.5]);
    await hover(page, { x: 0.5, y: 1, z: 0.5 });
    await expect.poll(() => removalSpan(page)).toEqual([0.5, 1]);
  });

  await test.step("the right click keeps the other half", async() => {
    await clickCell(page, kUpperHalf, "right");
    await expect.poll(() => cellParts(page)).toEqual([kSlabBottom, null]);
    await expect.poll(() => removalSpan(page)).toBeNull();
  });

  await test.step("undo restores the pair", async() => {
    await page.keyboard.press("Control+KeyZ");
    await expect.poll(() => cellParts(page)).toEqual([kSlabBottom, kSlabTop]);
  });
});

test("Ctrl+click picks the half under the cursor", async({ page }) => {
  await seedSlabPair(page);
  await setBrush(page, { blockId: 1 });

  await pickAt(page, { x: 0.5, y: 1, z: 0.5 });
  await expect.poll(async() => (await brushState(page)).blockId).toBe(kSlabTop);

  await pickAt(page, kLowerHalfFront);
  await expect.poll(async() => (await brushState(page)).blockId).toBe(kSlabBottom);
});

test("replace mode repaints only the aimed half", async({ page }) => {
  await seedSlabPair(page);
  await setBrush(page, { blockId: kOtherSlabTop });
  await page.keyboard.press("KeyR");
  await expect.poll(async() => (await brushState(page)).mode).toBe("replace");

  await clickCell(page, kUpperHalf);

  await expect.poll(() => cellParts(page)).toEqual([kSlabBottom, kOtherSlabTop]);
  expect(await voxelCount(page)).toBe(1);
});
