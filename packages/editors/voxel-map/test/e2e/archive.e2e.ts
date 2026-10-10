// Import Third-party Dependencies
import { waitForEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  offlineTest as test,
  expect
} from "./fixtures.ts";
import type { VoxelMapPage } from "./support/voxelMap.ts";

interface OfflineIds {
  mapId: string;
  blocksetIds: (string | undefined)[];
}

function offlineIds(
  map: VoxelMapPage
): Promise<OfflineIds> {
  return map.page.evaluate(() => {
    const { session, workspace } = window.voxelMapEditor!;

    return {
      mapId: session.target.record.id,
      blocksetIds: workspace.view.document.blocksets
        .definitions()
        .map((blockset) => blockset.asset?.id)
    };
  });
}

test("exports the map, resets the workspace and imports it back", async({ map, page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await map.openOffline();
  const exported = await offlineIds(map);
  await map.panes.open("General");

  const download = await map.general.exportArchive();
  expect(download.suggestedFilename()).toBe("overworld.zip");
  const archivePath = await download.path();

  await map.general.resetWorkspace();

  const reseeded = await offlineIds(map);
  expect(reseeded.mapId).not.toBe(exported.mapId);

  await map.panes.open("General");
  await map.general.importArchive(archivePath);
  await page.waitForURL(new RegExp(`target=${exported.mapId}`));
  await waitForEditor(page);

  expect(await offlineIds(map)).toEqual(exported);
  const state = await page.evaluate(() => {
    const { view } = window.voxelMapEditor!.workspace;

    return {
      layers: view.document.world.getLayers().map((layer) => layer.name),
      blocks: view.document.blocks.size
    };
  });
  expect(state).toEqual({
    layers: ["Ground"],
    blocks: 0
  });
  expect(errors).toEqual([]);
});

test("imports a map and its blockset as a copy", async({ map, page }) => {
  test.setTimeout(90_000);
  await map.openOffline();
  const original = await offlineIds(map);
  await map.panes.open("General");

  const download = await map.general.exportArchive();
  await map.general.importArchive(await download.path());
  await map.general.importCopyButton.click();
  await page.waitForURL((url) => {
    const target = url.searchParams.get("target");

    return target !== null && target !== original.mapId;
  });
  await waitForEditor(page);

  const copied = await offlineIds(map);
  expect(copied.mapId).not.toBe(original.mapId);
  expect(copied.blocksetIds[0]).not.toBe(original.blocksetIds[0]);
  expect(await page.evaluate(
    (id) => window.voxelMapEditor!.session.catalog.record(id)?.kind,
    original.mapId
  )).toBe("voxelmap");
});
