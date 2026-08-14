// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

test("runtime loading keeps the pixel-art dark theme", async({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/?empty=true&room=loading-theme");

  const loading = page.locator("jolly-loading");
  await loading.waitFor({ state: "attached", timeout: 10_000 });
  const colors = await loading.evaluate((element) => {
    const root = element.shadowRoot!;
    const surface = root.querySelector<HTMLElement>("#loading")!;
    const asset = root.querySelector<HTMLElement>(".asset")!;
    const progress = root.querySelector<HTMLElement>("jolly-progress")!;
    const progressRoot = progress.shadowRoot!;
    const track = progressRoot.querySelector<HTMLElement>(".track")!;
    const indicator = progressRoot.querySelector<HTMLElement>(".indicator")!;

    return {
      surface: getComputedStyle(surface).backgroundColor,
      asset: getComputedStyle(asset).color,
      track: getComputedStyle(track).backgroundImage,
      indicator: getComputedStyle(indicator).backgroundImage
    };
  });

  expect(colors.surface).toBe("rgb(13, 21, 29)");
  expect(colors.asset).toBe("rgb(144, 164, 183)");
  expect(colors.track).toContain("rgb(34, 48, 60)");
  expect(colors.indicator).toContain("rgb(58, 111, 194)");
});
