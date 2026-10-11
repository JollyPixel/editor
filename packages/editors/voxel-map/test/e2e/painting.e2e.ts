// Import Third-party Dependencies
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";

test.beforeEach(async({ map }) => {
  await map.viewport.pinCamera();
});

test("a click places the brush block and a right click removes it", async({ map }) => {
  const { viewport, world } = map;
  await map.brush.change({ blockId: 3 });
  const cell = { x: 0, y: 0, z: 0 };

  await viewport.click(cell);
  await expect.poll(() => world.blocks([cell])).toEqual([3]);

  await viewport.click({ x: 0, y: 1, z: 0 }, "right");
  await expect.poll(() => world.blocks([cell])).toEqual([null]);
});

test("a stroke climbs onto the blocks it crosses and back down", async({ map }) => {
  const { world } = map;
  await world.seed([{ x: 2, y: 0, z: 0, blockId: 1 }]);
  await map.brush.change({ blockId: 2 });

  await map.viewport.drag([
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 1, z: 0 },
    { x: 3, y: 0, z: 0 }
  ]);

  await expect.poll(() => world.blocks([
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
    { x: 2, y: 1, z: 0 }
  ])).toEqual([2, 2, 1, 2, 2]);
});

test("replace mode repaints occupied cells only", async({ map, page }) => {
  const { brush, world } = map;
  await world.seed([{ x: 0, y: 0, z: 0, blockId: 1 }]);
  await brush.change({
    blockId: 4,
    size: 3
  });
  await page.keyboard.press("KeyR");
  await expect.poll(async() => (await brush.state()).mode).toBe("replace");

  await map.viewport.click({ x: 0, y: 1, z: 0 });

  await expect.poll(() => world.blocks([{ x: 0, y: 0, z: 0 }])).toEqual([4]);
  expect(await world.voxelCount()).toBe(1);
});

test("a second right click without moving digs what the first uncovered", async({ map }) => {
  const { viewport, world } = map;
  const floor = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((z) => {
    return { x, y: 0, z, blockId: 1 };
  }));
  await world.seed([
    ...floor,
    { x: 0, y: 1, z: 0, blockId: 1 }
  ]);
  const top = {
    x: 0.5,
    y: 2,
    z: 0.5
  };

  await viewport.press([top], "right");
  await expect.poll(() => world.voxelCount()).toBe(floor.length);
  await viewport.press([top], "right");

  await expect.poll(() => world.voxelCount()).toBe(floor.length - 1);
});

test("a removing drag erases only where it was pressed", async({ map }) => {
  const { world } = map;
  const row = [0, 1, 2, 3].map((x) => {
    return { x, y: 0, z: 0, blockId: 1 };
  });
  await world.seed(row);

  await map.viewport.drag([
    { x: 0, y: 1, z: 0 },
    { x: 3, y: 1, z: 0 }
  ], "right");

  await expect.poll(() => world.voxelCount()).toBe(row.length - 1);
  expect(await world.blocks(row.slice(1))).toEqual([1, 1, 1]);
});

test("Ctrl+click picks the block under the cursor", async({ map }) => {
  const { brush, world } = map;
  await world.seed([{ x: 0, y: 0, z: 0, blockId: 7 }]);
  await brush.change({ blockId: 1 });

  await map.viewport.pick({ x: 0.5, y: 1, z: 0.5 });

  await expect.poll(async() => (await brush.state()).blockId).toBe(7);
  expect(await world.voxelCount()).toBe(1);
});

test("the toolbar and the shortcuts drive the same brush", async({ map, page }) => {
  const { brush, toolbar } = map;

  await test.step("brackets resize the brush", async() => {
    await page.keyboard.press("BracketRight");
    await page.keyboard.press("BracketRight");
    await expect.poll(async() => (await brush.state()).size).toBe(3);
    await page.keyboard.press("BracketLeft");
    await expect.poll(async() => (await brush.state()).size).toBe(2);
    await expect(toolbar.sizeButton(2)).toBeVisible();
  });

  await test.step("C toggles the pattern", async() => {
    await page.keyboard.press("KeyC");
    await expect.poll(async() => (await brush.state()).pattern).toBe("circle");
  });

  await test.step("the toolbar switches the mode", async() => {
    await toolbar.button(/^Build/).hover();
    await toolbar.button("Replace").click();
    await expect.poll(async() => (await brush.state()).mode).toBe("replace");
  });
});

test("the ghost block previews the placement at size one", async({ map, page }) => {
  const { brush, toolbar, viewport } = map;
  const { ghostButton } = toolbar;
  const cell = { x: 0, y: 0, z: 0 };

  await test.step("the toolbar and G toggle it", async() => {
    await expect(ghostButton).toHaveAttribute("aria-pressed", "false");
    await ghostButton.click();
    await expect(ghostButton).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("KeyG");
    await expect(ghostButton).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("KeyG");
    await expect(ghostButton).toHaveAttribute("aria-pressed", "true");
  });

  await test.step("hovering the ground shows the ghost on the place cell", async() => {
    await viewport.hover(cell);
    await expect.poll(() => brush.ghost()).toEqual({
      visible: true,
      position: [0.5, 0.5, 0.5]
    });
  });

  await test.step("a larger brush falls back to the footprint", async() => {
    await page.keyboard.press("BracketRight");
    await expect.poll(async() => (await brush.ghost()).visible).toBe(false);
    await page.keyboard.press("BracketLeft");
    await expect.poll(async() => (await brush.ghost()).visible).toBe(true);
  });

  await test.step("a click places the block under the ghost", async() => {
    await brush.change({ blockId: 3 });
    await viewport.click(cell);
    await expect.poll(() => map.world.blocks([cell])).toEqual([3]);
  });
});

test("an object layer pauses painting until the voxel layer is resumed", async({ map, page }) => {
  const { toolbar } = map;
  await page.evaluate(() => {
    const { view, state } = window.voxelMapEditor!.workspace;
    view.document.world.objectLayers.add("Props");
    state.selection.selectObjectLayer("Props");
  });
  await expect(toolbar.brushTools).toHaveAttribute("aria-disabled", "true");
  await expect(toolbar.status).toContainText("Object layer selected");

  await toolbar.status.getByRole("button", { name: "Paint on Ground" }).click();

  await expect(toolbar.brushTools).toHaveAttribute("aria-disabled", "false");
  await expect(toolbar.status).toBeHidden();
});

test("nothing is painted and a warning is logged without a voxel layer", async({ map, page }) => {
  const { toolbar, world } = map;
  await page.evaluate(() => {
    window.voxelMapEditor!.workspace.view.document.world.removeLayer("Ground");
  });
  await expect(toolbar.brushTools).toHaveAttribute("aria-disabled", "true");
  await expect(toolbar.status).toContainText("No voxel layer to paint on");

  await page.keyboard.press("BracketRight");
  await map.viewport.click({ x: 0, y: 0, z: 0 });
  await nextFrames(page);

  await expect(map.log).toContainText("No voxel layer to paint on");
  expect(await world.voxelCount()).toBe(0);
  expect((await map.brush.state()).size).toBe(1);
});

test("a drag paints every cell it crosses, and undo and redo replay it whole", async({ map, page }) => {
  const { toolbar, world } = map;
  const { undoButton, redoButton } = toolbar;
  const row = [0, 1, 2, 3].map((x) => {
    return { x, y: 0, z: 0 };
  });

  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeDisabled();

  await map.brush.change({ blockId: 2 });
  await map.viewport.drag([row[0], row[3]]);
  await expect.poll(() => world.blocks(row)).toEqual([2, 2, 2, 2]);
  expect(await world.voxelCount()).toBe(4);
  await expect(undoButton).toBeEnabled();

  await test.step("the toolbar undoes the stroke in one step", async() => {
    await undoButton.click();
    await expect.poll(() => world.voxelCount()).toBe(0);
    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeEnabled();
  });

  await test.step("the shortcuts redo and undo it again", async() => {
    await page.keyboard.press("Control+KeyY");
    await expect.poll(() => world.blocks(row)).toEqual([2, 2, 2, 2]);
    await page.keyboard.press("Control+KeyZ");
    await expect.poll(() => world.voxelCount()).toBe(0);
    await page.keyboard.press("Control+Shift+KeyZ");
    await expect.poll(() => world.voxelCount()).toBe(4);
  });
});
