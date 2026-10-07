// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import type { Object3D } from "three";
import { pressAt } from "@jolly-pixel/e2e";
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  dragPlacement,
  hoverCell,
  peerPlacementCount,
  placement
} from "./support/placement.ts";
import {
  blocksAt,
  clickCell,
  pinCamera,
  pivotOnCell,
  pointAt,
  seedVoxels,
  voxelCount,
  type Cell
} from "./support/scene.ts";

// CONSTANTS
const kRow: Cell[] = [0, 1, 2].map((x) => {
  return { x, y: 0, z: 0 };
});
const kOutside: Cell = { x: 5, y: 0, z: 0 };

async function seed(
  page: Page,
  cells: Cell[]
): Promise<void> {
  await seedVoxels(page, cells.map((cell) => {
    return { ...cell, blockId: 1 };
  }));
  await pinCamera(page);
}

async function useSelectTool(
  page: Page
): Promise<void> {
  await hoverCell(page, kOutside);
  await page.keyboard.press("m");
}

async function selectRow(
  page: Page
): Promise<void> {
  const last = kRow.at(-1)!;
  await pressAt(page, [
    await pointAt(page, { x: 0.5, y: 1, z: 0.5 }),
    await pointAt(page, { x: last.x + 0.5, y: 0.5, z: 0.5 })
  ], { settle: nextFrames });
}

function cursorVisible(
  page: Page
): Promise<boolean> {
  return page.evaluate(() => {
    let root: Object3D = window.voxelMapEditor!.workspace.view.root;
    while (root.parent !== null) {
      root = root.parent;
    }

    return root.getObjectByName("marquee-draft")?.visible === true;
  });
}

function raiseCamera(
  page: Page,
  height: number
): Promise<void> {
  return page.evaluate((rise) => {
    const orbit = window.voxelMapEditor!.scene.camera!;
    const { camera } = orbit;
    orbit.teleport({
      position: {
        x: camera.position.x,
        y: camera.position.y + rise,
        z: camera.position.z
      },
      quaternion: camera.quaternion.clone()
    });
  }, height);
}

test("a dragged marquee cuts the blocks it covers until the selection is committed", async({ page }) => {
  test.slow();
  await seed(page, [...kRow, kOutside]);
  const toolbar = page.locator("voxel-edit-toolbar");

  await toolbar.getByRole("button", { name: /^Select/ }).click();
  await expect(toolbar.getByRole("group", { name: "Brush" })).toBeHidden();
  await hoverCell(page, kRow[0]);
  await expect.poll(() => cursorVisible(page)).toBe(true);
  await selectRow(page);
  expect(await cursorVisible(page)).toBe(false);

  const lifted = await placement(page);
  expect(lifted?.kind).toBe("region");
  expect(lifted?.cells).toHaveLength(kRow.length);
  expect(await blocksAt(page, kRow)).toEqual([null, null, null]);
  await expect(page.locator("voxel-placement-controls").getByRole("status"))
    .toHaveText("Selection → Ground");

  const grab = {
    ...kRow[1],
    y: lifted!.top
  };
  await dragPlacement(page, grab, {
    ...grab,
    z: grab.z + 3
  });
  await expect.poll(async() => (await placement(page))?.position.z)
    .toBe(lifted!.position.z + 3);
  const moved = await placement(page);

  await hoverCell(page, kOutside);
  await page.keyboard.press("Enter");
  await expect.poll(() => placement(page)).toBeNull();
  expect(await blocksAt(page, moved!.cells)).toEqual([1, 1, 1]);
  expect(await blocksAt(page, kRow)).toEqual([null, null, null]);
  expect(await blocksAt(page, [kOutside])).toEqual([1]);

  await page.keyboard.press("Control+KeyZ");
  await expect.poll(() => blocksAt(page, kRow)).toEqual([1, 1, 1]);
  expect(await voxelCount(page)).toBe(kRow.length + 1);
});

test("the marquee grows in height while the camera rises during the drag", async({ page }) => {
  const step: Cell = { x: 1, y: 1, z: 0 };
  await seed(page, [kRow[0], step, kOutside]);
  await useSelectTool(page);

  const from = await pointAt(page, { x: 0.5, y: 1, z: 0.5 });
  const to = await pointAt(page, { x: 1.5, y: 0.5, z: 0.5 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await nextFrames(page);
  await raiseCamera(page, 2);
  await nextFrames(page);
  await page.mouse.up();

  await expect.poll(async() => (await placement(page))?.cells.length).toBe(2);
  expect(await blocksAt(page, [kRow[0], step])).toEqual([null, null]);
});

test("Delete removes the selected blocks only", async({ page }) => {
  await seed(page, [...kRow, kOutside]);
  await useSelectTool(page);
  await selectRow(page);
  await expect.poll(async() => (await placement(page))?.kind).toBe("region");

  await hoverCell(page, kOutside);
  await page.keyboard.press("Delete");

  await expect.poll(() => placement(page)).toBeNull();
  expect(await blocksAt(page, [...kRow, kOutside])).toEqual([null, null, null, 1]);
});

test("a click in connected mode selects the touching blocks only", async({ page }) => {
  await seed(page, [...kRow, kOutside]);
  const toolbar = page.locator("voxel-edit-toolbar");
  await toolbar.getByRole("button", { name: /^Select/ }).click();
  await toolbar.getByRole("button", { name: /^Connected select/ }).click();

  await clickCell(page, kRow[2]);

  await expect.poll(async() => (await placement(page))?.cells.length)
    .toBe(kRow.length);
  expect(await blocksAt(page, [...kRow, kOutside])).toEqual([null, null, null, 1]);

  await hoverCell(page, kOutside);
  await page.keyboard.press("Delete");
  await expect.poll(() => placement(page)).toBeNull();
  expect(await blocksAt(page, [...kRow, kOutside])).toEqual([null, null, null, 1]);
});

test("a peer sees the cursor and the selection; Escape puts the blocks back", async({ page, peer }) => {
  test.slow();
  await seed(page, [...kRow, kOutside]);
  await useSelectTool(page);
  await expect.poll(() => peerPlacementCount(peer)).toBe(1);

  await selectRow(page);
  await expect.poll(async() => (await placement(page))?.kind).toBe("region");
  await expect.poll(() => peerPlacementCount(peer)).toBe(1);

  const toolbar = page.locator("voxel-edit-toolbar");
  await hoverCell(page, kOutside);
  await page.keyboard.press("Escape");
  await expect.poll(() => placement(page)).toBeNull();
  expect(await blocksAt(page, kRow)).toEqual([1, 1, 1]);
  await expect(toolbar).toHaveAttribute("mode", "select");

  await page.keyboard.press("Escape");
  await expect(toolbar).toHaveAttribute("mode", "paint");
  await expect.poll(() => peerPlacementCount(peer)).toBe(0);
});

test("Alt+click pivots the camera, then Escape leaves the pivot before the select tool", async({ page }) => {
  await seed(page, [...kRow, kOutside]);
  await useSelectTool(page);
  const toolbar = page.locator("voxel-edit-toolbar");
  const log = page.locator("jolly-log");

  await pivotOnCell(page, kRow[1]);
  await expect(log).toContainText("Camera switched to pivot");
  expect(await placement(page)).toBeNull();

  await page.keyboard.press("Escape");
  await expect(log).toContainText("Camera switched to free fly");
  await expect(toolbar).toHaveAttribute("mode", "select");

  await page.keyboard.press("Escape");
  await expect(toolbar).toHaveAttribute("mode", "paint");
});

test("Ctrl+C then Ctrl+V floats a copy under the cursor, committed by a click outside", async({ page }) => {
  test.slow();
  await seed(page, [...kRow, kOutside]);
  await useSelectTool(page);
  const paste = page.locator("voxel-edit-toolbar")
    .getByRole("button", { name: /^Paste/, includeHidden: true });
  await selectRow(page);
  await expect.poll(async() => (await placement(page))?.kind).toBe("region");

  await hoverCell(page, kOutside);
  await page.keyboard.press("Control+KeyC");
  await expect(paste.first()).toBeEnabled();
  await hoverCell(page, { x: 1, y: 0, z: 4 });
  await page.keyboard.press("Control+KeyV");

  await expect.poll(async() => (await placement(page))?.kind).toBe("copy");
  expect(await blocksAt(page, kRow)).toEqual([1, 1, 1]);
  const pasted = await placement(page);
  expect(pasted?.position.z).toBeGreaterThan(0);

  await clickCell(page, { x: 5, y: 0, z: 2 });
  await expect.poll(() => placement(page)).toBeNull();
  expect(await blocksAt(page, pasted!.cells)).toEqual([1, 1, 1]);
  expect(await voxelCount(page)).toBe((kRow.length * 2) + 1);
});
