// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  BLOCKSET,
  MAP,
  MODEL,
  SEED_ROW_COUNT,
  TEXTURE
} from "./support/assets.ts";

test("filters the asset tree by kind", async({ studio }) => {
  const { assets } = studio;
  await studio.openOffline();

  await assets.filterBy("Voxel map");
  await expect(assets.rows).toHaveCount(4);
  await expect(assets.row(MAP)).toBeVisible();
  await expect(assets.row(BLOCKSET)).toBeVisible();
  await expect(assets.row("models")).toBeVisible();

  await assets.filterBy("All kinds");
  await expect(assets.rows).toHaveCount(SEED_ROW_COUNT);
});

test("starts collapsed and remembers the expanded folders after a reload", async({ studio, page }) => {
  const { assets } = studio;
  await studio.openOffline({ collapsed: true });
  await assets.expand("maps");
  await expect(assets.row(MAP)).toBeVisible();

  await page.reload();
  await expect(assets.row(MAP)).toBeVisible();
  await expect(assets.row(MODEL)).toHaveCount(0);
});

test("moves several selected rows into a new folder", async({ studio }) => {
  const { assets } = studio;
  await studio.openOffline();
  await assets.createFolder("world");

  await assets.select("maps", "models");
  await assets.move("maps", "world");

  await expect(assets.rows).toHaveCount(1);
  await assets.expand("world");
  await expect(assets.row("maps")).toBeVisible();
  await expect(assets.row("models")).toBeVisible();
});

test("a folder emptied by a move stays in the tree", async({ studio }) => {
  const { assets } = studio;
  await studio.openOffline();

  await assets.move(MODEL, "maps");

  await expect(assets.row("models")).toBeVisible();
  await expect(assets.rows).toHaveCount(SEED_ROW_COUNT);
  await expect(assets.row(TEXTURE)).toBeVisible();
});

test("deleting an asset can keep its companion", async({ studio }) => {
  const { assets } = studio;
  const { deleteDialog } = assets;
  await studio.openOffline();
  await assets.select(MAP);
  await assets.action("Delete").click();

  await expect(deleteDialog.companionNotice).toBeVisible();
  await expect(deleteDialog.companions).toBeChecked();
  await deleteDialog.companions.click();
  await deleteDialog.deleteButton.click();

  await expect(assets.row(MAP)).toHaveCount(0);
  await expect(assets.row(BLOCKSET)).toBeVisible();
});

test("exports the selected asset as a ZIP archive", async({ studio }) => {
  const { assets } = studio;
  await studio.openOffline();
  await expect(assets.action("Export")).toBeDisabled();

  await assets.select(MAP);
  const download = await assets.exportSelection();

  expect(download.suggestedFilename()).toBe("overworld.zip");
});

test("the asset menu exports the right-clicked asset", async({ studio, page }) => {
  const { assets } = studio;
  const { menu } = assets;
  await studio.openOffline();
  await assets.openMenu(MAP);

  await expect(menu.item("Open")).toBeFocused();
  const download = page.waitForEvent("download");
  await menu.item("Export as ZIP").click();

  expect((await download).suggestedFilename()).toBe("overworld.zip");
  await expect(menu.root).toBeHidden();
});

test("the menu below the rows adds a folder at the root", async({ studio }) => {
  const { assets } = studio;
  await studio.openOffline();
  await assets.select(MODEL);

  await assets.openMenuBelowRows();
  await assets.menu.item("New folder").click();
  await assets.rename("world");

  await assets.collapse("models");
  await expect(assets.row(MODEL)).toBeHidden();
  await expect(assets.row("world")).toBeVisible();
});
