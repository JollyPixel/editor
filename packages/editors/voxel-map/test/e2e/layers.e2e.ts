// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  buttonGroup,
  dialog,
  selectField,
  textField
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import { openPane } from "./support/panels.ts";
import { blocksAt, seedVoxels } from "./support/scene.ts";

interface LayerSummary {
  name: string;
  voxels: number;
  visible: boolean;
}

function voxelLayers(
  page: Page
): Promise<LayerSummary[]> {
  return page.evaluate(() => window.voxelMapEditor!.workspace.engine.world
    .getLayers()
    .map((layer) => {
      return {
        name: layer.name,
        voxels: layer.voxelCount,
        visible: layer.visible
      };
    }));
}

function objectLayers(
  page: Page
): Promise<Array<{ name: string; objects: string[]; }>> {
  return page.evaluate(() => window.voxelMapEditor!.workspace.engine.world
    .objectLayers.toArray()
    .map((layer) => {
      return {
        name: layer.name,
        objects: layer.objects.map((object) => object.name)
      };
    }));
}

function objectVisibility(
  page: Page
): Promise<Array<{ name: string; visible: boolean; objects: boolean[]; }>> {
  return page.evaluate(() => window.voxelMapEditor!.workspace.engine.world
    .objectLayers.toArray()
    .map((layer) => {
      return {
        name: layer.name,
        visible: layer.visible,
        objects: layer.objects.map((object) => object.visible)
      };
    }));
}

async function syncFence(
  page: Page,
  peer: Page
): Promise<void> {
  await page.evaluate(
    () => window.voxelMapEditor!.workspace.engine.world.addLayer("Fence")
  );
  await expect.poll(async() => (await voxelLayers(peer))
    .some((layer) => layer.name === "Fence")).toBe(true);
}

function layerRow(
  page: Page,
  name: string
): Locator {
  return page.locator(`[role="treeitem"][data-id$=":${name}"]`);
}

async function addEntry(
  page: Page,
  kind: string,
  name: string
): Promise<void> {
  await page.getByRole("button", { name: "Add layer" }).click();
  const form = dialog(page, "New");
  await buttonGroup(form, "Kind")
    .getByRole("radio", { name: kind, exact: true })
    .click();
  await textField(form, "Name").fill(name);
  await form.getByRole("button", { name: "Create" }).click();
  await expect(form).toBeHidden();
}

test.beforeEach(async({ page }) => {
  await openPane(page, "Layers");
});

test("a new voxel layer is listed and selected", async({ page }) => {
  await addEntry(page, "Voxel", "Caves");

  const row = layerRow(page, "Caves");
  await expect(row).toHaveAttribute("aria-selected", "true");
  expect((await voxelLayers(page)).map((layer) => layer.name))
    .toEqual(["Caves", "Ground"]);
});

test("clicking the empty tree area keeps the layer selected", async({ page }) => {
  const manager = page.locator("layer-manager");
  const row = layerRow(page, "Ground");
  const box = await manager.boundingBox();
  if (box === null) {
    throw new Error("The layer manager is not rendered");
  }

  await row.click();
  await manager.click({ position: { x: 8, y: box.height - 8 } });

  await expect(row).toHaveAttribute("aria-selected", "true");
});

test("cloning copies the voxels and removing asks first", async({ page }) => {
  await seedVoxels(page, [{ x: 0, y: 0, z: 0, blockId: 1 }]);
  await layerRow(page, "Ground").click();

  await page.getByRole("button", { name: "Clone layer" }).click();
  await expect(page.getByRole("treeitem")).toHaveCount(2);
  await expect.poll(async() => (await voxelLayers(page)).map((layer) => layer.voxels))
    .toEqual([1, 1]);

  await layerRow(page, "Ground (1)").click();
  await page.getByRole("button", { name: "Remove layer" }).click();
  const confirm = dialog(page, "Delete layer");
  await confirm.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByRole("treeitem")).toHaveCount(1);
  await expect(layerRow(page, "Ground")).toHaveAttribute("aria-selected", "true");
  expect((await voxelLayers(page)).map((layer) => layer.name)).toEqual(["Ground"]);
});

test("merging folds a layer into the chosen target", async({ page }) => {
  await addEntry(page, "Voxel", "Top");
  await seedVoxels(page, [{ x: 0, y: 1, z: 0, blockId: 2 }], "Top");
  await seedVoxels(page, [{ x: 0, y: 0, z: 0, blockId: 1 }]);

  await layerRow(page, "Top").click();
  await page.getByRole("button", { name: "Merge layer" }).click();
  const form = dialog(page, "Merge layer");
  await selectField(form, "Into").selectOption({ label: "Ground" });
  await form.getByRole("button", { name: "Merge" }).click();

  await expect(page.getByRole("treeitem")).toHaveCount(1);
  expect(await voxelLayers(page)).toEqual([
    { name: "Ground", voxels: 2, visible: true }
  ]);
});

test("the eye hides and shows a layer", async({ page }) => {
  await seedVoxels(page, [{ x: 0, y: 0, z: 0, blockId: 1 }]);
  const row = layerRow(page, "Ground");

  await row.getByRole("button", { name: "Hide" }).click();
  await expect.poll(() => blocksAt(page, [{ x: 0, y: 0, z: 0 }])).toEqual([null]);
  await row.getByRole("button", { name: "Show" }).click();
  await expect.poll(() => blocksAt(page, [{ x: 0, y: 0, z: 0 }])).toEqual([1]);
});

test("hiding a voxel layer stays local to the page", async({ page, peer }) => {
  test.slow();
  await seedVoxels(page, [{ x: 0, y: 0, z: 0, blockId: 1 }]);
  await expect.poll(() => blocksAt(peer, [{ x: 0, y: 0, z: 0 }])).toEqual([1]);

  await layerRow(page, "Ground").getByRole("button", { name: "Hide" }).click();
  await expect.poll(() => blocksAt(page, [{ x: 0, y: 0, z: 0 }])).toEqual([null]);
  await syncFence(page, peer);

  expect(await blocksAt(peer, [{ x: 0, y: 0, z: 0 }])).toEqual([1]);
  expect((await voxelLayers(peer))
    .find((layer) => layer.name === "Ground")?.visible).toBe(true);
});

test("hiding an object layer or an object stays local to the page", async({ page, peer }) => {
  test.slow();
  await addEntry(page, "Objects", "Spawns");
  await addEntry(page, "Object", "Player");
  await expect.poll(() => objectVisibility(peer)).toEqual([
    { name: "Spawns", visible: true, objects: [true] }
  ]);

  await page.getByRole("treeitem", { name: /^Player/ })
    .getByRole("button", { name: "Hide" })
    .click();
  await layerRow(page, "Spawns")
    .getByRole("button", { name: "Hide" })
    .first()
    .click();
  await syncFence(page, peer);

  await expect(page.getByRole("treeitem", { name: /^Player/ })
    .getByRole("button", { name: "Show" })).toBeVisible();
  expect(await objectVisibility(page)).toEqual([
    { name: "Spawns", visible: true, objects: [true] }
  ]);
  expect(await objectVisibility(peer)).toEqual([
    { name: "Spawns", visible: true, objects: [true] }
  ]);
});

test("objects are added inside the selected object layer and renamed in place", async({ page }) => {
  await addEntry(page, "Objects", "Spawns");
  await addEntry(page, "Object", "Player");

  const object = page.getByRole("treeitem", { name: /^Player/ });
  await expect(object).toHaveAttribute("aria-selected", "true");
  expect(await objectLayers(page)).toEqual([
    { name: "Spawns", objects: ["Player"] }
  ]);

  await object.locator(".label").dblclick();
  const rename = page.getByRole("textbox", { name: "Rename" });
  await rename.fill("Hero");
  await rename.press("Enter");

  await expect(page.getByRole("treeitem", { name: /^Hero/ })).toBeVisible();
  expect(await objectLayers(page)).toEqual([
    { name: "Spawns", objects: ["Hero"] }
  ]);
});
