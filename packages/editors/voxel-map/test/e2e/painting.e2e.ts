// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  blocksAt,
  cellTopPoint,
  clickCell,
  nextFrames,
  pinCamera,
  pressAt,
  seedVoxels,
  strokeCells,
  voxelCount
} from "./support/scene.ts";

function brushState(
  page: Page
) {
  return page.evaluate(() => {
    const { brush } = window.voxelMapEditor!.scene.editorState;

    return {
      blockId: brush.blockId,
      size: brush.size,
      mode: brush.mode,
      axis: brush.axis,
      pattern: brush.pattern
    };
  });
}

async function setBrush(
  page: Page,
  patch: { blockId?: number; size?: number; }
): Promise<void> {
  await page.evaluate((values) => {
    const { brush } = window.voxelMapEditor!.scene.editorState;
    if (values.blockId !== undefined) {
      brush.blockId = values.blockId;
    }
    if (values.size !== undefined) {
      brush.size = values.size;
    }
  }, patch);
}

test.beforeEach(async({ page }) => {
  await pinCamera(page);
});

test("a click places the brush block and a right click removes it", async({ page }) => {
  await setBrush(page, { blockId: 3 });
  const cell = { x: 0, y: 0, z: 0 };

  await clickCell(page, cell);
  await expect.poll(() => blocksAt(page, [cell])).toEqual([3]);

  await clickCell(page, { x: 0, y: 1, z: 0 }, "right");
  await expect.poll(() => blocksAt(page, [cell])).toEqual([null]);
});

test("a drag paints every cell it crosses on the ground plane", async({ page }) => {
  await setBrush(page, { blockId: 2 });
  const row = [0, 1, 2, 3].map((x) => {
    return { x, y: 0, z: 0 };
  });

  await strokeCells(page, [row[0], row[3]]);

  await expect.poll(() => blocksAt(page, row)).toEqual([2, 2, 2, 2]);
  expect(await voxelCount(page)).toBe(4);
});

test("a stroke stays on the height it started on", async({ page }) => {
  await seedVoxels(page, [{ x: 2, y: 0, z: 0, blockId: 1 }]);
  await setBrush(page, { blockId: 2 });

  await strokeCells(page, [
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 1, z: 0 },
    { x: 3, y: 0, z: 0 }
  ]);

  await expect.poll(() => blocksAt(page, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
    { x: 2, y: 1, z: 0 }
  ])).toEqual([2, 2, 1, 2, null]);
});

test("a larger brush stamps its whole footprint", async({ page }) => {
  await setBrush(page, {
    blockId: 1,
    size: 3
  });

  await clickCell(page, { x: 0, y: 0, z: 0 });

  await expect.poll(() => voxelCount(page)).toBe(9);
  expect(await blocksAt(page, [
    { x: -1, y: 0, z: -1 },
    { x: 1, y: 0, z: 1 },
    { x: 2, y: 0, z: 0 }
  ])).toEqual([1, 1, null]);
});

test("replace mode repaints occupied cells only", async({ page }) => {
  await seedVoxels(page, [{ x: 0, y: 0, z: 0, blockId: 1 }]);
  await setBrush(page, {
    blockId: 4,
    size: 3
  });
  await page.keyboard.press("KeyR");
  await expect.poll(async() => (await brushState(page)).mode).toBe("replace");

  await clickCell(page, { x: 0, y: 1, z: 0 });

  await expect.poll(() => blocksAt(page, [{ x: 0, y: 0, z: 0 }])).toEqual([4]);
  expect(await voxelCount(page)).toBe(1);
});

test("the X axis builds a wall standing on the aimed cell", async({ page }) => {
  await setBrush(page, {
    blockId: 1,
    size: 2
  });
  await page.keyboard.press("KeyX");
  await expect.poll(async() => (await brushState(page)).axis).toBe("xy");

  await clickCell(page, { x: 0, y: 0, z: 0 });

  await expect.poll(() => voxelCount(page)).toBe(4);
  expect(await blocksAt(page, [
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: -1, y: 1, z: 0 },
    { x: 0, y: 1, z: 0 }
  ])).toEqual([1, 1, 1, 1]);
});

test("Ctrl+click picks the block under the cursor", async({ page }) => {
  await seedVoxels(page, [{ x: 0, y: 0, z: 0, blockId: 7 }]);
  await setBrush(page, { blockId: 1 });
  const point = await cellTopPoint(page, { x: 0, y: 1, z: 0 });

  await page.keyboard.down("Control");
  await pressAt(page, [point]);
  await page.keyboard.up("Control");

  await expect.poll(async() => (await brushState(page)).blockId).toBe(7);
  expect(await voxelCount(page)).toBe(1);
});

test("the toolbar and the shortcuts drive the same brush", async({ page }) => {
  const toolbar = page.locator("voxel-brush-toolbar");

  await test.step("brackets resize the brush", async() => {
    await page.keyboard.press("BracketRight");
    await page.keyboard.press("BracketRight");
    await expect.poll(async() => (await brushState(page)).size).toBe(3);
    await page.keyboard.press("BracketLeft");
    await expect.poll(async() => (await brushState(page)).size).toBe(2);
    await expect(toolbar.getByRole("button", { name: /^Size 2/ })).toBeVisible();
  });

  await test.step("C toggles the pattern", async() => {
    await page.keyboard.press("KeyC");
    await expect.poll(async() => (await brushState(page)).pattern).toBe("circle");
  });

  await test.step("the toolbar switches the mode", async() => {
    await toolbar.getByRole("button", { name: /^Build/ }).hover();
    await toolbar.getByRole("button", { name: "Replace", exact: true }).click();
    await expect.poll(async() => (await brushState(page)).mode).toBe("replace");
  });
});

test("nothing is painted while no voxel layer is selected", async({ page }) => {
  await page.evaluate(() => {
    window.voxelMapEditor!.scene.editorState.selection.clear();
  });
  const brushTools = page.getByRole("group", { name: "Brush" });
  await expect(brushTools).toHaveAttribute("aria-disabled", "true");

  await page.keyboard.press("BracketRight");
  await clickCell(page, { x: 0, y: 0, z: 0 });
  await nextFrames(page);

  expect(await voxelCount(page)).toBe(0);
  expect((await brushState(page)).size).toBe(1);
});

test("undo and redo replay a whole stroke from the toolbar and the keyboard", async({ page }) => {
  const toolbar = page.locator("voxel-brush-toolbar");
  const undo = toolbar.getByRole("button", { name: /^Undo/ });
  const redo = toolbar.getByRole("button", { name: /^Redo/ });
  const row = [0, 1, 2, 3].map((x) => {
    return { x, y: 0, z: 0 };
  });

  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  await setBrush(page, { blockId: 2 });
  await strokeCells(page, [row[0], row[3]]);
  await expect.poll(() => voxelCount(page)).toBe(4);
  await expect(undo).toBeEnabled();

  await test.step("the toolbar undoes the stroke in one step", async() => {
    await undo.click();
    await expect.poll(() => voxelCount(page)).toBe(0);
    await expect(undo).toBeDisabled();
    await expect(redo).toBeEnabled();
  });

  await test.step("the shortcuts redo and undo it again", async() => {
    await page.keyboard.press("Control+KeyY");
    await expect.poll(() => blocksAt(page, row)).toEqual([2, 2, 2, 2]);
    await page.keyboard.press("Control+KeyZ");
    await expect.poll(() => voxelCount(page)).toBe(0);
    await page.keyboard.press("Control+Shift+KeyZ");
    await expect.poll(() => voxelCount(page)).toBe(4);
  });
});
