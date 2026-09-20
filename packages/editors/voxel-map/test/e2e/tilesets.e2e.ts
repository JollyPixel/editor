// Import Third-party Dependencies
import type { Page } from "@playwright/test";

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

function tilesetSources(
  page: Page
): Promise<string[]> {
  return page.evaluate(() => window.voxelMapEditor!.workspace.engine.tilesets
    .definitions()
    .map((definition) => definition.asset?.id ?? ""));
}

test.beforeEach(async({ page }) => {
  await openPane(page, "Blocks");
});

test("the folder lists the map tileset and creates a new one", async({ page }) => {
  const folder = page.locator("tileset-folder");
  await expect(folder.getByRole("button", { name: /^tileset/ }))
    .toContainText("32 blocks");

  await page.getByRole("button", { name: "Add tileset", exact: true }).click();
  const form = dialog(page, "Add tileset");
  await selectField(form, "Source").selectOption({ label: "New texture" });
  await textField(form, "Name").fill("stone");
  await form.getByRole("button", { name: "Create" }).click();
  await expect(form).toBeHidden();

  await expect(folder.getByRole("button", { name: /^stone/ })).toContainText("0 blocks");
  await expect.poll(async() => (await tilesetSources(page)).length).toBe(2);
});

test("the manager renames a tileset asset", async({ page, world }) => {
  await page.getByRole("button", { name: "Manage tilesets" }).click();
  const manager = dialog(page, "Tilesets");
  const name = manager.locator("jolly-text").getByRole("textbox");
  await name.fill("terrain.pixelart");
  await name.press("Enter");

  await expect(page.locator("tileset-folder").getByRole("button", { name: /^terrain/ }))
    .toBeVisible();
  expect(await tilesetSources(page)).toEqual([world.tilesetId]);
});

test("removing a tileset flags the blocks left without texture", async({ page }) => {
  await page.getByRole("button", { name: "Manage tilesets" }).click();
  await dialog(page, "Tilesets").getByRole("button", { name: "Remove tileset" }).click();
  const confirm = dialog(page, "Remove");
  await expect(confirm).toContainText("The texture asset is kept.");
  await confirm.getByRole("button", { name: "Remove" }).click();

  await expect.poll(() => tilesetSources(page)).toEqual([]);
  await dialog(page, "Tilesets").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: /without tileset/ })).toBeVisible();
});
