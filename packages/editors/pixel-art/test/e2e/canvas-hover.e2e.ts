// Import Internal Dependencies
import {
  test,
  expect,
  playground
} from "./fixtures.ts";
import type { PixelArtPanel } from "./support/panel.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

test("the panel reports the pointer entering and leaving the canvas", async({ panel, page }) => {
  await page.mouse.move(0, 0);
  await panel.root.evaluate((element: PixelDrawPanel) => {
    element.addEventListener("canvas-hover-change", (event) => {
      element.dataset.canvasHover = String(event.detail.hovering);
    });
  });

  await panel.canvas.host.hover();
  await expect(panel.root).toHaveAttribute("data-canvas-hover", "true");

  await page.mouse.move(0, 0);
  await expect(panel.root).toHaveAttribute("data-canvas-hover", "false");
});

test.describe("3D preview", () => {
  test.use({ editor: playground({ runtime: true }) });

  function keyboardSuspended(
    panel: PixelArtPanel
  ): Promise<boolean | undefined> {
    return panel.page.evaluate(
      () => window.pixelArtEditor?.preview?.editorRuntime.runtime.world.input.keyboard.suspended
    );
  }

  test("hovering the canvas suspends the preview keyboard", async({ panel, page }) => {
    await page.mouse.move(0, 0);

    await panel.canvas.host.hover();
    await expect.poll(() => keyboardSuspended(panel)).toBe(true);

    await page.mouse.move(0, 0);
    await expect.poll(() => keyboardSuspended(panel)).toBe(false);
  });
});
