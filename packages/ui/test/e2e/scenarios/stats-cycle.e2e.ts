// Import Third-party Dependencies
import {
  expect,
  test
} from "@playwright/test";

// Import Internal Dependencies
import {
  gotoGallery,
  reloadGallery
} from "../support/gallery.ts";

test.describe("stats cycle", () => {
  test.beforeEach(async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/stats-cycle",
      chrome: "off"
    });
  });

  test("cycles with pointer and keyboard input", async({ page }) => {
    const stats = page.locator("jolly-stats");
    await expect(stats).toHaveAttribute("aria-label", /^FPS:/);

    await stats.click();
    await expect(stats).toHaveAttribute("aria-label", /^MS:/);

    await stats.click({ button: "right" });
    await expect(stats).toHaveAttribute("aria-label", /^FPS:/);

    await stats.click({ button: "right" });
    await expect(stats).toHaveAttribute("aria-label", /^ENTITIES:/);

    await stats.press("ArrowRight");
    await expect(stats).toHaveAttribute("aria-label", /^FPS:/);

    await stats.press("ArrowLeft");
    await expect(stats).toHaveAttribute("aria-label", /^ENTITIES:/);

    await stats.press("Enter");
    await expect(stats).toHaveAttribute("aria-label", /^FPS:/);
  });

  test("restores the selected metric after reload", async({ page }) => {
    const stats = page.locator("jolly-stats");
    await stats.click();
    await stats.click();
    await expect(stats).toHaveAttribute("aria-label", /^WORST MS:/);

    await reloadGallery(page);

    await expect(page.locator("jolly-stats"))
      .toHaveAttribute("aria-label", /^WORST MS:/);
  });

  test("redraws resolved colours after a theme change", async({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.locator("jolly-stats").evaluate((stats) => {
      stats.closest("jolly-scope")?.setAttribute("theme", "dark");
    });
    await page.waitForTimeout(300);

    expect(failures).toEqual([]);
  });

  test("paints a built-in metric from its definition palette", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/stats-cycle",
      chrome: "off",
      theme: "dark"
    });
    const stats = page.locator("jolly-stats");
    await expect(stats).toHaveAttribute("aria-label", /^FPS:/);

    await expect.poll(() => stats.evaluate((element) => {
      const canvas = element.shadowRoot?.querySelector("canvas");
      const pixel = canvas?.getContext("2d")?.getImageData(0, 0, 1, 1).data;

      return pixel === undefined ? null : [...pixel];
    })).toEqual([0, 17, 34, 255]);
  });
});
