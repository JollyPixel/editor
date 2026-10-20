// Import Third-party Dependencies
import {
  EditorToolbar,
  followEditor
} from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import type { VoxelMapPage } from "./support/voxelMap.ts";

// CONSTANTS
const kTagged = { x: 0, y: 0, z: 0 };
const kLater = { x: 2, y: 0, z: 0 };

async function paint(
  map: VoxelMapPage,
  cell: typeof kTagged
): Promise<void> {
  await map.viewport.click(cell);
  await expect.poll(() => map.world.blocks([cell])).toEqual([3]);
  await expect.poll(() => map.page.evaluate(
    () => window.voxelMapEditor!.session.assets.unsaved
  )).toBe(false);
}

test("a saved version shows its map read-only and restores it without reloading", async({ map, page }) => {
  test.setTimeout(60_000);
  const editorToolbar = new EditorToolbar(page);
  const pageLoad = await page.evaluate(() => performance.timeOrigin);
  await map.viewport.pinCamera();
  await map.brush.change({ blockId: 3 });
  await paint(map, kTagged);

  await editorToolbar.saveVersion("v1", "First pass");
  await paint(map, kLater);

  await editorToolbar.viewVersion(/v1 ·/);
  await followEditor(page, /tag=v1/);
  await map.viewport.pinCamera();

  await expect(editorToolbar.readOnly).toBeVisible();
  await expect(map.toolbar.status).toContainText("View only");
  expect(await map.world.blocks([kTagged, kLater])).toEqual([3, null]);
  await map.viewport.click(kLater);
  expect(await map.world.blocks([kLater])).toEqual([null]);

  await editorToolbar.restoreButton.click();
  await editorToolbar.confirm("Restore tag", "Restore");
  await followEditor(page, (url) => !url.searchParams.has("tag"));

  await expect(editorToolbar.readOnly).toHaveCount(0);
  await expect(map.toolbar.status).toBeHidden();
  expect(await map.world.blocks([kTagged, kLater])).toEqual([3, null]);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(pageLoad);
});
