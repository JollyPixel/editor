// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

test("raw jolly-theme-preferences report a real extent to their pane", async({ page }) => {
  await gotoGallery(page, { example: "scenarios/dock-layout-transparent" });

  const chrome = page.locator("jolly-pane[key='chrome']");
  const preferences = chrome.locator("jolly-theme-preferences");
  await expect(chrome.locator("jolly-select select")).toBeVisible();

  await test.step("the pane's occupied size reaches the nested controls", async() => {
    const measured = await chrome.evaluate((pane: HTMLElementTagNameMap["jolly-pane"]) => {
      const control = pane
        .querySelector("jolly-theme-preferences")!
        .shadowRoot!.querySelector("jolly-density-control")!
        .shadowRoot!.querySelector("jolly-select")!
        .getBoundingClientRect();

      return {
        controlHeight: control.height,
        controlBottom: control.bottom,
        occupiedBottom: pane.getBoundingClientRect().top + pane.occupiedSize("y")
      };
    });

    expect(measured.controlHeight).toBeGreaterThan(0);
    expect(measured.occupiedBottom).toBeGreaterThanOrEqual(measured.controlBottom - 1);
  });

  await test.step("layout=stack keeps the controls at the top of a tall pane", async() => {
    await chrome.evaluate((pane: HTMLElement) => {
      pane.style.flex = "0 0 auto";
      pane.style.height = "400px";
    });

    function measure(): Promise<{ display: string; themeHeight: number; extent: number; }> {
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

    await preferences.evaluate((element) => element.setAttribute("layout", "inline"));
    const flattened = await measure();
    expect(flattened.display).toBe("contents");

    await preferences.evaluate((element) => element.setAttribute("layout", "stack"));
    const stacked = await measure();
    expect(stacked.display).toBe("grid");
    expect(stacked.themeHeight).toBeLessThan(flattened.themeHeight);
    expect(stacked.extent).toBeLessThan(flattened.extent);
  });
});
