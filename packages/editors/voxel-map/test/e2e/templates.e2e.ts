// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import {
  centerOf,
  pressAt
} from "@jolly-pixel/e2e";
import {
  nextFrames,
  waitForEditor
} from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import { openPane } from "./support/panels.ts";
import {
  blocksAt,
  cellTopPoint,
  pinCamera,
  seedVoxels,
  voxelCount,
  type Cell
} from "./support/scene.ts";

interface PlacementSnapshot {
  position: Cell;
  rotation: number;
  cells: Cell[];
  top: number;
}

function placement(
  page: Page
): Promise<PlacementSnapshot | null> {
  return page.evaluate(() => {
    const { workspace } = window.voxelMapEditor!;
    const current = workspace.placement.store.placement;
    const template = current?.source.resolve(workspace.view.document.world);
    if (current === null || template === undefined) {
      return null;
    }

    const cells = [...template.placedVoxels(current.position, current.transform)]
      .map(([x, y, z]) => {
        return { x, y, z };
      });

    return {
      position: { ...current.position },
      rotation: current.transform.rotation,
      cells,
      top: Math.max(...cells.map((cell) => cell.y)) + 1
    };
  });
}

function templateNames(
  page: Page
): Promise<string[]> {
  return page.evaluate(() => window.voxelMapEditor!.workspace.view.document.world
    .templates.toArray()
    .map((template) => template.name));
}

async function dragPlacement(
  page: Page,
  from: Cell,
  to: Cell
): Promise<void> {
  await pressAt(page, [
    await cellTopPoint(page, from),
    await cellTopPoint(page, to)
  ], { settle: nextFrames });
}

async function hoverCell(
  page: Page,
  cell: Cell
): Promise<void> {
  const point = await cellTopPoint(page, cell);
  await page.mouse.move(point.x, point.y);
}

test.beforeEach(async({ page }) => {
  await openPane(page, "Layers");
});

test("a saved layer is placed, moved, turned and committed as one undo step", async({ page }) => {
  test.slow();
  const original: Cell[] = [0, 1, 2].map((x) => {
    return { x, y: 0, z: 0 };
  });
  await seedVoxels(page, original.map((cell) => {
    return { ...cell, blockId: 1 };
  }));
  await pinCamera(page);

  await page.getByRole("button", { name: "Save layer as template" }).click();
  await expect(page.locator("template-manager [role=\"treeitem\"]"))
    .toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Place template" }).click();
  const placed = await placement(page);
  expect(placed).not.toBeNull();

  const grab = {
    ...placed!.cells[0],
    y: placed!.top
  };
  await dragPlacement(page, grab, {
    ...grab,
    x: grab.x + 3
  });
  const moved = await placement(page);
  expect(moved?.position).toEqual({
    ...placed!.position,
    x: placed!.position.x + 3
  });

  await page.keyboard.press("KeyQ");
  await expect.poll(async() => (await placement(page))?.rotation).toBe(1);
  const turned = await placement(page);

  await page.getByRole("button", { name: "Commit into Ground" }).click();
  await expect.poll(() => placement(page)).toBeNull();
  expect(await blocksAt(page, turned!.cells)).toEqual([1, 1, 1]);

  await page.keyboard.press("Control+KeyZ");
  await expect.poll(() => voxelCount(page)).toBe(3);
  expect(await blocksAt(page, original)).toEqual([1, 1, 1]);
});

test("Escape cancels a placement and leaves the world untouched", async({ page }) => {
  await seedVoxels(page, [{ x: 0, y: 0, z: 0, blockId: 1 }]);
  await pinCamera(page);

  await page.getByRole("button", { name: "Save layer as template" }).click();
  await page.getByRole("button", { name: "Place template" }).click();
  await expect.poll(() => placement(page)).not.toBeNull();

  await hoverCell(page, { x: 0, y: 0, z: 0 });
  await page.keyboard.press("Escape");

  await expect.poll(() => placement(page)).toBeNull();
  expect(await voxelCount(page)).toBe(1);
});

test("a layer is turned with its marquee and committed with Enter", async({ page }) => {
  const original: Cell[] = [0, 1, 2].map((x) => {
    return { x, y: 0, z: 0 };
  });
  await seedVoxels(page, original.map((cell) => {
    return { ...cell, blockId: 1 };
  }));
  await pinCamera(page);

  await page.locator("layer-panel").getByRole("button", { name: "Transform" }).click();
  await expect.poll(() => placement(page)).not.toBeNull();

  await hoverCell(page, original[1]);
  await page.keyboard.press("KeyQ");
  await expect.poll(async() => (await placement(page))?.rotation).toBe(1);
  const turned = await placement(page);
  await page.keyboard.press("Enter");

  await expect.poll(() => placement(page)).toBeNull();
  expect(await voxelCount(page)).toBe(3);
  expect(await blocksAt(page, turned!.cells)).toEqual([1, 1, 1]);
});

test("double-clicking a template row renames it", async({ page }) => {
  await seedVoxels(page, [{ x: 0, y: 0, z: 0, blockId: 1 }]);

  await page.getByRole("button", { name: "Save layer as template" }).click();
  await page.locator("template-manager [role=\"treeitem\"] .label").dblclick();

  const rename = page.locator("template-manager").getByRole("textbox", { name: "Rename" });
  await rename.fill("House");
  await rename.press("Enter");

  await expect.poll(() => templateNames(page)).toEqual(["House"]);
  expect(await placement(page)).toBeNull();
});

test("a template row dragged into the viewport is staged at the hovered cell", async({ page }) => {
  await seedVoxels(page, [{ x: 0, y: 0, z: 0, blockId: 1 }]);
  await pinCamera(page);

  await page.getByRole("button", { name: "Save layer as template" }).click();
  const row = page.locator("template-manager [role=\"treeitem\"]");
  await pressAt(page, [
    await centerOf(row),
    await cellTopPoint(page, { x: 3, y: 0, z: 0 })
  ], { settle: nextFrames });

  await expect.poll(async() => (await placement(page))?.position)
    .toEqual({ x: 3, y: 0, z: 0 });
  const staged = await placement(page);

  await page.getByRole("button", { name: "Commit into Ground" }).click();
  await expect.poll(() => placement(page)).toBeNull();
  expect(await blocksAt(page, staged!.cells)).toEqual([1]);
});

test("a saved template reaches a peer and survives a reload", async({ page, peer }) => {
  test.slow();
  await seedVoxels(page, [{ x: 0, y: 0, z: 0, blockId: 1 }]);

  await page.getByRole("button", { name: "Save layer as template" }).click();
  await expect.poll(() => templateNames(peer)).toEqual(["Ground"]);

  await page.reload();
  await waitForEditor(page);
  await openPane(page, "Layers");

  await expect.poll(() => templateNames(page)).toEqual(["Ground"]);
  await expect(page.locator("template-manager [role=\"treeitem\"]"))
    .toHaveText(/Ground/);
});
