// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  dialog,
  textField
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import { openPane } from "./support/panels.ts";
import {
  createBlankBlockset,
  texturePanel
} from "./support/texture.ts";

function blocksetSources(
  page: Page
): Promise<string[]> {
  return page.evaluate(() => window.voxelMapEditor!.workspace.view.document.blocksets
    .definitions()
    .map((definition) => definition.asset?.id ?? ""));
}

function blocksetTab(
  page: Page,
  name: RegExp
): Locator {
  return texturePanel(page).getByRole("tab", { name });
}

async function editBlockset(
  page: Page,
  label: string
): Promise<Locator> {
  await texturePanel(page)
    .getByRole("button", { name: `Edit ${label}` })
    .click();

  return dialog(page, `Blockset "${label}"`);
}

test.beforeEach(async({ page }) => {
  await openPane(page, "Blocks");
});

test("a single blockset keeps its tab, and the add button creates a new one", async({ page }) => {
  const blockset = blocksetTab(page, /^blockset/);
  await expect(blockset).toHaveAttribute("aria-selected", "true");
  await expect(blockset.locator("[part~=badge]")).toHaveText("32");
  await expect(page.locator("blockset-folder")).toHaveCount(0);

  await texturePanel(page).getByRole("button", { name: "Add blockset" }).click();
  await createBlankBlockset(page, "stone");

  const stone = blocksetTab(page, /^stone/);
  await expect(stone).toHaveAttribute("aria-selected", "true");
  await expect(stone.locator("[part~=badge]")).toHaveText("0");
  await expect.poll(async() => (await blocksetSources(page)).length).toBe(2);
});

test("the tab edit button renames the blockset asset", async({ page, target }) => {
  const editor = await editBlockset(page, "blockset");
  const name = textField(editor, "Name");
  await name.fill("terrain.blockset.json");
  await name.press("Enter");

  await expect(editor).toBeHidden();
  await expect(blocksetTab(page, /^terrain/)).toBeVisible();
  expect(await blocksetSources(page)).toEqual([target.blocksetId]);

  const renamed = await editBlockset(page, "terrain");
  await expect(textField(renamed, "Name")).toHaveValue("terrain");
});

test("removing a blockset flags the blocks left without texture", async({ page }) => {
  const editor = await editBlockset(page, "blockset");
  await editor.getByRole("button", { name: "Remove" }).click();
  await expect(editor.getByRole("alert")).toContainText("Remove \"blockset\"?");
  await expect(editor.getByRole("alert"))
    .toContainText("The blockset asset is kept.");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await editor.getByRole("button", { name: "Remove" }).click();

  await expect.poll(() => blocksetSources(page)).toEqual([]);
  await expect(editor).toBeHidden();
  await expect(page.getByRole("button", { name: "Add blockset" })).toBeVisible();
  await expect.poll(() => page.evaluate(
    () => [...window.voxelMapEditor!.workspace.view.document.blocks].length
  )).toBe(0);
});
