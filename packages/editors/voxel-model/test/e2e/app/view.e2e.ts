// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import { buttonGroup } from "@jolly-pixel/e2e";
import { reloadEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { test, expect } from "../fixtures.ts";
import { openMaterialTab } from "../support/material.ts";
import { pickLighting } from "../support/view.ts";

function blocksLit(
  page: Page
): Promise<boolean> {
  return page.evaluate(() => window.voxelModelEditor!.workspace.blocks.lit);
}

function lighting(
  page: Page
): Promise<string> {
  return page.evaluate(() => window.voxelModelEditor!.workspace.view.settings.lighting);
}

function viewportRender(
  page: Page
): Promise<string[]> {
  return page.evaluate(() => {
    const { renderComponents } = window.voxelModelEditor!.runtime.world.renderer;

    return renderComponents.map((component) => (
      component.postProcessing ? "glow" : "direct"
    ));
  });
}

async function openViewSection(
  page: Page
): Promise<Locator> {
  await openMaterialTab(page);
  await page.getByRole("button", { name: "View", exact: true }).click();

  return page.locator("jolly-model-editor-view");
}

test("the viewport draws the scene once, without the glow pass while nothing glows", async({ page }) => {
  expect(await viewportRender(page)).toEqual(["direct"]);
});

test("the lighting menu switches blocks to flat and is remembered after a reload", async({ page }) => {
  expect(await blocksLit(page)).toBe(true);

  await pickLighting(page, "Flat");
  expect(await blocksLit(page)).toBe(false);

  await reloadEditor(page);

  await expect(page.getByRole("button", { name: "Lighting: Flat" })).toBeVisible();
  expect(await blocksLit(page)).toBe(false);
});

test("a custom background offers a reset back to the lighting's colour", async({ page }) => {
  const view = await openViewSection(page);
  const reset = view.getByRole("button", { name: "Use the lighting's background" });
  await expect(reset).toHaveCount(0);

  await page.evaluate(() => window.voxelModelEditor!.workspace.view.update({ background: "#336699" }));
  await reset.click();

  await expect(reset).toHaveCount(0);
  expect(await page.evaluate(() => window.voxelModelEditor!.workspace.view.settings.background)).toBeNull();
});

test("the lighting menu and the Material tab's View panel stay in step", async({ page }) => {
  await pickLighting(page, "Night");
  expect(await lighting(page)).toBe("night");

  const lightingGroup = buttonGroup(await openViewSection(page), "Lighting");
  await expect(lightingGroup.getByRole("radio", { name: "Night" })).toBeChecked();

  await lightingGroup.getByRole("radio", { name: "Studio" }).click();
  await expect(page.getByRole("button", { name: "Lighting: Studio" })).toBeVisible();
});
