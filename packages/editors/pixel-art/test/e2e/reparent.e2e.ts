// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import {
  gotoDemo,
  setMode
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
  await page.evaluate(() => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
    const parent = panel.parentNode!;
    const next = panel.nextSibling;
    parent.removeChild(panel);
    parent.insertBefore(panel, next);

    return panel.updateComplete;
  });
});

test("toolbars keep driving the canvas after the panel is moved in the DOM", async({ page }) => {
  await setMode(page, "uv");
  expect(await page.evaluate(
    () => document.querySelector<PixelDrawPanel>("pixel-draw-panel")!.canvasManager!.mode
  )).toBe("uv");

  const showAll = page.getByRole("button", { name: "Show all" });
  const initial = await page.evaluate(
    () => document.querySelector<PixelDrawPanel>("pixel-draw-panel")!.canvasManager!.uv.showAll
  );
  await showAll.click();

  await expect(showAll).toHaveAttribute("aria-pressed", String(!initial));
  expect(await page.evaluate(
    () => document.querySelector<PixelDrawPanel>("pixel-draw-panel")!.canvasManager!.uv.showAll
  )).toBe(!initial);
});

test("the clear texture button still opens its dialog after the panel is moved", async({ page }) => {
  await page.getByRole("button", { name: "Clear texture" }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
});
