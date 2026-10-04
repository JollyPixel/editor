// Import Third-party Dependencies
import { expect, test } from "@playwright/test";
import {
  boxOf,
  centerOf,
  dragTo,
  treeRow
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  assetAction,
  assetMenu,
  assetRows,
  MAP,
  MODEL,
  openShell,
  renameTo,
  SEED_ROW_COUNT,
  TEXTURE
} from "./support/shell.ts";

test("filters the asset tree by kind", async({ page }) => {
  await openShell(page);
  const kinds = page.locator("asset-browser jolly-button-group");

  await kinds.getByRole("radio", { name: "Voxel map" }).click();
  await expect(assetRows(page)).toHaveCount(4);
  await expect(treeRow(page, MAP)).toBeVisible();
  await expect(treeRow(page, "overworld.tileset.json")).toBeVisible();
  await expect(treeRow(page, "models")).toBeVisible();

  await kinds.getByRole("radio", { name: "All kinds" }).click();
  await expect(assetRows(page)).toHaveCount(SEED_ROW_COUNT);
});

test("moves several selected rows into a new folder", async({ page }) => {
  await openShell(page);
  await assetAction(page, "New folder").click();
  await renameTo(page, "world");

  await treeRow(page, "maps").click();
  await treeRow(page, "models").click({ modifiers: ["ControlOrMeta"] });
  await dragTo(page, treeRow(page, "maps"), await centerOf(treeRow(page, "world")));

  await expect(assetRows(page)).toHaveCount(1);
  await treeRow(page, "world").getByRole("button", { name: "Expand" }).click();
  await expect(treeRow(page, "maps")).toBeVisible();
  await expect(treeRow(page, "models")).toBeVisible();
});

test("a folder emptied by a move stays in the tree", async({ page }) => {
  await openShell(page);

  await dragTo(page, treeRow(page, MODEL), await centerOf(treeRow(page, "maps")));

  await expect(treeRow(page, "models")).toBeVisible();
  await expect(assetRows(page)).toHaveCount(SEED_ROW_COUNT);
  await expect(treeRow(page, TEXTURE)).toBeVisible();
});

test("deleting an asset can keep its companion", async({ page }) => {
  await openShell(page);
  await treeRow(page, MAP).click();
  await assetAction(page, "Delete").click();

  const dialog = page.locator("asset-delete-dialog");
  await expect(dialog.getByText("Also delete its companion")).toBeVisible();
  const companions = dialog.getByRole("checkbox");
  await expect(companions).toBeChecked();
  await companions.click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(treeRow(page, MAP)).toHaveCount(0);
  await expect(treeRow(page, "overworld.tileset.json")).toBeVisible();
});

test("exports the selected asset as a ZIP archive", async({ page }) => {
  await openShell(page);
  const exportButton = assetAction(page, "Export");
  await expect(exportButton).toBeDisabled();

  await treeRow(page, MAP).click();
  const download = page.waitForEvent("download");
  await exportButton.click();

  expect((await download).suggestedFilename()).toBe("overworld.zip");
});

test("the asset menu exports the right-clicked asset", async({ page }) => {
  await openShell(page);
  await treeRow(page, MAP).click({ button: "right" });

  const menu = assetMenu(page);
  await expect(menu.getByRole("menuitem", { name: "Open" })).toBeFocused();
  const download = page.waitForEvent("download");
  await menu.getByRole("menuitem", { name: "Export as ZIP" }).click();

  expect((await download).suggestedFilename()).toBe("overworld.zip");
  await expect(menu).toBeHidden();
});

test("the menu below the rows adds a folder at the root", async({ page }) => {
  await openShell(page);
  await treeRow(page, MODEL).click();
  const tree = await boxOf(page.locator("asset-browser jolly-tree"));
  await page.mouse.click(
    tree.x + (tree.width / 2),
    tree.y + tree.height - 10,
    { button: "right" }
  );

  const menu = assetMenu(page);
  await expect(menu.getByRole("menuitem")).toHaveText([
    "New folder",
    "New asset"
  ]);
  await menu.getByRole("menuitem", { name: "New asset" }).hover();
  await expect(page.getByRole("menu", { name: "New asset" }).getByRole("menuitem")).toHaveText([
    "Pixel art",
    "Tileset",
    "Voxel map",
    "Voxel model"
  ]);
  await menu.getByRole("menuitem", { name: "New folder" }).click();
  await renameTo(page, "world");

  await treeRow(page, "models").getByRole("button", { name: "Collapse" }).click();
  await expect(treeRow(page, MODEL)).toBeHidden();
  await expect(treeRow(page, "world")).toBeVisible();
});
