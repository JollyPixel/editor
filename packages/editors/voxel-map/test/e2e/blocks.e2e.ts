// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import type { VoxelMapPage } from "./support/voxelMap.ts";

function brushBlock(
  map: VoxelMapPage
): Promise<number> {
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

test("the order menu opens on hover and stays open once clicked", async({ map, page }) => {
  const { orderButton, orderMenu } = map.blocks;
  const mostUsed = orderMenu.getByRole("menuitemradio", { name: "Most used first" });

  await orderButton.hover();
  await expect(orderMenu).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(orderMenu).toBeHidden();

  await orderButton.hover();
  await expect(orderMenu).toBeVisible();
  await orderButton.click();
  await page.mouse.move(0, 0);
  await expect(mostUsed).toBeVisible();

  await mostUsed.click();
  await expect(orderMenu).toBeHidden();
  await expect(orderButton).toHaveAccessibleName("Order: Most used first");
});

test("the library redraws after the browser drops its WebGL context", async({ map }) => {
  const { canvas } = map.blocks.library;
  await expect(canvas).toHaveCount(1);

  await canvas.evaluate((element: HTMLCanvasElement) => {
    element.dataset.dropped = "true";
    element
      .getContext("webgl2")!
      .getExtension("WEBGL_lose_context")!
      .loseContext();
  });

  await expect(canvas).not.toHaveAttribute("data-dropped");
  expect(await canvas.evaluate(
    (element: HTMLCanvasElement) => element.getContext("webgl2")!.isContextLost()
  )).toBe(false);
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
