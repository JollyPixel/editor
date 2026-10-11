// Import Third-party Dependencies
import type {
  Download,
  Page
} from "@playwright/test";
import {
  CommandConsole,
  dialog
} from "@jolly-pixel/e2e";
import { waitForEditor } from "@jolly-pixel/e2e/editor";

export async function exportArchive(
  page: Page
): Promise<Download> {
  const downloading = page.waitForEvent("download");
  await new CommandConsole(page).submit("/archive.export");

  return downloading;
}

export async function importArchive(
  page: Page,
  path: string
): Promise<void> {
  const choosing = page.waitForEvent("filechooser");
  await new CommandConsole(page).submit("/archive.import");
  const chooser = await choosing;
  await chooser.setFiles(path);
}

export async function resetWorkspace(
  page: Page
): Promise<void> {
  await new CommandConsole(page).submit("/archive.reset");
  await dialog(page, "Reset workspace")
    .getByRole("button", { name: "Reset" })
    .click();
  await page.waitForEvent("load");
  await waitForEditor(page);
}
