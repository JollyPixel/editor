// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import { waitForEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";

function blocksLit(
  page: Page
): Promise<boolean[]> {
  return page.evaluate(() => {
    const { blocks } = window.voxelModelEditor!.workspace;

    return [...blocks.values()].map((block) => block.lit);
  });
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

test("the viewport draws the scene once, through the glow while it is on", async({ page }) => {
  expect(await viewportRender(page)).toEqual(["glow"]);

  await page.evaluate(() => window.voxelModelEditor!.workspace.view.update({ glow: false }));

  expect(await viewportRender(page)).toEqual(["direct"]);
});

test("the shading toggle switches blocks to flat and is remembered after a reload", async({ page }) => {
  expect(await blocksLit(page)).toEqual([true]);

  await page.getByRole("button", { name: "Shading: Lit" }).click();

  await expect(page.getByRole("button", { name: "Shading: Flat" })).toBeVisible();
  expect(await blocksLit(page)).toEqual([false]);

  await page.reload();
  await waitForEditor(page);

  await expect(page.getByRole("button", { name: "Shading: Flat" })).toBeVisible();
  expect(await blocksLit(page)).toEqual([false]);
});
