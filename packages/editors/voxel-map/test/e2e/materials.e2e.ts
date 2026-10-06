// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import { openPane } from "./support/panels.ts";
import { DEFAULT_BLOCKSET_ID } from "../../src/boot/defaultSeed.ts";

function materialsPane(
  page: Page
): Locator {
  return page.locator("materials-panel");
}

function selectedMaterial(
  pane: Locator
): Locator {
  return pane.getByRole("treeitem", { selected: true }).locator(".label");
}

function materialSquare(
  scope: Locator,
  blockId: number
): Locator {
  return scope.locator(`block-library-viewport .material[data-block-id="${blockId}"] .swatch`);
}

function finishOf(
  page: Page,
  groupId: string
): Promise<{ roughness: number; swatch: string | null; } | null> {
  return page.evaluate((id) => {
    const group = window.voxelMapEditor!.workspace.mapDocument.materialGroups.get(id);

    return group === undefined ?
      null :
      {
        roughness: group.roughness,
        swatch: group.swatch
      };
  }, groupId);
}

function blocksOf(
  page: Page
): Promise<{ id: number; name: string; }[]> {
  return page.evaluate(() => [
    ...window.voxelMapEditor!.workspace.mapDocument.blocks.getAll()
  ].slice(0, 2).map((block) => {
    return { id: block.id, name: block.name };
  }));
}

function materialOf(
  page: Page,
  blockId: number
): Promise<string | undefined> {
  return page.evaluate(
    (id) => window.voxelMapEditor!.workspace.mapDocument.blocks.get(id)?.materialGroup,
    blockId
  );
}

test("a material made in the Materials pane is renamed, applied, recoloured and edited", async({ page }) => {
  await openPane(page, "Materials");
  const pane = materialsPane(page);
  const library = pane.getByRole("listbox", { name: "Blocks" });
  const [first, second] = await blocksOf(page);

  await library.getByRole("option", { name: first.name, exact: true }).click();
  await pane.getByRole("button", { name: "New material" }).click();
  const rename = pane.getByRole("tree").getByRole("textbox");
  await rename.fill("Gold");
  await rename.press("Enter");
  const goldId = `${DEFAULT_BLOCKSET_ID}/Gold`;
  await expect.poll(() => finishOf(page, goldId)).not.toBeNull();
  expect(await materialOf(page, first.id)).toBeUndefined();

  await pane.getByRole("button", { name: "Apply to selected block" }).click();
  await expect.poll(() => materialOf(page, first.id)).toBe(goldId);

  await library.getByRole("option", { name: second.name, exact: true }).click();
  await expect(selectedMaterial(pane)).toHaveText("Gold");
  await pane.getByRole("button", { name: "Apply to selected block" }).click();
  await expect.poll(() => materialOf(page, second.id)).toBe(goldId);

  const firstSquare = materialSquare(pane, first.id);
  await expect(firstSquare).toBeVisible();
  await expect(materialSquare(pane, second.id))
    .toHaveAttribute("style", (await firstSquare.getAttribute("style"))!);

  const color = pane.locator("jolly-color").filter({ hasText: "Color" }).locator("input.hex");
  await color.fill("#ff0000");
  await color.press("Enter");
  await expect.poll(async() => (await finishOf(page, goldId))?.swatch).toBe("#ff0000");
  await expect(firstSquare).toHaveAttribute("style", /background:#ff0000/);

  const roughness = pane.getByRole("textbox", { name: "Roughness value" });
  await roughness.fill("0");
  await roughness.press("Enter");
  await expect.poll(async() => (await finishOf(page, goldId))?.roughness).toBe(0);

  await openPane(page, "Blocks");
  await expect(materialSquare(page.locator("blocks-panel"), first.id)).toBeVisible();
});

test("the material fields follow the block picked in the library", async({ page }) => {
  await openPane(page, "Materials");
  const pane = materialsPane(page);
  const library = pane.getByRole("listbox", { name: "Blocks" });
  const [first, second] = await blocksOf(page);
  await page.evaluate(([firstId, secondId]) => {
    const { blocksets, mapDocument } = window.voxelMapEditor!.workspace;
    for (const [blockId, name] of [[firstId, "Gold"], [secondId, "Silver"]] as const) {
      const block = mapDocument.blocks.get(blockId)!;
      const groupId = blocksets.ownerOf(blockId)!.slot.groupId(name);
      blocksets.defineBlock({ ...block, materialGroup: groupId });
    }
  }, [first.id, second.id]);

  await library.getByRole("option", { name: first.name, exact: true }).click();
  await expect(selectedMaterial(pane)).toHaveText("Gold");
  await library.getByRole("option", { name: second.name, exact: true }).click();
  await expect(selectedMaterial(pane)).toHaveText("Silver");
  await expect(pane.getByRole("button", { name: "Remove from selected block" })).toBeVisible();
});

test("the Materials tab is disabled while the map has no blocks", async({ page }) => {
  const tab = page.getByRole("tab", { name: "Materials", exact: true });
  await expect(tab).toBeEnabled();

  await page.evaluate(() => {
    const { workspace } = window.voxelMapEditor!;
    for (const block of [...workspace.mapDocument.blocks.getAll()]) {
      workspace.blocksets.removeBlock(block.id);
    }
  });

  await expect(tab).toBeDisabled();
});
