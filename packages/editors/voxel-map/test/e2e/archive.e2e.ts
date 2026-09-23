// Import Third-party Dependencies
import {
  expect,
  test,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import { waitForEditor } from "./fixtures.ts";
import {
  dialog,
  openPane
} from "./support/panels.ts";

// CONSTANTS
const kOfflineUrl = "/?offline&max-fps=10&samples=0";

interface OfflineIds {
  mapId: string;
  tilesetIds: (string | undefined)[];
}

function offlineIds(
  page: Page
): Promise<OfflineIds> {
  return page.evaluate(() => {
    const { session, workspace } = window.voxelMapEditor!;

    return {
      mapId: session.target.record.id,
      tilesetIds: workspace.engine.tilesets
        .definitions()
        .map((tileset) => tileset.asset?.id)
    };
  });
}

test("a reload reopens the same persisted map", async({ page }) => {
  await page.goto(kOfflineUrl);
  await waitForEditor(page);
  const before = await offlineIds(page);

  await page.reload();
  await waitForEditor(page);

  expect(await offlineIds(page)).toEqual(before);
});

test("exports the map, resets the workspace and imports it back", async({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(kOfflineUrl);
  await waitForEditor(page);
  const exported = await offlineIds(page);
  await openPane(page, "General");

  const downloading = page.waitForEvent("download");
  await page.locator("map-config-panel #export-map").click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("overworld.zip");
  const archivePath = await download.path();

  await page.locator("map-config-panel #reset-workspace").click();
  await dialog(page, "Reset workspace")
    .getByRole("button", { name: "Reset" })
    .click();
  await page.waitForEvent("load");
  await waitForEditor(page);

  const reseeded = await offlineIds(page);
  expect(reseeded.mapId).not.toBe(exported.mapId);

  await openPane(page, "General");
  await page
    .locator("map-config-panel input[type=file]")
    .setInputFiles(archivePath);
  await page.waitForURL(new RegExp(`target=${exported.mapId}`));
  await waitForEditor(page);

  expect(await offlineIds(page)).toEqual(exported);
  const state = await page.evaluate(() => {
    const { engine } = window.voxelMapEditor!.workspace;

    return {
      layers: engine.world.getLayers().map((layer) => layer.name),
      blocks: engine.blockRegistry.size
    };
  });
  expect(state).toEqual({
    layers: ["Ground"],
    blocks: 32
  });
  expect(errors).toEqual([]);
});

test("imports a map and its tileset as a copy", async({ page }) => {
  test.setTimeout(90_000);
  await page.goto(kOfflineUrl);
  await waitForEditor(page);
  const original = await offlineIds(page);
  await openPane(page, "General");

  const downloading = page.waitForEvent("download");
  await page.locator("map-config-panel #export-map").click();
  const archivePath = await (await downloading).path();
  await page.locator("map-config-panel input[type=file]")
    .setInputFiles(archivePath);
  await dialog(page, "Import archive")
    .getByRole("button", { name: "Import as copy" })
    .click();
  await page.waitForURL((url) => {
    const target = url.searchParams.get("target");

    return target !== null && target !== original.mapId;
  });
  await waitForEditor(page);

  const copied = await offlineIds(page);
  expect(copied.mapId).not.toBe(original.mapId);
  expect(copied.tilesetIds[0]).not.toBe(original.tilesetIds[0]);
  expect(await page.evaluate(
    (id) => window.voxelMapEditor!.session.catalog.record(id)?.kind,
    original.mapId
  )).toBe("voxelmap");
});
