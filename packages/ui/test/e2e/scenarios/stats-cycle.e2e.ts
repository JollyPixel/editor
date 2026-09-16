// Import Third-party Dependencies
import {
  expect,
  test,
  type Locator
} from "@playwright/test";

// Import Internal Dependencies
import {
  openExample,
  reloadGallery
} from "../support/gallery.ts";

// CONSTANTS
const kDarkFpsBackground = [0, 17, 34, 255];

function cornerPixelOf(
  stats: Locator
): Promise<number[] | null> {
  return stats.evaluate((element) => {
    const canvas = element.shadowRoot?.querySelector("canvas");
    const pixel = canvas?.getContext("2d")?.getImageData(0, 0, 1, 1).data;

    return pixel === undefined ? null : [...pixel];
  });
}

test.describe("stats cycle", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "scenarios/stats-cycle");
  });

  test("cycles with pointer and keyboard input", async({ page }) => {
    const stats = page.locator("jolly-stats");
    const steps: Array<[() => Promise<void>, RegExp]> = [
      [() => stats.click(), /^MS:/],
      [() => stats.click({ button: "right" }), /^FPS:/],
      [() => stats.click({ button: "right" }), /^ENTITIES:/],
      [() => stats.press("ArrowRight"), /^FPS:/],
      [() => stats.press("ArrowLeft"), /^ENTITIES:/],
      [() => stats.press("Enter"), /^FPS:/]
    ];

    await expect(stats).toHaveAttribute("aria-label", /^FPS:/);
    for (const [act, label] of steps) {
      await act();
      await expect(stats).toHaveAttribute("aria-label", label);
    }
  });

  test("restores the selected metric after reload", async({ page }) => {
    const stats = page.locator("jolly-stats");
    await stats.click();
    await stats.click();
    await expect(stats).toHaveAttribute("aria-label", /^WORST MS:/);

    await reloadGallery(page);
    await expect(stats).toHaveAttribute("aria-label", /^WORST MS:/);
  });

  test("repaints from the definition palette when its scope theme changes", async({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));

    const stats = page.locator("jolly-stats");
    await expect(stats).toHaveAttribute("aria-label", /^FPS:/);
    await expect.poll(() => cornerPixelOf(stats)).not.toBeNull();
    expect(await cornerPixelOf(stats)).not.toEqual(kDarkFpsBackground);

    const scope = page.locator("jolly-scope:has(> jolly-stats)");
    await stats.evaluate((element) => {
      const wrapper = document.createElement("jolly-scope");
      wrapper.setAttribute("theme", "light");
      element.replaceWith(wrapper);
      wrapper.append(element);
    });
    await scope.evaluate((element) => element.setAttribute("theme", "dark"));
    await expect.poll(() => cornerPixelOf(stats)).toEqual(kDarkFpsBackground);
    expect(failures).toEqual([]);
  });
});
