// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import { dialog, treeRow } from "@jolly-pixel/e2e";
import { waitForEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import { addNode, hierarchyAction } from "./support/hierarchy.ts";

function regionToolbar(
  page: Page
): Locator {
  return page.getByRole("button", { name: /^Region state/ });
}

function sizeField(
  page: Page,
  axis: "Width" | "Height"
): Locator {
  return page.getByTitle(axis).getByRole("combobox");
}

test("a texture resized from the Build tab keeps its size after a reload", async({ page }) => {
  await expect(sizeField(page, "Width").locator("option:checked")).toHaveText("64");

  await sizeField(page, "Width").selectOption({ label: "128" });
  await sizeField(page, "Height").selectOption({ label: "32" });

  await page.reload();
  await waitForEditor(page);

  await expect(sizeField(page, "Width").locator("option:checked")).toHaveText("128");
  await expect(sizeField(page, "Height").locator("option:checked")).toHaveText("32");
});

test("the Paint tab swaps the region tools for the drawing tools", async({ page }) => {
  const uvTool = page.getByRole("button", { name: "UV", exact: true });
  const paintTool = page.getByRole("button", { name: "Paint", exact: true });
  await expect(uvTool).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("tab", { name: "Paint" }).click();

  await expect(paintTool).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTitle("Width")).toBeHidden();
});

async function switchRegionState(
  page: Page,
  state: "Stacked" | "Unfolded" | "Free"
): Promise<void> {
  await regionToolbar(page).click();
  await page.getByRole("menuitem", { name: state }).click();
  await expect(regionToolbar(page)).toHaveAccessibleName(`Region state: ${state}`);
}

function storedUvState(
  page: Page,
  name: string
): Promise<string | undefined> {
  return page.evaluate((blockName) => {
    const { document } = window.voxelModelEditor!.workspace;
    const block = [...document.tree.blocks()]
      .find((candidate) => candidate.name === blockName);

    return block?.uv?.state;
  }, name);
}

test("a region state change is stored on the block and reaches a peer", async({ page, peer }) => {
  test.slow();
  await treeRow(page, "Block").click();
  await expect(regionToolbar(page)).toHaveAccessibleName("Region state: Unfolded");

  await switchRegionState(page, "Stacked");
  expect(await storedUvState(page, "Block")).toBe("stacked");

  await treeRow(peer, "Block").click();
  await expect(regionToolbar(peer)).toHaveAccessibleName("Region state: Stacked");

  await page.reload();
  await waitForEditor(page);
  await treeRow(page, "Block").click();
  await expect(regionToolbar(page)).toHaveAccessibleName("Region state: Stacked");
});

test("selecting a block selects its texture region", async({ page }) => {
  await expect(regionToolbar(page)).toBeHidden();

  await treeRow(page, "Block").click();
  await expect(regionToolbar(page)).toBeVisible();

  await addNode(page, "Block", "Arm", { asChild: false });
  await hierarchyAction(page, "Delete").click();
  await dialog(page, "Delete Block")
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(page.getByRole("img").filter({ hasText: "(Arm)front" })).toHaveCount(0);
  await expect(regionToolbar(page)).toBeHidden();
});
