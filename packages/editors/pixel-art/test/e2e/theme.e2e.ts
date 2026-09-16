// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

// CONSTANTS
const kLightBgSurface = "rgb(238, 243, 248)";
const kDarkBgSurface = "rgb(19, 27, 36)";

function readBgSurface(
  panel: Locator
): Promise<string> {
  return panel.evaluate((element: PixelDrawPanel) => {
    element.style.setProperty("color", "var(--color-bg-surface)");
    const resolved = getComputedStyle(element).color;
    element.style.removeProperty("color");

    return resolved;
  });
}

test("the theme control switches between auto, dark and light", async({ panel, page }) => {
  function theme() {
    return panel.evaluate((element: PixelDrawPanel) => element.theme);
  }
  const control = page.locator("jolly-theme-preferences jolly-theme-control");
  const html = page.locator("html");

  expect(await theme()).toBe("auto");
  await expect(panel).not.toHaveAttribute("theme");

  await control.getByRole("radio", { name: "Dark", exact: true }).click();
  await expect(panel).toHaveAttribute("theme", "dark");
  await expect(html).toHaveAttribute("data-resolved-theme", "dark");
  await expect.poll(() => readBgSurface(panel)).toBe(kDarkBgSurface);

  await control.getByRole("radio", { name: "Light", exact: true }).click();
  await expect(panel).toHaveAttribute("theme", "light");
  await expect(html).toHaveAttribute("data-resolved-theme", "light");
  await expect.poll(() => readBgSurface(panel)).toBe(kLightBgSurface);

  await control.getByRole("radio", { name: "Auto", exact: true }).click();
  await expect(panel).not.toHaveAttribute("theme");
  await expect.poll(theme).toBe("auto");
});
