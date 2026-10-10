// Import Third-party Dependencies
import type { Object3D } from "three";
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
const kOutside: Cell = { x: 5, y: 0, z: 0 };

async function seed(
  map: VoxelMapPage,
  cells: Cell[]
): Promise<void> {
  await map.world.seed(cells.map((cell) => {
    return { ...cell, blockId: 1 };
  }));
  await map.viewport.pinCamera();
}

async function useSelectTool(
  map: VoxelMapPage
): Promise<void> {
  await map.viewport.hover(kOutside);
  await map.page.keyboard.press("m");
}

async function selectRow(
  map: VoxelMapPage
): Promise<void> {
  const last = kRow.at(-1)!;
  await map.viewport.press([
    { x: 0.5, y: 1, z: 0.5 },
    { x: last.x + 0.5, y: 0.5, z: 0.5 }
  ]);
}

function cursorVisible(
  map: VoxelMapPage
): Promise<boolean> {
  return map.page.evaluate(() => {
    let root: Object3D = window.voxelMapEditor!.workspace.view.root;
    while (root.parent !== null) {
      root = root.parent;
    }

    return root.getObjectByName("marquee-draft")?.visible === true;
  });
}

function raiseCamera(
  map: VoxelMapPage,
  height: number
): Promise<void> {
  return map.page.evaluate((rise) => {
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

test("a dragged marquee cuts the blocks it covers until the selection is committed", async({ map, page }) => {
  test.slow();
  const { placement, toolbar, viewport, world } = map;
  await seed(map, [...kRow, kOutside]);

  await toolbar.selectButton.click();
  await expect(toolbar.brushTools).toBeHidden();
  await viewport.hover(kRow[0]);
  await expect.poll(() => cursorVisible(map)).toBe(true);
  await selectRow(map);
  expect(await cursorVisible(map)).toBe(false);

  const lifted = await placement.current();
  expect(lifted?.kind).toBe("region");
  expect(lifted?.cells).toHaveLength(kRow.length);
  expect(await world.blocks(kRow)).toEqual([null, null, null]);
  await expect(toolbar.status).toHaveText("Selection → Ground");

  const grab = {
    ...kRow[1],
    y: lifted!.top
  };
  await viewport.drag([grab, {
    ...grab,
    z: grab.z + 3
  }]);
  await expect.poll(async() => (await placement.current())?.position.z)
    .toBe(lifted!.position.z + 3);
  const moved = await placement.current();

  await viewport.hover(kOutside);
  await page.keyboard.press("Enter");
  await expect.poll(() => placement.current()).toBeNull();
  expect(await world.blocks(moved!.cells)).toEqual([1, 1, 1]);
  expect(await world.blocks(kRow)).toEqual([null, null, null]);
  expect(await world.blocks([kOutside])).toEqual([1]);

  await page.keyboard.press("Control+KeyZ");
  await expect.poll(() => world.blocks(kRow)).toEqual([1, 1, 1]);
  expect(await world.voxelCount()).toBe(kRow.length + 1);
});

test("the marquee grows in height while the camera rises during the drag", async({ map, page }) => {
  const { viewport } = map;
  const step: Cell = { x: 1, y: 1, z: 0 };
  await seed(map, [kRow[0], step, kOutside]);
  await useSelectTool(map);

  const from = await viewport.screenPoint({ x: 0.5, y: 1, z: 0.5 });
  const to = await viewport.screenPoint({ x: 1.5, y: 0.5, z: 0.5 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await nextFrames(page);
  await raiseCamera(map, 2);
  await nextFrames(page);
  await page.mouse.up();

  await expect.poll(async() => (await map.placement.current())?.cells.length).toBe(2);
  expect(await map.world.blocks([kRow[0], step])).toEqual([null, null]);
});

test("Delete removes the selected blocks only", async({ map, page }) => {
  const { placement } = map;
  await seed(map, [...kRow, kOutside]);
  await useSelectTool(map);
  await selectRow(map);
  await expect.poll(async() => (await placement.current())?.kind).toBe("region");

  await map.viewport.hover(kOutside);
  await page.keyboard.press("Delete");

  await expect.poll(() => placement.current()).toBeNull();
  expect(await map.world.blocks([...kRow, kOutside])).toEqual([null, null, null, 1]);
});

test("a click in connected mode selects the touching blocks only", async({ map, page }) => {
  const { placement, toolbar, viewport, world } = map;
  await seed(map, [...kRow, kOutside]);
  await toolbar.selectButton.click();
  await toolbar.connectedSelectButton.click();

  await viewport.click(kRow[2]);

  await expect.poll(async() => (await placement.current())?.cells.length)
    .toBe(kRow.length);
  expect(await world.blocks([...kRow, kOutside])).toEqual([null, null, null, 1]);

  await viewport.hover(kOutside);
  await page.keyboard.press("Delete");
  await expect.poll(() => placement.current()).toBeNull();
  expect(await world.blocks([...kRow, kOutside])).toEqual([null, null, null, 1]);
});

test("a peer sees the cursor and the selection; Escape puts the blocks back", async({
  map,
  peerMap,
  page
}) => {
  test.slow();
  const { placement, toolbar } = map;
  await seed(map, [...kRow, kOutside]);
  await useSelectTool(map);
  await expect.poll(() => peerMap.placement.peerPreviews()).toBe(1);

  await selectRow(map);
  await expect.poll(async() => (await placement.current())?.kind).toBe("region");
  await expect.poll(() => peerMap.placement.peerPreviews()).toBe(1);

  await map.viewport.hover(kOutside);
  await page.keyboard.press("Escape");
  await expect.poll(() => placement.current()).toBeNull();
  expect(await map.world.blocks(kRow)).toEqual([1, 1, 1]);
  await expect(toolbar.root).toHaveAttribute("mode", "select");

  await page.keyboard.press("Escape");
  await expect(toolbar.root).toHaveAttribute("mode", "paint");
  await expect.poll(() => peerMap.placement.peerPreviews()).toBe(0);
});

test("Alt+click pivots the camera, then Escape leaves the pivot before the select tool", async({
  map,
  page
}) => {
  const { log, toolbar } = map;
  await seed(map, [...kRow, kOutside]);
  await useSelectTool(map);

  await map.viewport.pivot(kRow[1]);
  await expect(log).toContainText("Camera switched to pivot");
  expect(await map.placement.current()).toBeNull();

  await page.keyboard.press("Escape");
  await expect(log).toContainText("Camera switched to free fly");
  await expect(toolbar.root).toHaveAttribute("mode", "select");

  await page.keyboard.press("Escape");
  await expect(toolbar.root).toHaveAttribute("mode", "paint");
});

test("Ctrl+C then Ctrl+V floats a copy under the cursor, committed by a click outside", async({
  map,
  page
}) => {
  test.slow();
  const { placement, viewport, world } = map;
  await seed(map, [...kRow, kOutside]);
  await useSelectTool(map);
  await selectRow(map);
  await expect.poll(async() => (await placement.current())?.kind).toBe("region");

  await viewport.hover(kOutside);
  await page.keyboard.press("Control+KeyC");
  await expect(map.toolbar.pasteButton).toBeEnabled();
  await viewport.hover({ x: 1, y: 0, z: 4 });
  await page.keyboard.press("Control+KeyV");

  await expect.poll(async() => (await placement.current())?.kind).toBe("copy");
  expect(await world.blocks(kRow)).toEqual([1, 1, 1]);
  const pasted = await placement.current();
  expect(pasted?.position.z).toBeGreaterThan(0);

  await viewport.click({ x: 5, y: 0, z: 2 });
  await expect.poll(() => placement.current()).toBeNull();
  expect(await world.blocks(pasted!.cells)).toEqual([1, 1, 1]);
  expect(await world.voxelCount()).toBe((kRow.length * 2) + 1);
});
