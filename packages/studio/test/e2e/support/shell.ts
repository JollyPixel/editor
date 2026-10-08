// Import Third-party Dependencies
import {
  expect,
  type FrameLocator,
  type Locator,
  type Page
} from "@playwright/test";
import { treeRow } from "@jolly-pixel/e2e";

// CONSTANTS
export const MAP = "overworld.voxelmap.json";
export const MODEL = "model.voxelmodel.json";
export const TEXTURE = "model.pixelart";
export const MAP_TAB = "overworld";
export const MODEL_TAB = "model";
export const SEED_ROW_COUNT = 6;
export const SEED_FOLDERS = ["maps", "models"];
export const EXPANDED_STORAGE_KEY = "studio:asset-expanded";
const kEditorBootTimeout = 30_000;

export interface OpenShellOptions {
  collapsed?: boolean;
}

export function assetRows(
  page: Page
): Locator {
  return page.locator("asset-browser jolly-tree").getByRole("treeitem");
}

export async function expandSeedFolders(
  page: Page
): Promise<void> {
  await page.addInitScript(({ key, nodeIds }) => {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, JSON.stringify(nodeIds));
    }
  }, {
    key: EXPANDED_STORAGE_KEY,
    nodeIds: SEED_FOLDERS.map((folder) => `folder:${folder}`)
  });
}

export async function openShell(
  page: Page,
  options: OpenShellOptions = {}
): Promise<void> {
  const { collapsed = false } = options;
  if (!collapsed) {
    await expandSeedFolders(page);
  }
  await page.goto("/?offline");
  await expect(assetRows(page)).toHaveCount(
    collapsed ? SEED_FOLDERS.length : SEED_ROW_COUNT
  );
}

export function editorTab(
  page: Page,
  name: string
): Locator {
  return page.locator("#editor-tabs").getByRole("tab", { name });
}

export function homeTab(
  page: Page
): Locator {
  return editorTab(page, "Home");
}

export function tabNames(
  page: Page
): Promise<string[]> {
  return page.locator("#editor-tabs").getByRole("tab").evaluateAll(
    (tabs) => tabs.map(
      (tab) => tab.getAttribute("aria-label") ?? tab.textContent?.trim() ?? ""
    )
  );
}

export function closeTabButton(
  page: Page,
  name: string
): Locator {
  return page.locator("#editor-tabs").getByRole("button", { name: `Close ${name}` });
}

export function editorFrames(
  page: Page
): Locator {
  return page.locator("#editor-frames iframe");
}

export async function openFromHome(
  page: Page,
  name: string
): Promise<void> {
  await homeTab(page).click();
  await treeRow(page, name).dblclick();
}

export async function expectEditorReady(
  editor: FrameLocator
): Promise<void> {
  await expect(editor.locator("html"))
    .toHaveAttribute("data-editor-state", "ready", { timeout: kEditorBootTimeout });
}

export function assetAction(
  page: Page,
  name: string
): Locator {
  return page.locator("asset-browser").getByRole("button", { name });
}

export function assetMenu(
  page: Page
): Locator {
  return page.getByRole("menu", { name: "Asset actions" });
}

export function renameField(
  page: Page
): Locator {
  return page.locator("asset-browser").getByRole("textbox", { name: "Rename" });
}

export async function renameTo(
  page: Page,
  name: string
): Promise<void> {
  await renameField(page).fill(name);
  await renameField(page).press("Enter");
}
