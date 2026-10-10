// Import Third-party Dependencies
import {
  boxOf,
  dialog,
  selectField
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import type { VoxelMapPage } from "./support/voxelMap.ts";

interface LayerSummary {
  name: string;
  voxels: number;
  visible: boolean;
}

function voxelLayers(
  map: VoxelMapPage
): Promise<LayerSummary[]> {
  return map.page.evaluate(() => window.voxelMapEditor!.workspace.view.document.world
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
  map: VoxelMapPage
): Promise<Array<{ name: string; objects: string[]; }>> {
  return map.page.evaluate(() => window.voxelMapEditor!.workspace.view.document.world
    .objectLayers.toArray()
    .map((layer) => {
      return {
        name: layer.name,
        objects: layer.objects.map((object) => object.name)
      };
    }));
}

function objectVisibility(
  map: VoxelMapPage
): Promise<Array<{ name: string; visible: boolean; objects: boolean[]; }>> {
  return map.page.evaluate(() => window.voxelMapEditor!.workspace.view.document.world
    .objectLayers.toArray()
    .map((layer) => {
      return {
        name: layer.name,
        visible: layer.visible,
        objects: layer.objects.map((object) => object.visible)
      };
    }));
}

function layerShown(
  map: VoxelMapPage,
  name: string
): Promise<boolean> {
  return map.page.evaluate((layerName) => {
    const { view } = window.voxelMapEditor!.workspace;

    return view.layerVisibility.isVisible(
      view.document.world.getLayer(layerName)!
    );
  }, name);
}

async function syncFence(
  map: VoxelMapPage,
  peerMap: VoxelMapPage
): Promise<void> {
  await map.page.evaluate(
    () => window.voxelMapEditor!.workspace.view.document.world.addLayer("Fence")
  );
  await expect.poll(async() => (await voxelLayers(peerMap))
    .some((layer) => layer.name === "Fence")).toBe(true);
}

test.beforeEach(async({ map }) => {
  await map.panes.open("Layers");
});

test("a new voxel layer is listed and selected", async({ map }) => {
  await map.layers.add("Voxel", "Caves");

  await expect(map.layers.row("Caves")).toHaveAttribute("aria-selected", "true");
  expect((await voxelLayers(map)).map((layer) => layer.name))
    .toEqual(["Caves", "Ground"]);
});

test("clicking the empty tree area keeps the layer selected", async({ map }) => {
  const { tree } = map.layers;
  const row = map.layers.row("Ground");
  const box = await boxOf(tree);

  await row.click();
  await tree.click({ position: { x: 8, y: box.height - 8 } });

  await expect(row).toHaveAttribute("aria-selected", "true");
});

test("the custom properties folder only toggles once it holds a property", async({ map }) => {
  const { properties } = map.layers;
  const toggle = properties.getByRole("button", { name: "Custom Properties" });

  await map.layers.row("Ground").click();
  await expect(toggle).toHaveCount(0);

  await properties.getByRole("button", { name: "Add property" }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await properties.getByRole("button", { name: "Remove property" }).click();
  await expect(toggle).toHaveCount(0);
});

test("the layer header rebases the layer and locks while transforming", async({ map }) => {
  const { layers } = map;
  await map.world.seed([{ x: 3, y: 1, z: 2, blockId: 1 }]);
  await layers.row("Ground").click();

  await expect(layers.panel.locator("jolly-button[title*=\"(3, 1, 2)\"]")).toHaveCount(1);

  await layers.rebaseButton.click();
  await expect.poll(() => map.page.evaluate(() => {
    const { position } = window.voxelMapEditor!.workspace.view.document.world
      .getLayer("Ground")!;

    return { x: position.x, y: position.y, z: position.z };
  })).toEqual({ x: 3, y: 1, z: 2 });
  await expect(layers.rebaseButton).toBeDisabled();
  expect(await map.world.blocks([{ x: 3, y: 1, z: 2 }])).toEqual([1]);

  await layers.transformButton.click();
  await expect(map.toolbar.rotate).toBeVisible();
  await expect(layers.transformButton).toBeDisabled();
  await expect(layers.panel.locator("jolly-vector3")).toHaveAttribute("disabled", "");
});

test("cloning copies the voxels and removing asks first", async({ map, page }) => {
  const { layers } = map;
  await map.world.seed([{ x: 0, y: 0, z: 0, blockId: 1 }]);
  await layers.row("Ground").click();

  await layers.cloneButton.click();
  await expect(layers.rows).toHaveCount(2);
  await expect.poll(async() => (await voxelLayers(map)).map((layer) => layer.voxels))
    .toEqual([1, 1]);

  await layers.row("Ground (1)").click();
  await layers.removeButton.click();
  await dialog(page, "Delete layer").getByRole("button", { name: "Delete" }).click();

  await expect(layers.rows).toHaveCount(1);
  await expect(layers.row("Ground")).toHaveAttribute("aria-selected", "true");
  expect((await voxelLayers(map)).map((layer) => layer.name)).toEqual(["Ground"]);
});

test("merging folds a layer into the chosen target", async({ map, page }) => {
  const { layers, world } = map;
  await layers.add("Voxel", "Top");
  await world.seed([{ x: 0, y: 1, z: 0, blockId: 2 }], "Top");
  await world.seed([{ x: 0, y: 0, z: 0, blockId: 1 }]);

  await layers.row("Top").click();
  await layers.mergeButton.click();
  const form = dialog(page, "Merge layer");
  await selectField(form, "Into").selectOption({ label: "Ground" });
  await form.getByRole("button", { name: "Merge" }).click();

  await expect(layers.rows).toHaveCount(1);
  expect(await voxelLayers(map)).toEqual([
    { name: "Ground", voxels: 2, visible: true }
  ]);
});

test("the eye hides and shows a layer", async({ map }) => {
  await map.world.seed([{ x: 0, y: 0, z: 0, blockId: 1 }]);
  const row = map.layers.row("Ground");

  await row.getByRole("button", { name: "Hide" }).click();
  await expect.poll(() => layerShown(map, "Ground")).toBe(false);
  await row.getByRole("button", { name: "Show" }).click();
  await expect.poll(() => layerShown(map, "Ground")).toBe(true);
});

test("hiding a voxel layer stays local to the page", async({ map, peerMap }) => {
  test.slow();
  const cell = { x: 0, y: 0, z: 0 };
  await map.world.seed([{ ...cell, blockId: 1 }]);
  await expect.poll(() => peerMap.world.blocks([cell])).toEqual([1]);

  await map.layers.row("Ground").getByRole("button", { name: "Hide" }).click();
  await expect.poll(() => layerShown(map, "Ground")).toBe(false);
  await syncFence(map, peerMap);

  expect(await map.world.blocks([cell])).toEqual([1]);
  expect(await layerShown(peerMap, "Ground")).toBe(true);
  for (const client of [map, peerMap]) {
    expect((await voxelLayers(client))
      .find((layer) => layer.name === "Ground")?.visible).toBe(true);
  }
});

test("hiding an object layer or an object stays local to the page", async({ map, peerMap }) => {
  test.slow();
  const { layers } = map;
  await layers.add("Objects", "Spawns");
  await layers.add("Object", "Player");
  await expect.poll(() => objectVisibility(peerMap)).toEqual([
    { name: "Spawns", visible: true, objects: [true] }
  ]);

  await layers.objectRow("Player")
    .getByRole("button", { name: "Hide" })
    .click();
  await layers.row("Spawns")
    .getByRole("button", { name: "Hide" })
    .first()
    .click();
  await syncFence(map, peerMap);

  await expect(layers.objectRow("Player")
    .getByRole("button", { name: "Show" })).toBeVisible();
  await expect(layers.row("Spawns")
    .getByRole("button", { name: "Hide" })).toHaveCount(0);
  for (const client of [map, peerMap]) {
    expect(await objectVisibility(client)).toEqual([
      { name: "Spawns", visible: true, objects: [true] }
    ]);
  }
});

test("objects are added inside the selected object layer and renamed in place", async({ map }) => {
  const { layers } = map;
  await layers.add("Objects", "Spawns");
  await layers.add("Object", "Player");

  const object = layers.objectRow("Player");
  await expect(object).toHaveAttribute("aria-selected", "true");
  expect(await objectLayers(map)).toEqual([
    { name: "Spawns", objects: ["Player"] }
  ]);

  await layers.rename(object, "Hero");

  await expect(layers.objectRow("Hero")).toBeVisible();
  expect(await objectLayers(map)).toEqual([
    { name: "Spawns", objects: ["Hero"] }
  ]);
});
