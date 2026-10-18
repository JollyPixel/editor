// Import Third-party Dependencies
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import type { Cell } from "./support/viewport.ts";
import type { VoxelMapPage } from "./support/voxelMap.ts";

// CONSTANTS
const kRow: Cell[] = [0, 1, 2].map((x) => {
  return { x, y: 0, z: 0 };
});
const kStep: Cell = { x: 2, y: 1, z: 0 };
const kOutside: Cell = { x: 5, y: 0, z: 0 };
const kSeeded = [...kRow, kStep, kOutside];
const kRowStart = { x: 0.5, y: 1, z: 0.5 };
const kStepCenter = { x: 2.5, y: 1.5, z: 0.5 };
const kOutsideTop = { x: 5.5, y: 1, z: 0.5 };

async function useCornerSelect(
  map: VoxelMapPage
): Promise<void> {
  await map.world.seed(kSeeded.map((cell) => {
    return { ...cell, blockId: 1 };
  }));
  await map.viewport.pinCamera();
  await map.toolbar.selectButton.click();
  await map.toolbar.cornerSelectButton.click();
}

test("corner select lifts the box between two clicked blocks", async({ map }) => {
  const { placement, viewport, world } = map;
  await useCornerSelect(map);

  await viewport.press([kRowStart]);
  await viewport.press([kStepCenter]);

  await expect.poll(async() => (await placement.current())?.cells.length)
    .toBe(kRow.length + 1);
  expect(await world.blocks(kSeeded)).toEqual([null, null, null, null, 1]);
});

test("Escape drops the first corner and keeps the select tool", async({ map, page }) => {
  const { placement, toolbar, viewport, world } = map;
  await useCornerSelect(map);

  await viewport.press([kRowStart]);
  await viewport.hoverPoint(kStepCenter);
  await nextFrames(page);
  expect(await placement.current()).toBeNull();

  await page.keyboard.press("Escape");
  await nextFrames(page);
  await expect(toolbar.root).toHaveAttribute("mode", "select");
  await viewport.press([kOutsideTop]);
  await viewport.press([kOutsideTop]);

  await expect.poll(async() => (await placement.current())?.cells.length)
    .toBe(1);
  expect(await world.blocks(kSeeded)).toEqual([1, 1, 1, 1, null]);
});

test("switching the select mode drops the first corner", async({ map, page }) => {
  const { placement, viewport, world } = map;
  await useCornerSelect(map);

  await viewport.press([kRowStart]);
  await page.keyboard.press("m");
  await viewport.press([kOutsideTop]);

  await expect.poll(async() => (await placement.current())?.cells.length)
    .toBe(1);
  expect(await world.blocks(kSeeded)).toEqual([1, 1, 1, 1, null]);
});
