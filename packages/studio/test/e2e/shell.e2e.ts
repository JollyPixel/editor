// Import Third-party Dependencies
import {
  expect,
  test,
  type Page
} from "@playwright/test";
import {
  boxOf,
  centerOf,
  dragTo,
  treeRow
} from "@jolly-pixel/e2e";

// CONSTANTS
const kMap = "overworld.voxelmap.json";
const kModel = "model.voxelmodel.json";
const kTexture = "model.pixelart";

async function openShell(
  page: Page
): Promise<void> {
  await page.goto("/?offline&username=Guest");
  await expect(page.locator("asset-browser jolly-tree").getByRole("treeitem"))
    .toHaveCount(4);
}

function tabNames(
  page: Page
): Promise<string[]> {
  return page.locator("#editor-tabs").getByRole("tab").evaluateAll(
    (tabs) => tabs.map(
      (tab) => tab.getAttribute("aria-label") ?? tab.textContent?.trim() ?? ""
    )
  );
}

test("starts on home and reorders editor tabs behind it", async({ page }) => {
  await openShell(page);
  const home = page.locator("#editor-tabs").getByRole("tab", { name: "Home" });
  await expect(home).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#studio-home")).toBeVisible();

  await treeRow(page, kMap).dblclick();
  await treeRow(page, kModel).dblclick();
  await expect(page.locator("#editor-frames iframe")).toHaveCount(2);
  await expect(page.locator("#studio-home")).toBeHidden();
  await expect.poll(() => tabNames(page)).toEqual(["Home", kMap, kModel]);

  const model = page.locator("#editor-tabs").getByRole("tab", { name: kModel });
  const homeBox = await boxOf(home);
  await dragTo(page, model, {
    x: homeBox.x + (homeBox.width * 0.75),
    y: homeBox.y + (homeBox.height / 2)
  });
  await expect.poll(() => tabNames(page)).toEqual(["Home", kModel, kMap]);

  for (const name of [kModel, kMap]) {
    await page.locator("#editor-tabs")
      .getByRole("button", { name: `Close ${name}` })
      .click();
  }
  await expect(home).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#studio-home")).toBeVisible();
});

test("reopens the tabs in their order after a reload", async({ page }) => {
  await openShell(page);
  await treeRow(page, kMap).dblclick();
  await treeRow(page, kModel).dblclick();
  const home = page.locator("#editor-tabs").getByRole("tab", { name: "Home" });
  const model = page.locator("#editor-tabs").getByRole("tab", { name: kModel });
  const homeBox = await boxOf(home);
  await dragTo(page, model, {
    x: homeBox.x + (homeBox.width * 0.75),
    y: homeBox.y + (homeBox.height / 2)
  });
  await expect.poll(() => tabNames(page)).toEqual(["Home", kModel, kMap]);
  await model.click();
  await expect(model).toHaveAttribute("aria-selected", "true");

  await page.reload();

  await expect.poll(() => tabNames(page)).toEqual(["Home", kModel, kMap]);
  await expect(model).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#editor-frames iframe")).toHaveCount(1);

  await page.locator("#editor-tabs").getByRole("tab", { name: kMap }).click();
  await expect(page.locator("#editor-frames iframe")).toHaveCount(2);
});

test("opens a pixel-art texture in the pixel-art editor page", async({ page }) => {
  await openShell(page);
  await treeRow(page, kModel).getByRole("button", { name: "Expand" }).click();
  await treeRow(page, kTexture).dblclick();

  const frame = page.locator("#editor-frames iframe");
  await expect(frame).toHaveAttribute(
    "src",
    /^editors\/pixel-art\/\?.*target=model-texture/
  );
  const editor = frame.contentFrame();
  await expect(editor.locator("html"))
    .toHaveAttribute("data-editor-state", "ready");
  await expect(editor.locator("pixel-draw-panel")).toBeVisible();
});

test("filters the asset tree by kind", async({ page }) => {
  await openShell(page);
  const kinds = page.locator("asset-browser jolly-button-group");

  await kinds.getByRole("radio", { name: "Voxel map" }).click();
  await expect(page.locator("asset-browser jolly-tree").getByRole("treeitem"))
    .toHaveCount(2);
  await expect(treeRow(page, kMap)).toBeVisible();

  await kinds.getByRole("radio", { name: "All kinds" }).click();
  await expect(page.locator("asset-browser jolly-tree").getByRole("treeitem"))
    .toHaveCount(4);
});

test("moves several selected rows into a new folder", async({ page }) => {
  await openShell(page);
  await page.locator("asset-browser")
    .getByRole("button", { name: "New folder" })
    .click();
  const rename = page.locator("asset-browser").getByRole("textbox", { name: "Rename" });
  await rename.fill("world");
  await rename.press("Enter");

  await treeRow(page, "maps").click();
  await treeRow(page, "models").click({ modifiers: ["ControlOrMeta"] });
  await dragTo(page, treeRow(page, "maps"), await centerOf(treeRow(page, "world")));

  await expect(page.locator("asset-browser jolly-tree").getByRole("treeitem"))
    .toHaveCount(1);
  await treeRow(page, "world").getByRole("button", { name: "Expand" }).click();
  await expect(treeRow(page, "maps")).toBeVisible();
  await expect(treeRow(page, "models")).toBeVisible();
});

test("deleting an asset can keep its companion", async({ page }) => {
  await openShell(page);
  await treeRow(page, kMap).click();
  await page.locator("asset-browser")
    .getByRole("button", { name: "Delete" })
    .click();

  const dialog = page.locator("asset-delete-dialog");
  await expect(dialog.getByText("Also delete its companion")).toBeVisible();
  const companions = dialog.getByRole("checkbox");
  await expect(companions).toBeChecked();
  await companions.click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(treeRow(page, kMap)).toHaveCount(0);
  await expect(treeRow(page, "overworld.tileset.json")).toBeVisible();
});

test("exports the selected asset as a ZIP archive", async({ page }) => {
  await openShell(page);
  const exportButton = page.locator("asset-browser")
    .getByRole("button", { name: "Export" });
  await expect(exportButton).toBeDisabled();

  await treeRow(page, kMap).click();
  const download = page.waitForEvent("download");
  await exportButton.click();

  expect((await download).suggestedFilename()).toBe("overworld.zip");
});

test("the asset menu exports the right-clicked asset", async({ page }) => {
  await openShell(page);
  await treeRow(page, kMap).click({ button: "right" });

  const menu = page.getByRole("menu", { name: "Asset actions" });
  await expect(menu.getByRole("menuitem", { name: "Open" })).toBeFocused();
  const download = page.waitForEvent("download");
  await menu.getByRole("menuitem", { name: "Export as ZIP" }).click();

  expect((await download).suggestedFilename()).toBe("overworld.zip");
  await expect(menu).toBeHidden();
});

test("the menu below the rows adds a folder at the root", async({ page }) => {
  await openShell(page);
  await treeRow(page, kModel).click();
  const tree = await boxOf(page.locator("asset-browser jolly-tree"));
  await page.mouse.click(
    tree.x + (tree.width / 2),
    tree.y + tree.height - 10,
    { button: "right" }
  );

  const menu = page.getByRole("menu", { name: "Asset actions" });
  await expect(menu.getByRole("menuitem")).toHaveText([
    "New folder",
    "New pixel art",
    "New tileset",
    "New voxel map",
    "New voxel model"
  ]);
  await menu.getByRole("menuitem", { name: "New folder" }).click();
  const rename = page.locator("asset-browser").getByRole("textbox", { name: "Rename" });
  await rename.fill("world");
  await rename.press("Enter");

  await treeRow(page, "models").getByRole("button", { name: "Collapse" }).click();
  await expect(treeRow(page, kModel)).toBeHidden();
  await expect(treeRow(page, "world")).toBeVisible();
});

test("creates a map, a model and a texture from the tree and opens each", async({ page }) => {
  test.slow();
  await openShell(page);
  const browser = page.locator("asset-browser");
  const menu = page.getByRole("menu", { name: "Asset actions" });
  const assets = [
    {
      kind: "New voxel map",
      file: "New voxel map.voxelmap.json",
      companion: "New voxel map.tileset.json",
      editor: "voxel-map"
    },
    {
      kind: "New voxel model",
      file: "New voxel model.voxelmodel.json",
      companion: "New voxel model.pixelart",
      editor: "voxel-model"
    },
    {
      kind: "New pixel art",
      file: "New pixel art.pixelart",
      companion: null,
      editor: "pixel-art"
    }
  ];

  for (const asset of assets) {
    await browser.getByRole("button", { name: "New asset" }).click();
    await menu.getByRole("menuitem", { name: asset.kind }).click();
    const rename = browser.getByRole("textbox", { name: "Rename" });
    await expect(rename).toHaveValue(asset.file);
    await rename.press("Escape");

    if (asset.companion !== null) {
      await treeRow(page, asset.file).getByRole("button", { name: "Expand" }).click();
      await expect(treeRow(page, asset.companion)).toBeVisible();
    }

    await treeRow(page, asset.file).dblclick();
    const frame = page.locator(`#editor-frames iframe[src^="editors/${asset.editor}/"]`);
    await expect(frame.contentFrame().locator("html"))
      .toHaveAttribute("data-editor-state", "ready", { timeout: 30_000 });
  }
});

test("a collapsed asset dock keeps its handle beside the workbench", async({ page }) => {
  await openShell(page);
  const dock = page.locator("#asset-dock");
  const handle = dock.locator(".resize-handle");

  await handle.dblclick();
  await expect(dock).toHaveAttribute("collapsed");

  const [handleBox, workbench] = await Promise.all([
    boxOf(handle),
    boxOf(page.locator("#workbench"))
  ]);
  expect(handleBox.width).toBeGreaterThan(0);
  expect(handleBox.x + handleBox.width).toBeLessThanOrEqual(workbench.x);

  await handle.dblclick();
  await expect(dock).not.toHaveAttribute("collapsed");
});
