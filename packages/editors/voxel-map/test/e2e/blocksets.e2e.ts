// Import Third-party Dependencies
import { textField } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import type { VoxelMapPage } from "./support/voxelMap.ts";

function blocksetSources(
  map: VoxelMapPage
): Promise<string[]> {
  return map.page.evaluate(() => window.voxelMapEditor!.workspace.view.document.blocksets
    .definitions()
    .map((definition) => definition.asset?.id ?? ""));
}

test.beforeEach(async({ map }) => {
  await map.panes.open("Blocks");
});

test("a single blockset keeps its tab, and the add button creates a new one", async({ map, page }) => {
  const { texture } = map;
  const blockset = texture.blocksetTab(/^blockset/);
  await expect(blockset).toHaveAttribute("aria-selected", "true");
  await expect(blockset.locator("[part~=badge]")).toHaveText("32");
  await expect(page.locator("blockset-folder")).toHaveCount(0);

  await texture.addBlankBlockset("stone");

  const stone = texture.blocksetTab(/^stone/);
  await expect(stone).toHaveAttribute("aria-selected", "true");
  await expect(stone.locator("[part~=badge]")).toHaveText("0");
  await expect.poll(async() => (await blocksetSources(map)).length).toBe(2);
});

test("the tab edit button renames the blockset asset", async({ map, target }) => {
  const { texture } = map;
  const editor = await texture.editBlockset("blockset");
  const name = textField(editor, "Name");
  await name.fill("terrain.blockset.json");
  await name.press("Enter");

  await expect(editor).toBeHidden();
  await expect(texture.blocksetTab(/^terrain/)).toBeVisible();
  expect(await blocksetSources(map)).toEqual([target.blocksetId]);

  const renamed = await texture.editBlockset("terrain");
  await expect(textField(renamed, "Name")).toHaveValue("terrain");
});

test("removing a blockset flags the blocks left without texture", async({ map, page }) => {
  const editor = await map.texture.editBlockset("blockset");
  const alert = editor.getByRole("alert");
  await editor.getByRole("button", { name: "Remove" }).click();
  await expect(alert).toContainText("Remove \"blockset\"?");
  await expect(alert).toContainText("The blockset asset is kept.");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await editor.getByRole("button", { name: "Remove" }).click();

  await expect.poll(() => blocksetSources(map)).toEqual([]);
  await expect(editor).toBeHidden();
  await expect(map.texture.addBlocksetButton).toBeVisible();
  await expect.poll(() => page.evaluate(
    () => [...window.voxelMapEditor!.workspace.view.document.blocks].length
  )).toBe(0);
});
