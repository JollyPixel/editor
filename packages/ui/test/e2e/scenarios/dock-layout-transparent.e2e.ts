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

  test("layout=stack keeps the controls at the top of the pane", async({ page }) => {
    await gotoGallery(page, { example: kExample });

    const chrome = page.locator("jolly-pane[key='chrome']");
    const preferences = chrome.locator("jolly-theme-preferences");
    await expect(chrome.locator("jolly-select select")).toBeVisible();

    // The stretch only shows once the pane body has room to spare, which is
    // what a locked chrome pane above a shorter sibling ends up with.
    await chrome.evaluate((pane) => {
      pane.style.flex = "0 0 auto";
      pane.style.height = "400px";
    });

    // Every host down this chain is `display: contents`, so the button group
    // and the select are the first elements with a real box.
    async function measure(): Promise<{
      display: string;
      themeHeight: number;
      extent: number;
    }> {
      return preferences.evaluate((element) => {
        function box(
          control: string,
          inner: string
        ): DOMRect {
          return element
            .shadowRoot!.querySelector(control)!
            .shadowRoot!.querySelector(inner)!
            .getBoundingClientRect();
        }
        const theme = box("jolly-theme-control", "jolly-button-group");
        const density = box("jolly-density-control", "jolly-select");

        return {
          display: getComputedStyle(element).display,
          themeHeight: theme.height,
          extent: density.bottom - theme.top
        };
      });
    }

    // Flattened into the pane's column, the controls are flex items whose
    // "1 1 96px" basis is read as height, so they stretch into the spare room
    // and push density away from theme. A grid host keeps both at their own
    // height, at the top of the pane.
    const flattened = await measure();
    expect(flattened.display).toBe("contents");

    await preferences.evaluate(
      (element) => element.setAttribute("layout", "stack")
    );
    const stacked = await measure();

    expect(stacked.display).toBe("grid");
    expect(stacked.themeHeight).toBeLessThan(flattened.themeHeight);
    expect(stacked.extent).toBeLessThan(flattened.extent);
  });
});
