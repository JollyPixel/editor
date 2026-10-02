// Import Third-party Dependencies
import { expect, test } from "@playwright/test";
import {
  boxOf,
  dragTo,
  treeRow
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  closeTabButton,
  editorFrames,
  editorTab,
  homeTab,
  MAP,
  MAP_TAB,
  MODEL,
  MODEL_TAB,
  openFromHome,
  openShell,
  tabNames
} from "./support/shell.ts";

test("starts on home and reorders editor tabs behind it", async({ page }) => {
  await openShell(page);
  const home = homeTab(page);
  await expect(home).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#studio-home")).toBeVisible();

  await treeRow(page, MAP).dblclick();
  await openFromHome(page, MODEL);
  await expect(editorFrames(page)).toHaveCount(2);
  await expect(page.locator("#studio-home")).toBeHidden();
  await expect.poll(() => tabNames(page)).toEqual(["Home", MAP_TAB, MODEL_TAB]);

  const homeBox = await boxOf(home);
  await dragTo(page, editorTab(page, MODEL_TAB), {
    x: homeBox.x + (homeBox.width * 0.75),
    y: homeBox.y + (homeBox.height / 2)
  });
  await expect.poll(() => tabNames(page)).toEqual(["Home", MODEL_TAB, MAP_TAB]);

  for (const name of [MODEL_TAB, MAP_TAB]) {
    await closeTabButton(page, name).click();
  }
  await expect(home).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#studio-home")).toBeVisible();
});

test("reopens the tabs after a reload and loads only the active one", async({ page }) => {
  await openShell(page);
  await treeRow(page, MAP).dblclick();
  await openFromHome(page, MODEL);
  const map = editorTab(page, MAP_TAB);
  await map.click();
  await expect(map).toHaveAttribute("aria-selected", "true");

  await page.reload();

  await expect.poll(() => tabNames(page)).toEqual(["Home", MAP_TAB, MODEL_TAB]);
  await expect(map).toHaveAttribute("aria-selected", "true");
  await expect(editorFrames(page)).toHaveCount(1);

  await editorTab(page, MODEL_TAB).click();
  await expect(editorFrames(page)).toHaveCount(2);
});

test("an editor takes the full width and home lists it among open editors", async({ page }) => {
  await openShell(page);
  const overview = page.locator("project-overview");
  await expect(overview.locator(".total")).toHaveText("4");

  await treeRow(page, MAP).dblclick();
  await expect(page.locator("asset-browser")).toBeHidden();
  const [frame, workbench] = await Promise.all([
    boxOf(editorFrames(page)),
    boxOf(page.locator("#workbench"))
  ]);
  expect(frame.x).toBe(workbench.x);
  expect(frame.width).toBe(workbench.width);

  await homeTab(page).click();
  await expect(page.locator("asset-browser")).toBeVisible();
  const openEditor = overview.locator("jolly-button", { hasText: MAP_TAB });
  await expect(openEditor).toHaveAttribute("title", `maps/${MAP}`);
  await openEditor.click();
  await expect(editorTab(page, MAP_TAB)).toHaveAttribute("aria-selected", "true");
});
