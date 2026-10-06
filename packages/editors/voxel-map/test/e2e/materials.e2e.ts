// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  selectField,
  textField
} from "@jolly-pixel/e2e";

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

function materialSquare(
  scope: Locator,
  blockId: number
): Locator {
  return scope.locator(`block-library-viewport .material[data-block-id="${blockId}"] .swatch`);
}

function finishOf(
  page: Page,
  groupId: string
): Promise<{ roughness: number; } | null> {
  return page.evaluate((id) => {
    const group = window.voxelMapEditor!.workspace.mapDocument.materialGroups.get(id);

    return group === undefined ? null : { roughness: group.roughness };
  }, groupId);
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

test("a material made in the Materials pane is shared, marked and edited live", async({ page }) => {
  await openPane(page, "Materials");
  const pane = materialsPane(page);
  const library = pane.getByRole("listbox", { name: "Blocks" });
  const [first, second] = await page.evaluate(() => [
    ...window.voxelMapEditor!.workspace.mapDocument.blocks.getAll()
  ].slice(0, 2).map((block) => {
    return { id: block.id, name: block.name };
  }));

  await library.getByRole("option", { name: first.name, exact: true }).click();
  await pane.getByRole("button", { name: "New material" }).click();
  const groupId = `${DEFAULT_BLOCKSET_ID}/Material`;
  await expect.poll(() => materialOf(page, first.id)).toBe(groupId);

  await textField(pane, "Name").fill("Gold");
  await textField(pane, "Name").press("Enter");
  const goldId = `${DEFAULT_BLOCKSET_ID}/Gold`;
  await expect.poll(() => materialOf(page, first.id)).toBe(goldId);

  await library.getByRole("option", { name: second.name, exact: true }).click();
  await selectField(pane, "Material").selectOption({ label: "Gold" });
  await expect.poll(() => materialOf(page, second.id)).toBe(goldId);

  const firstSquare = materialSquare(pane, first.id);
  await expect(firstSquare).toBeVisible();
  await expect(materialSquare(pane, second.id))
    .toHaveAttribute("style", (await firstSquare.getAttribute("style"))!);

  const roughness = pane.getByRole("textbox", { name: "Roughness value" });
  await roughness.fill("0");
  await roughness.press("Enter");
  await expect.poll(async() => (await finishOf(page, goldId))?.roughness).toBe(0);

  await openPane(page, "Blocks");
  await expect(materialSquare(page.locator("blocks-panel"), first.id)).toBeVisible();
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
