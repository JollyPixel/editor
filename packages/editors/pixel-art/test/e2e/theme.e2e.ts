// Import Third-party Dependencies
import { test, expect, type Page } from "@playwright/test";

// Import Internal Dependencies
import { gotoDemo } from "./utils.ts";

// `--color-bg-surface` is a `light-dark()` value (PixelDrawPanel.styles.ts):
// getComputedStyle().getPropertyValue() on a custom property returns the
// literal, unresolved function text, not the resolved color — same
// resolveThemeColor() gotcha documented in packages/ui/src/theme/resolveThemeToken.ts.
// Resolve it the same way that helper does: apply it to a real CSS
// property (color) on an already-rendered element and read that instead.
const kLightBgSurface = "rgb(238, 243, 248)";
const kDarkBgSurface = "rgb(19, 27, 36)";

async function readBgSurface(
  page: Page
): Promise<string> {
  return page.evaluate(() => {
    const panel = document.querySelector("pixel-draw-panel")!;

    panel.style.setProperty("color", "var(--color-bg-surface)");
    const resolved = getComputedStyle(panel).color;
    panel.style.removeProperty("color");

    return resolved;
  });
}

async function readTheme(
  page: Page
): Promise<string> {
  return page.evaluate(() => document.querySelector("pixel-draw-panel")!.theme);
}

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

test("defaults to the \"auto\" theme", async({ page }) => {
  const panel = page.locator("pixel-draw-panel");

  // "auto" is applyAppearance()'s absent-attribute case (packages/ui's
  // preferences.ts), not a written "theme=auto" attribute — read the
  // resolved property instead of asserting on the attribute.
  await expect.poll(() => readTheme(page)).toBe("auto");
  await expect(panel).not.toHaveAttribute("theme");
  await expect(page.locator("html")).toHaveAttribute(
    "data-resolved-theme",
    /light|dark/
  );
});

test("preview rotation is enabled by default and can be toggled", async({ page }) => {
  const rotationToggle = page.locator("#rotation-toggle");

  await expect(rotationToggle).toBeChecked();
  await rotationToggle.uncheck();
  await expect(rotationToggle).not.toBeChecked();
});

test("switching the theme control forces the light/dark palette", async({ page }) => {
  const panel = page.locator("pixel-draw-panel");
  const themeGroup = page.locator("jolly-theme-preferences jolly-theme-control");

  await themeGroup.getByRole("radio", { name: "Dark", exact: true }).click();
  await expect(panel).toHaveAttribute("theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-resolved-theme", "dark");
  await expect.poll(() => readBgSurface(page)).toBe(kDarkBgSurface);

  await themeGroup.getByRole("radio", { name: "Light", exact: true }).click();
  await expect(panel).toHaveAttribute("theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-resolved-theme", "light");
  await expect.poll(() => readBgSurface(page)).toBe(kLightBgSurface);

  await themeGroup.getByRole("radio", { name: "Auto", exact: true }).click();
  await expect(panel).not.toHaveAttribute("theme");
  await expect.poll(() => readTheme(page)).toBe("auto");
});
