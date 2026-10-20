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
import { followEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  exportArchive,
  importArchive,
  resetWorkspace
} from "../support/archives.ts";
import { addNode } from "../support/hierarchy.ts";
import { openOfflineEditor } from "../support/offline.ts";
import { outline } from "../support/scene.ts";

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
        .listDependencies(modelId)
        .find((dependency) => dependency.kind === "pixelart")?.id
    };
  });
}

test("exports the model, resets the workspace and imports it back", async({ page }) => {
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openOfflineEditor(page);
  await addNode(page, "Block", "Arm");
  const exported = await offlineIds(page);
  const download = await exportArchive(page);
  expect(download.suggestedFilename()).toBe("model.zip");
  const archivePath = await download.path();

  await resetWorkspace(page);
  expect((await offlineIds(page)).modelId).not.toBe(exported.modelId);

  await importArchive(page, archivePath);
  await followEditor(page, new RegExp(`target=${exported.modelId}`));

  expect(await offlineIds(page)).toEqual(exported);
  expect(await outline(page)).toEqual(["Block", "Arm"]);
  await treeRow(page, "Arm").click();
  await expect(
    page.getByRole("img").filter({ hasText: "(Arm)front" })
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("imports a model and its texture as a copy", async({ page }) => {
  test.slow();
  await openOfflineEditor(page);
  await addNode(page, "Block", "Arm");
  const original = await offlineIds(page);
  const download = await exportArchive(page);

  await importArchive(page, await download.path());
  await dialog(page, "Import archive")
    .getByRole("button", { name: "Import as copy" })
    .click();
  await followEditor(page, (url) => {
    const target = url.searchParams.get("target");

    return target !== null && target !== original.modelId;
  });

  const copied = await offlineIds(page);
  expect(copied.modelId).not.toBe(original.modelId);
  expect(copied.textureId).toBeDefined();
  expect(copied.textureId).not.toBe(original.textureId);
  await treeRow(page, "Arm").click();
  await expect(
    page.getByRole("img").filter({ hasText: "(Arm)front" })
  ).toBeVisible();
});
