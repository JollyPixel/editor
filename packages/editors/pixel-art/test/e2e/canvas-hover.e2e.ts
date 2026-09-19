// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

test("the panel reports the pointer entering and leaving the canvas", async({ panel, page }) => {
  await page.mouse.move(0, 0);
  await panel.evaluate((element: PixelDrawPanel) => {
    element.addEventListener("canvas-hover-change", (event) => {
      element.dataset.canvasHover = String(event.detail.hovering);
    });
  });

  await panel.locator("[part~='canvas-host']").hover();
  await expect(panel).toHaveAttribute("data-canvas-hover", "true");

  await page.mouse.move(0, 0);
  await expect(panel).toHaveAttribute("data-canvas-hover", "false");
});

test.describe("3D preview", () => {
  test.use({ demo: { runtime: true } });

  function keyboardEnabled(
    panel: Locator
  ): Promise<boolean | undefined> {
    return panel.page().evaluate(
      () => window.pixelArtDemo?.preview?.editorRuntime.runtime.world.input.keyboard.enabled
    );
  }

  test("hovering the canvas suspends the preview keyboard", async({ panel, page }) => {
    await page.mouse.move(0, 0);

    await panel.locator("[part~='canvas-host']").hover();
    await expect.poll(() => keyboardEnabled(panel)).toBe(false);

    await page.mouse.move(0, 0);
    await expect.poll(() => keyboardEnabled(panel)).toBe(true);
  });
});
