// Import Third-party Dependencies
import {
  expect,
  test,
  type Page
} from "@playwright/test";
import {
  dialog,
  treeRow
} from "@jolly-pixel/e2e";
import {
  openEditor,
  waitForEditor
} from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { addNode } from "./support/hierarchy.ts";
import { outline } from "./support/scene.ts";

interface OfflineIds {
  modelId: string;
  textureId: string | undefined;
}

function offlineIds(
  page: Page
): Promise<OfflineIds> {
  return page.evaluate(() => {
    const { session } = window.voxelModelEditor!;
    const modelId = session.target.record.id;

    return {
      modelId,
      textureId: session.catalog.dependencies
        .dependenciesOf(modelId)
        .find((dependency) => dependency.kind === "pixelart")?.id
    };
  });
}

async function openFileFolder(
  page: Page
): Promise<void> {
  const toggle = page
    .locator("jolly-model-editor-right-panel jolly-folder[key=\"file\"]")
    .getByRole("button", { name: "File" });
  if (await toggle.getAttribute("aria-expanded") === "false") {
    await toggle.click();
  }
}

async function exportArchive(
  page: Page
): Promise<string> {
  await openFileFolder(page);
  const downloading = page.waitForEvent("download");
  await page
    .locator("jolly-archive-actions #export-archive")
    .getByRole("button")
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("model.zip");

  return download.path();
}

function importArchive(
  page: Page,
  archivePath: string
): Promise<void> {
  return page
    .locator("jolly-archive-actions input[type=file]")
    .setInputFiles(archivePath);
}

test("exports the model, resets the workspace and imports it back", async({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openEditor(page, {
    maxFps: 5,
    query: {
      offline: ""
    }
  });
  await addNode(page, "Block", "Arm");
  const exported = await offlineIds(page);
  const archivePath = await exportArchive(page);

  await page
    .locator("jolly-archive-actions #reset-workspace")
    .getByRole("button")
    .click();
  await dialog(page, "Reset workspace")
    .getByRole("button", { name: "Reset" })
    .click();
  await page.waitForEvent("load");
  await waitForEditor(page);
  expect((await offlineIds(page)).modelId).not.toBe(exported.modelId);

  await importArchive(page, archivePath);
  await page.waitForURL(new RegExp(`target=${exported.modelId}`));
  await waitForEditor(page);

  expect(await offlineIds(page)).toEqual(exported);
  expect(await outline(page)).toEqual(["Block", "Arm"]);
  await expect(
    page.getByRole("img").filter({ hasText: "(Arm)front" })
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("imports a model and its texture as a copy", async({ page }) => {
  test.setTimeout(90_000);
  await openEditor(page, {
    maxFps: 5,
    query: {
      offline: ""
    }
  });
  await addNode(page, "Block", "Arm");
  const original = await offlineIds(page);
  const archivePath = await exportArchive(page);

  await importArchive(page, archivePath);
  await dialog(page, "Import archive")
    .getByRole("button", { name: "Import as copy" })
    .click();
  await page.waitForURL((url) => {
    const target = url.searchParams.get("target");

    return target !== null && target !== original.modelId;
  });
  await waitForEditor(page);

  const copied = await offlineIds(page);
  expect(copied.modelId).not.toBe(original.modelId);
  expect(copied.textureId).toBeDefined();
  expect(copied.textureId).not.toBe(original.textureId);
  await expect(treeRow(page, "Arm")).toBeVisible();
  await expect(
    page.getByRole("img").filter({ hasText: "(Arm)front" })
  ).toBeVisible();
});

test("reports a file that is not an archive", async({ page }) => {
  await openEditor(page, {
    maxFps: 5,
    query: {
      offline: ""
    }
  });
  await openFileFolder(page);

  await importArchive(page, "package.json");

  await expect(
    page.locator("jolly-archive-actions").getByRole("alert")
  ).toBeVisible();
});
