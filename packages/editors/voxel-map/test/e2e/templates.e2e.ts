// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import type { Cell } from "./support/viewport.ts";
import type { VoxelMapPage } from "./support/voxelMap.ts";

function templateNames(
  map: VoxelMapPage
): Promise<string[]> {
  return map.page.evaluate(() => window.voxelMapEditor!.workspace.view.document.world
    .templates.toArray()
    .map((template) => template.name));
}

async function seedCell(
  map: VoxelMapPage
): Promise<void> {
  await map.world.seed([{ x: 0, y: 0, z: 0, blockId: 1 }]);
  await map.viewport.pinCamera();
}

test.beforeEach(async({ map }) => {
  await map.panes.open("Layers");
});

test("a saved layer is placed, moved, turned and committed as one undo step", async({ map, page }) => {
  test.slow();
  const { placement, templates, world } = map;
  const original: Cell[] = [0, 1, 2].map((x) => {
    return { x, y: 0, z: 0 };
  });
  await world.seed(original.map((cell) => {
    return { ...cell, blockId: 1 };
  }));
  await map.viewport.pinCamera();

  await templates.saveLayer();
  await expect(templates.row).toHaveAttribute("aria-selected", "true");

  await templates.place();
  const placed = await placement.current();
  expect(placed).not.toBeNull();

  const grab = {
    ...placed!.cells[0],
    y: placed!.top
  };
  await map.viewport.drag([grab, {
    ...grab,
    x: grab.x + 3
  }]);
  const moved = await placement.current();
  expect(moved?.position).toEqual({
    ...placed!.position,
    x: placed!.position.x + 3
  });

  await page.keyboard.press("KeyQ");
  await expect.poll(async() => (await placement.current())?.rotation).toBe(1);
  const turned = await placement.current();

  await map.toolbar.commitButton("Ground").click();
  await expect.poll(() => placement.current()).toBeNull();
  expect(await world.blocks(turned!.cells)).toEqual([1, 1, 1]);

  await page.keyboard.press("Control+KeyZ");
  await expect.poll(() => world.voxelCount()).toBe(3);
  expect(await world.blocks(original)).toEqual([1, 1, 1]);
});

test("Escape cancels a placement and leaves the world untouched", async({ map, page }) => {
  const { placement, templates } = map;
  await seedCell(map);

  await templates.saveLayer();
  await templates.place();
  await expect.poll(() => placement.current()).not.toBeNull();

  await map.viewport.hover({ x: 0, y: 0, z: 0 });
  await page.keyboard.press("Escape");

  await expect.poll(() => placement.current()).toBeNull();
  expect(await map.world.voxelCount()).toBe(1);
});

test("Alt+click pivots the camera while a placement is pending", async({ map }) => {
  const { placement, templates } = map;
  await seedCell(map);

  await templates.saveLayer();
  await templates.place();
  await expect.poll(() => placement.current()).not.toBeNull();

  await map.viewport.pivot({ x: 4, y: 0, z: 4 });

  await expect(map.log).toContainText("Camera switched to pivot");
  expect(await placement.current()).not.toBeNull();
});

test("a click outside the placement commits it without painting", async({ map }) => {
  const { placement, templates, world } = map;
  await seedCell(map);

  await templates.saveLayer();
  const staged: Cell = { x: 3, y: 0, z: 0 };
  await templates.dragTo(staged);
  await expect.poll(async() => (await placement.current())?.position)
    .toEqual(staged);

  const outside: Cell = { x: 4, y: 0, z: 4 };
  await map.viewport.click(outside);

  await expect.poll(() => placement.current()).toBeNull();
  expect(await world.blocks([staged, outside])).toEqual([1, null]);
  expect(await world.voxelCount()).toBe(2);
});

test("a peer sees the placement preview until it is cancelled", async({ map, peerMap, page }) => {
  test.slow();
  const { templates } = map;
  await seedCell(map);

  await templates.saveLayer();
  await templates.place();
  await expect.poll(() => peerMap.placement.peerPreviews()).toBe(1);

  await map.viewport.hover({ x: 0, y: 0, z: 0 });
  await page.keyboard.press("Escape");

  await expect.poll(() => peerMap.placement.peerPreviews()).toBe(0);
});

test("a layer is turned with its marquee and committed with Enter", async({ map, page }) => {
  const { placement, viewport, world } = map;
  const original: Cell[] = [0, 1, 2].map((x) => {
    return { x, y: 0, z: 0 };
  });
  await world.seed(original.map((cell) => {
    return { ...cell, blockId: 1 };
  }));
  await viewport.pinCamera();

  await map.layers.transformButton.click();
  await expect.poll(() => placement.current()).not.toBeNull();

  await viewport.hover(original[1]);
  await page.keyboard.press("KeyQ");
  await expect.poll(async() => (await placement.current())?.rotation).toBe(1);
  const turned = await placement.current();
  await page.keyboard.press("Enter");

  await expect.poll(() => placement.current()).toBeNull();
  expect(await world.voxelCount()).toBe(3);
  expect(await world.blocks(turned!.cells)).toEqual([1, 1, 1]);
});

test("the toolbar swaps the brush for the placement controls until cancelled", async({ map }) => {
  const { toolbar } = map;
  await map.world.seed([
    { x: 0, y: 0, z: 0, blockId: 1 },
    { x: 1, y: 0, z: 0, blockId: 1 }
  ]);

  const { brushTools, history, rotate } = toolbar;
  const lockedBrush = toolbar.root.getByRole("group", {
    name: "Brush",
    includeHidden: true
  });
  await expect(rotate).toBeHidden();
  await expect(brushTools).toHaveAttribute("aria-disabled", "false");

  await map.layers.transformButton.click();
  await expect(rotate).toBeVisible();
  await expect(toolbar.status).toHaveText("Ground");
  await expect(brushTools).toBeHidden();
  await expect(history).toBeHidden();
  await expect(lockedBrush).toHaveAttribute("aria-disabled", "true");

  await rotate.getByRole("button", { name: /^Rotate 90° counter-clockwise/ }).click();
  await expect.poll(async() => (await map.placement.current())?.rotation).toBe(1);

  await toolbar.cancelButton.click();
  await expect.poll(() => map.placement.current()).toBeNull();
  await expect(rotate).toBeHidden();
  await expect(history).toBeVisible();
  await expect(brushTools).toBeVisible();
  await expect(brushTools).toHaveAttribute("aria-disabled", "false");
});

test("double-clicking a template row renames it", async({ map }) => {
  await map.world.seed([{ x: 0, y: 0, z: 0, blockId: 1 }]);

  await map.templates.saveLayer();
  await map.templates.rename("House");

  await expect.poll(() => templateNames(map)).toEqual(["House"]);
  expect(await map.placement.current()).toBeNull();
});

test("a template row dragged into the viewport is staged at the hovered cell", async({ map }) => {
  const { placement, templates } = map;
  await seedCell(map);

  await templates.saveLayer();
  await templates.dragTo({ x: 3, y: 0, z: 0 });

  await expect.poll(async() => (await placement.current())?.position)
    .toEqual({ x: 3, y: 0, z: 0 });
  const staged = await placement.current();

  await map.toolbar.commitButton("Ground").click();
  await expect.poll(() => placement.current()).toBeNull();
  expect(await map.world.blocks(staged!.cells)).toEqual([1]);
});

test("a saved template reaches a peer and survives a reload", async({ map, peerMap }) => {
  test.slow();
  await map.world.seed([{ x: 0, y: 0, z: 0, blockId: 1 }]);

  await map.templates.saveLayer();
  await expect.poll(() => templateNames(peerMap)).toEqual(["Ground"]);

  await map.reload();
  await map.panes.open("Layers");

  await expect.poll(() => templateNames(map)).toEqual(["Ground"]);
  await expect(map.templates.row).toHaveText(/Ground/);
});
