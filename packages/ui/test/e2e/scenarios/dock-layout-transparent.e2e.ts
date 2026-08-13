// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

// CONSTANTS
const kExample = "scenarios/dock-layout-transparent";
const kPlacementExample = "scenarios/dock-resize";

/*
 * Regression coverage for two layering bugs both traced back to
 * `jolly-theme-preferences` and `jolly-floating` never reporting a real box:
 * a `jolly-floating` window painted under static content until the user
 * interacted with it, and `jolly-theme-preferences`' `display: contents`
 * host made `Pane.occupiedSize()` read its rendered controls as zero
 * height, so a dock's drop indicator landed short of where they actually end.
 */
test.describe("Dock layout transparent scenario", () => {
  test("a floating window has a real stacking position before any interaction", async({ page }) => {
    await gotoGallery(page, { example: kPlacementExample });

    // Nothing here has been clicked or focused yet, so this is exactly the
    // "just mounted" state that used to leave z-index at "auto".
    const zIndex = await page.locator("jolly-floating").evaluate(
      (element) => getComputedStyle(element).zIndex
    );

    expect(zIndex).not.toBe("auto");
  });

  test("occupiedSize accounts for a raw jolly-theme-preferences child", async({ page }) => {
    await gotoGallery(page, { example: kExample });

    const chrome = page.locator("jolly-pane[key='chrome']");
    // `jolly-theme-preferences` and its two controls are all `display:
    // contents`, so they never report a usable box themselves — the density
    // select nested three shadow roots down is the first real one, and
    // stands in for "how far this control's rendered content actually goes".
    const select = chrome.locator("jolly-select select");
    await expect(select).toBeVisible();

    const measurements = await chrome.evaluate((pane) => {
      const control = pane
        .querySelector("jolly-theme-preferences")!
        .shadowRoot!.querySelector("jolly-density-control")!
        .shadowRoot!.querySelector("jolly-select")!
        .getBoundingClientRect();
      const occupied = (pane as unknown as {
        occupiedSize: (axis: "x" | "y") => number;
      }).occupiedSize("y");
      const paneTop = pane.getBoundingClientRect().top;

      return {
        controlHeight: control.height,
        occupiedBottom: paneTop + occupied,
        controlBottom: control.bottom
      };
    });

    expect(measurements.controlHeight).toBeGreaterThan(0);
    // The pane's occupied extent has to reach at least as far as the
    // control it is holding, not stop short at the header.
    expect(measurements.occupiedBottom).toBeGreaterThanOrEqual(
      measurements.controlBottom - 1
    );
  });
});
