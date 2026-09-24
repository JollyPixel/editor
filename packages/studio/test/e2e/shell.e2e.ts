// Import Third-party Dependencies
import {
  expect,
  test,
  type Page
} from "@playwright/test";
import {
  boxOf,
  dragTo,
  treeRow
} from "@jolly-pixel/e2e";

// CONSTANTS
const kMap = "overworld.voxelmap.json";
const kModel = "model.voxelmodel.json";

async function openShell(
  page: Page
): Promise<void> {
  await page.goto("/?offline&username=Guest");
  await expect(page.locator("asset-browser jolly-tree").getByRole("treeitem"))
    .toHaveCount(7);
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

test("filters the asset tree by kind", async({ page }) => {
  await openShell(page);
  const kinds = page.locator("asset-browser jolly-button-group");

  await kinds.getByRole("radio", { name: "Voxel map" }).click();
  await expect(page.locator("asset-browser jolly-tree").getByRole("treeitem"))
    .toHaveCount(2);
  await expect(treeRow(page, kMap)).toBeVisible();

  await kinds.getByRole("radio", { name: "All kinds" }).click();
  await expect(page.locator("asset-browser jolly-tree").getByRole("treeitem"))
    .toHaveCount(7);
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
