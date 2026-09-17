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
  textField
} from "./support/panels.ts";
import { seedVoxels } from "./support/scene.ts";

function brushBlock(
  page: Page
): Promise<number> {
  return page.evaluate(
    () => window.voxelMapEditor!.scene.editorState.brush.blockId
  );
}

function blockNames(
  page: Page
): Promise<string[]> {
  return page.evaluate(() => [
    ...window.voxelMapEditor!.scene.engine.blockRegistry.getAll()
  ].map((block) => block.name));
}

test.beforeEach(async({ page }) => {
  await openPane(page, "Blocks");
});

test("clicking a block selects it for the brush", async({ page }) => {
  const [, second] = await blockNames(page);
  const library = page.getByRole("listbox", { name: "Blocks" });
  await expect(library.getByRole("option")).toHaveCount(32);

  await library.getByRole("option", { name: second, exact: true }).click();

  await expect(library.getByRole("option", { name: second, exact: true }))
    .toHaveAttribute("aria-selected", "true");
  expect(await brushBlock(page)).toBe(2);
});

test("the add cell creates a block and selects it", async({ page }) => {
  await page.getByRole("button", { name: "Add block" }).click();
  const editor = dialog(page, "New block");
  await textField(editor, "Name").fill("Lantern");
  await editor.getByRole("button", { name: "Create" }).click();
  await expect(editor).toBeHidden();

  const library = page.getByRole("listbox", { name: "Blocks" });
  await expect(library.getByRole("option", { name: "Lantern" }))
    .toHaveAttribute("aria-selected", "true");
  expect(await brushBlock(page)).toBe(33);
});

test("double-clicking a block edits it in place", async({ page }) => {
  const [first] = await blockNames(page);
  const library = page.getByRole("listbox", { name: "Blocks" });

  await library.getByRole("option", { name: first, exact: true }).dblclick();
  const editor = dialog(page, "Block #1");
  const name = textField(editor, "Name");
  await name.fill("Bedrock");
  await name.press("Tab");
  await editor.getByRole("button", { name: "Close" }).click();

  await expect(library.getByRole("option", { name: "Bedrock" })).toBeVisible();
  expect((await blockNames(page))[0]).toBe("Bedrock");
});

test("deleting a placed block asks first and removes its voxels", async({ page }) => {
  await seedVoxels(page, [
    { x: 0, y: 0, z: 0, blockId: 1 },
    { x: 1, y: 0, z: 0, blockId: 1 }
  ]);
  const [first] = await blockNames(page);

  await page.getByRole("listbox", { name: "Blocks" })
    .getByRole("option", { name: first, exact: true })
    .dblclick();
  await dialog(page, "Block #1").getByRole("button", { name: "Delete" }).click();

  const confirm = dialog(page, `Delete "${first}"?`);
  await expect(confirm).toContainText("2 voxels");
  await confirm.getByRole("button", { name: "Delete" }).click();

  await expect.poll(() => blockNames(page)).not.toContain(first);
});
