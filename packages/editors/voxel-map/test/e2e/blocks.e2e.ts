// Import Third-party Dependencies
import { dialog } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import type { VoxelMapPage } from "./support/voxelMap.ts";

function brushBlock(
  map: VoxelMapPage
): Promise<number | null> {
  return map.page.evaluate(
    () => window.voxelMapEditor!.workspace.state.block.id
  );
}

function blockNames(
  map: VoxelMapPage
): Promise<string[]> {
  return map.page.evaluate(() => [
    ...window.voxelMapEditor!.workspace.view.document.blocks.getAll()
  ].map((block) => block.name));
}

function blockProperties(
  map: VoxelMapPage,
  name: string
): Promise<Record<string, unknown> | undefined> {
  return map.page.evaluate((blockName) => [
    ...window.voxelMapEditor!.workspace.view.document.blocks.getAll()
  ].find((block) => block.name === blockName)?.properties, name);
}

function blockSurface(
  map: VoxelMapPage,
  blockId: number
): Promise<{ alphaMode?: string; side?: string; }> {
  return map.page.evaluate((id) => {
    const block = window.voxelMapEditor!.workspace.view.document.blocks.get(id);

    return {
      alphaMode: block?.alphaMode,
      side: block?.side
    };
  }, blockId);
}

function blockTileSize(
  map: VoxelMapPage,
  blockId: number
): Promise<number | undefined> {
  return map.page.evaluate((id) => {
    const block = window.voxelMapEditor!.workspace.view.document.blocks.get(id);
    const refs = Object.values(block?.faceTextures ?? {});

    return (block?.defaultTexture ?? refs[0])?.size;
  }, blockId);
}

async function eraseBlockTile(
  map: VoxelMapPage,
  blockId: number
): Promise<void> {
  await map.panes.open("Paint");
  const texel = await map.texture.blockTileCenter(blockId);

  await map.texture.selectMode("Erase");
  await map.texture.clickTexel(texel);
}

test.beforeEach(async({ map }) => {
  await map.panes.open("Blocks");
});

test("clicking a block selects it for the brush", async({ map }) => {
  const { library } = map.blocks;
  const [, second] = await blockNames(map);
  await expect(library.options).toHaveCount(32);

  await library.select(second);

  await expect(library.option(second)).toHaveAttribute("aria-selected", "true");
  expect(await brushBlock(map)).toBe(2);
});

test("the settings menu opens on hover and stays open once clicked", async({ map, page }) => {
  const { settingsButton, settingsMenu } = map.blocks;
  const mostUsed = settingsMenu.getByRole("menuitemradio", { name: "Most used first" });

  await settingsButton.hover();
  await expect(settingsMenu).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(settingsMenu).toBeHidden();

  await settingsButton.hover();
  await expect(settingsMenu).toBeVisible();
  await settingsButton.click();
  await page.mouse.move(0, 0);
  await expect(mostUsed).toBeVisible();

  await mostUsed.click();
  await expect(settingsMenu).toBeHidden();
  await settingsButton.click();
  await expect(mostUsed).toHaveAttribute("aria-checked", "true");
});

test("the active blockset setting shows only the selected tab's blocks", async({ map }) => {
  const { blocks, texture } = map;
  await texture.addBlankBlockset("stone");
  await expect(blocks.library.options).toHaveCount(32);

  await blocks.chooseSetting("Active blockset");
  await expect(blocks.library.options).toHaveCount(0);

  await texture.blocksetTab(/^blockset/).click();
  await expect(blocks.library.options).toHaveCount(32);

  await blocks.chooseSetting("All blocksets");
  await texture.blocksetTab(/^stone/).click();
  await expect(blocks.library.options).toHaveCount(32);
});

test("the search shows only the blocks whose name matches", async({ map }) => {
  const { blocks } = map;
  const [, second] = await blockNames(map);

  await blocks.search(second);
  await expect(blocks.library.option(second)).toBeVisible();
  const shown = await blocks.library.names();
  expect(shown.length).toBeLessThan(32);
  expect(shown.every((name) => name.includes(second))).toBe(true);

  await blocks.search("no such block");
  await expect(blocks.library.options).toHaveCount(0);
  await expect(blocks.noMatches).toBeVisible();

  await blocks.searchBox.press("Escape");
  await expect(blocks.library.options).toHaveCount(32);
  await expect(blocks.noMatches).toBeHidden();
});

test("the add cell creates a block and selects it", async({ map }) => {
  const { library } = map.blocks;
  await library.addButton.click();
  const editor = map.blockDialog("New Block");
  await expect(editor.title).not.toBeFocused();
  await editor.rename("Lantern");
  await map.blockDialog("Lantern").createButton.click();
  await expect(editor.root).toBeHidden();

  await expect(library.option("Lantern")).toHaveAttribute("aria-selected", "true");
  expect(await brushBlock(map)).toBe(33);
});

test("double-clicking a block edits it in place", async({ map }) => {
  const { library } = map.blocks;
  const [first] = await blockNames(map);

  await library.edit(first);
  await map.blockDialog(first).rename("Bedrock", "Tab");
  await map.blockDialog("Bedrock").closeButton.click();

  await expect(library.option("Bedrock")).toBeVisible();
  expect((await blockNames(map))[0]).toBe("Bedrock");
});

test("a transparent block edits its alpha mode and its sides", async({ map }) => {
  const { library } = map.blocks;
  const [first] = await blockNames(map);
  await library.edit(first);
  const editor = map.blockDialog(first);
  await expect(editor.transparency).toBeHidden();
  await expect(editor.alpha).toBeHidden();
  await editor.closeButton.click();

  await eraseBlockTile(map, 1);
  await expect.poll(() => blockSurface(map, 1))
    .toEqual({ alphaMode: "mask", side: undefined });

  await map.panes.open("Blocks");
  await library.edit(first);

  await expect(editor.transparency).toBeVisible();
  await expect(editor.alpha.getByRole("radio", { name: "Cutout" }))
    .toHaveAttribute("aria-checked", "true");
  await expect(editor.alpha.getByRole("radio", { name: "Opaque" })).toHaveCount(0);

  await editor.alpha.getByRole("radio", { name: "Blended" }).click();
  await expect.poll(() => blockSurface(map, 1))
    .toEqual({ alphaMode: "blend", side: undefined });

  await editor.sides.getByRole("radio", { name: "Both" }).click();
  await expect.poll(() => blockSurface(map, 1))
    .toEqual({ alphaMode: "blend", side: "double" });
});

test("a block keeps its typed custom properties", async({ map }) => {
  const { library } = map.blocks;
  const [first] = await blockNames(map);
  await library.edit(first);
  const editor = map.blockDialog(first);
  const { properties } = editor;

  const keys = properties.getByRole("textbox", { name: "key" });
  await expect(keys).toHaveCount(1);

  await properties.locator("jolly-select").getByRole("combobox")
    .selectOption({ label: "Number" });
  const value = properties.locator("jolly-number input");
  await value.fill("3");
  await value.press("Tab");
  await keys.fill("hardness");
  await keys.press("Tab");

  await expect(keys).toHaveCount(2);
  await expect.poll(() => blockProperties(map, first))
    .toEqual({ hardness: 3 });

  await editor.closeButton.click();
  await library.edit(first);

  await expect(keys).toHaveCount(2);
  await expect(keys.first()).toHaveValue("hardness");
  await expect(value).toHaveValue("3");
});

test("a lone blockset leaves the blockset field disabled", async({ map }) => {
  const [first] = await blockNames(map);

  await map.blocks.library.edit(first);

  await expect(map.blockDialog(first).disabledBlockset).toHaveCount(1);
});

test("the UV size group resizes the block tiles", async({ map }) => {
  const [first] = await blockNames(map);

  await map.blocks.library.edit(first);
  const { uvSizes } = map.blockDialog(first);

  await expect(uvSizes.getByRole("radio", { name: "32", exact: true }))
    .toHaveAttribute("aria-checked", "true");

  await uvSizes.getByRole("radio", { name: "64", exact: true }).click();

  await expect.poll(() => blockTileSize(map, 1)).toBe(64);
  await expect(uvSizes.getByRole("radio", { name: "64", exact: true }))
    .toHaveAttribute("aria-checked", "true");
});

test("deleting a placed block asks first and removes its voxels", async({ map, page }) => {
  await map.world.seed([
    { x: 0, y: 0, z: 0, blockId: 1 },
    { x: 1, y: 0, z: 0, blockId: 1 }
  ]);
  const [first] = await blockNames(map);

  await map.blocks.library.edit(first);
  const editor = map.blockDialog(first);
  await editor.deleteButton.click();

  await expect(editor.alert).toContainText(`Delete "${first}"?`);
  await expect(editor.alert).toContainText("2 voxels");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await editor.deleteButton.click();

  await expect.poll(() => blockNames(map)).not.toContain(first);
});

test("the block context menu duplicates a block and deletes the copy", async({ map }) => {
  const { library } = map.blocks;
  const [, second] = await blockNames(map);
  const copy = `${second} copy`;

  await library.choose(second, "Duplicate");
  await expect(library.option(copy)).toHaveAttribute("aria-selected", "true");

  await library.choose(copy, "Delete");
  await expect.poll(() => blockNames(map)).not.toContain(copy);
});

test("the block context menu removes the voxels of a block after asking", async({ map, page }) => {
  await map.world.seed([
    { x: 0, y: 0, z: 0, blockId: 1 },
    { x: 1, y: 0, z: 0, blockId: 2 }
  ]);
  const { library } = map.blocks;
  const [first] = await blockNames(map);

  await library.choose(first, "Remove voxels…");
  await expect(library.option(first)).toHaveAttribute("aria-selected", "true");
  const confirm = dialog(page, "Remove voxels");
  await expect(confirm).toContainText(`Remove 1 voxel of "${first}" from 1 layer?`);
  await confirm.getByRole("button", { name: "Remove" }).click();

  await expect.poll(() => map.world.blocks([
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 }
  ])).toEqual([null, 2]);
  expect(await blockNames(map)).toContain(first);
});
