// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  dialog,
  openPane,
  selectField,
  textField
} from "./support/panels.ts";
import { texturePanel } from "./support/texture.ts";

function tilesetSources(
  page: Page
): Promise<string[]> {
  return page.evaluate(() => window.voxelMapEditor!.workspace.engine.tilesets
    .definitions()
    .map((definition) => definition.asset?.id ?? ""));
}

function tilesetTab(
  page: Page,
  name: RegExp
): Locator {
  return texturePanel(page).getByRole("tab", { name });
}

async function editTileset(
  page: Page,
  label: string
): Promise<Locator> {
  await texturePanel(page)
    .getByRole("button", { name: `Edit ${label}` })
    .click();

  return dialog(page, `Tileset "${label}"`);
}

test.beforeEach(async({ page }) => {
  await openPane(page, "Blocks");
});

test("a single tileset keeps its tab, and the add button creates a new one", async({ page }) => {
  const tileset = tilesetTab(page, /^tileset/);
  await expect(tileset).toHaveAttribute("aria-selected", "true");
  await expect(tileset.locator("[part~=badge]")).toHaveText("32");
  await expect(page.locator("tileset-folder")).toHaveCount(0);

  await texturePanel(page).getByRole("button", { name: "Add tileset" }).click();
  const form = dialog(page, "Add tileset");
  await selectField(form, "Source").selectOption({ label: "New texture" });
  await textField(form, "Name").fill("stone");
  await form.getByRole("button", { name: "Create" }).click();
  await expect(form).toBeHidden();

  const stone = tilesetTab(page, /^stone/);
  await expect(stone).toHaveAttribute("aria-selected", "true");
  await expect(stone.locator("[part~=badge]")).toHaveText("0");
  await expect.poll(async() => (await tilesetSources(page)).length).toBe(2);
});

test("the tab edit button renames the tileset asset", async({ page, world }) => {
  const editor = await editTileset(page, "tileset");
  const name = textField(editor, "Name");
  await name.fill("terrain.pixelart");
  await name.press("Enter");

  await expect(editor).toBeHidden();
  await expect(tilesetTab(page, /^terrain/)).toBeVisible();
  expect(await tilesetSources(page)).toEqual([world.tilesetId]);

  const renamed = await editTileset(page, "terrain");
  await expect(textField(renamed, "Name")).toHaveValue("terrain");
});

test("removing a tileset flags the blocks left without texture", async({ page }) => {
  const editor = await editTileset(page, "tileset");
  await editor.getByRole("button", { name: "Remove" }).click();
  const confirm = dialog(page, "Remove \"tileset\"");
  await expect(confirm).toContainText("The texture asset is kept.");
  await confirm.getByRole("button", { name: "Remove" }).click();

  await expect.poll(() => tilesetSources(page)).toEqual([]);
  await expect(editor).toBeHidden();
  await expect(page.getByRole("button", { name: "Add tileset" })).toBeVisible();
  await expect(page.getByRole("button", { name: /without tileset/ })).toBeVisible();
});
