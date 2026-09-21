// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  buttonGroup,
  dialog,
  dialogTitle,
  openPane,
  selectField,
  textField,
  titledDialog
} from "./support/panels.ts";
import { seedVoxels } from "./support/scene.ts";
import {
  clickTexel,
  setTextureMode,
  texturePanel,
  textureState
} from "./support/texture.ts";

function brushBlock(
  page: Page
): Promise<number> {
  return page.evaluate(
    () => window.voxelMapEditor!.workspace.state.brush.blockId
  );
}

function blockNames(
  page: Page
): Promise<string[]> {
  return page.evaluate(() => [
    ...window.voxelMapEditor!.workspace.engine.blockRegistry.getAll()
  ].map((block) => block.name));
}

function blockSurface(
  page: Page,
  blockId: number
): Promise<{ alphaMode?: string; side?: string; }> {
  return page.evaluate((id) => {
    const block = window.voxelMapEditor!.workspace.engine.blockRegistry.get(id);

    return {
      alphaMode: block?.alphaMode,
      side: block?.side
    };
  }, blockId);
}

async function eraseBlockTile(
  page: Page,
  blockId: number
): Promise<void> {
  await openPane(page, "Paint");
  const panel = texturePanel(page);
  const texel = await page.evaluate((id) => {
    const { engine } = window.voxelMapEditor!.workspace;
    const texture = engine.blockRegistry.get(id)!.defaultTexture!;
    const tileSize = engine.tilesets.definitions()[0].tileSize;

    return {
      x: (texture.col * tileSize) + Math.floor(tileSize / 2),
      y: (texture.row * tileSize) + Math.floor(tileSize / 2)
    };
  }, blockId);

  await setTextureMode(panel, "Erase");
  await clickTexel(panel, texel);
}

function blockTileSize(
  page: Page,
  blockId: number
): Promise<number | undefined> {
  return page.evaluate((id) => {
    const block = window.voxelMapEditor!.workspace.engine.blockRegistry.get(id);
    const refs = Object.values(block?.faceTextures ?? {});

    return (block?.defaultTexture ?? refs[0])?.size;
  }, blockId);
}

test.beforeEach(async({ page }) => {
  await openPane(page, "Blocks");
});

test("clicking a block selects it for the brush", async({ page }) => {
  const [, second] = await blockNames(page);
  const library = page.getByRole("listbox", { name: "Blocks" });
  await expect(library.getByRole("option")).toHaveCount(32);

  await library.getByRole("option", { name: second, exact: true }).click();

  await expect(library.getByRole("option", { name: second, exact: true }))
    .toHaveAttribute("aria-selected", "true");
  expect(await brushBlock(page)).toBe(2);
});

test("the library redraws after the browser drops its WebGL context", async({ page }) => {
  const canvas = page.locator("block-library-viewport canvas");
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

test("the add cell creates a block and selects it", async({ page }) => {
  await page.getByRole("button", { name: "Add block" }).click();
  const editor = titledDialog(page, "New Block");
  const title = dialogTitle(editor);
  await expect(title).not.toBeFocused();
  await title.fill("Lantern");
  await title.press("Enter");
  await titledDialog(page, "Lantern")
    .getByRole("button", { name: "Create" })
    .click();
  await expect(editor).toBeHidden();

  const library = page.getByRole("listbox", { name: "Blocks" });
  await expect(library.getByRole("option", { name: "Lantern" }))
    .toHaveAttribute("aria-selected", "true");
  expect(await brushBlock(page)).toBe(33);
});

test("double-clicking a block edits it in place", async({ page }) => {
  const [first] = await blockNames(page);
  const library = page.getByRole("listbox", { name: "Blocks" });

  await library.getByRole("option", { name: first, exact: true }).dblclick();
  const editor = titledDialog(page, first);
  const title = dialogTitle(editor);
  await title.fill("Bedrock");
  await title.press("Tab");
  const renamed = titledDialog(page, "Bedrock");
  await renamed.getByRole("button", { name: "Close" }).click();

  await expect(library.getByRole("option", { name: "Bedrock" })).toBeVisible();
  expect((await blockNames(page))[0]).toBe("Bedrock");
});

test("an opaque block hides the transparency section", async({ page }) => {
  const [first] = await blockNames(page);
  const library = page.getByRole("listbox", { name: "Blocks" });

  await library.getByRole("option", { name: first, exact: true }).dblclick();
  const editor = titledDialog(page, first);

  await expect(editor.getByText("Transparency")).toBeHidden();
  await expect(buttonGroup(editor, "Alpha")).toBeHidden();
});

test("a transparent block edits its alpha mode and its sides", async({ page }) => {
  await eraseBlockTile(page, 1);
  await expect.poll(() => blockSurface(page, 1))
    .toEqual({ alphaMode: "blend", side: undefined });

  await openPane(page, "Blocks");
  const [first] = await blockNames(page);
  const library = page.getByRole("listbox", { name: "Blocks" });
  await library.getByRole("option", { name: first, exact: true }).dblclick();
  const editor = titledDialog(page, first);
  const alpha = buttonGroup(editor, "Alpha");

  await expect(editor.getByText("Transparency")).toBeVisible();
  await expect(alpha.getByRole("radio", { name: "Blended" }))
    .toHaveAttribute("aria-checked", "true");
  await expect(alpha.getByRole("radio", { name: "Opaque" })).toHaveCount(0);

  await alpha.getByRole("radio", { name: "Cutout" }).click();
  await expect.poll(() => blockSurface(page, 1))
    .toEqual({ alphaMode: "mask", side: undefined });

  await buttonGroup(editor, "Sides")
    .getByRole("radio", { name: "Both" })
    .click();
  await expect.poll(() => blockSurface(page, 1))
    .toEqual({ alphaMode: "mask", side: "double" });
});

test("a lone tileset leaves the tileset field disabled", async({ page }) => {
  const [first] = await blockNames(page);
  const library = page.getByRole("listbox", { name: "Blocks" });

  await library.getByRole("option", { name: first, exact: true }).dblclick();

  await expect(titledDialog(page, first).locator("jolly-select[disabled]"))
    .toHaveCount(1);
});

test("moving a block to another tileset shows that tileset texture", async({ page }) => {
  await page.getByRole("button", { name: "Add tileset", exact: true }).click();
  const form = dialog(page, "Add tileset");
  await buttonGroup(form, "Source")
    .getByRole("radio", { name: "New", exact: true })
    .click();
  await textField(form, "Name").fill("stone");
  await form.getByRole("button", { name: "Create" }).click();
  await expect(form).toBeHidden();

  const stoneId = await page.evaluate(() => window.voxelMapEditor!.workspace
    .state.tilesets.entries
    .find((entry) => entry.label === "stone")!
    .definition.id);
  const [first, second] = await blockNames(page);
  const panel = texturePanel(page);
  const library = page.getByRole("listbox", { name: "Blocks" });
  await library.getByRole("option", { name: second, exact: true }).click();
  await library.getByRole("option", { name: first, exact: true }).dblclick();
  await expect.poll(async() => (await textureState(panel)).activeTextureId)
    .not.toBe(stoneId);

  await selectField(titledDialog(page, first), "Tileset")
    .selectOption({ label: "stone" });

  await expect.poll(() => textureState(panel)).toMatchObject({
    activeTextureId: stoneId,
    selectedRegionId: "block-1"
  });
});

test("the UV size group resizes the block tiles", async({ page }) => {
  const [first] = await blockNames(page);
  const library = page.getByRole("listbox", { name: "Blocks" });

  await library.getByRole("option", { name: first, exact: true }).dblclick();
  const editor = titledDialog(page, first);
  const sizes = buttonGroup(editor, "UV size");

  await expect(sizes.getByRole("radio", { name: "32", exact: true }))
    .toHaveAttribute("aria-checked", "true");

  await sizes.getByRole("radio", { name: "64", exact: true }).click();

  await expect.poll(() => blockTileSize(page, 1)).toBe(64);
  await expect(sizes.getByRole("radio", { name: "64", exact: true }))
    .toHaveAttribute("aria-checked", "true");
});

test("deleting a placed block asks first and removes its voxels", async({ page }) => {
  await seedVoxels(page, [
    { x: 0, y: 0, z: 0, blockId: 1 },
    { x: 1, y: 0, z: 0, blockId: 1 }
  ]);
  const [first] = await blockNames(page);

  await page.getByRole("listbox", { name: "Blocks" })
    .getByRole("option", { name: first, exact: true })
    .dblclick();
  const editor = titledDialog(page, first);
  await editor.getByRole("button", { name: "Delete" }).click();

  await expect(editor.getByRole("alert")).toContainText(`Delete "${first}"?`);
  await expect(editor.getByRole("alert")).toContainText("2 voxels");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await editor.getByRole("button", { name: "Delete" }).click();

  await expect.poll(() => blockNames(page)).not.toContain(first);
});
