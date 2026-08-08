// Import Third-party Dependencies
import { test, expect, type Page } from "@playwright/test";

// Import Internal Dependencies
import { gotoDemo } from "./utils.ts";

// Custom-property values are checked as raw strings.
const kLightBgSurface = "#eef3f8";
const kDarkBgSurface = "#131b24";

async function readBgSurface(
  page: Page
): Promise<string> {
  return page.evaluate(() => {
    const panel = document.querySelector("pixel-draw-panel")!;

    return getComputedStyle(panel).getPropertyValue("--color-bg-surface").trim();
  });
}

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

test("defaults to the \"auto\" theme", async({ page }) => {
  const panel = page.locator("pixel-draw-panel");

  await expect(panel).toHaveAttribute("theme", "auto");
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

test("switching the demo select forces the light/dark palette", async({ page }) => {
  const panel = page.locator("pixel-draw-panel");
  const themeSelect = page.locator("#theme-select");

  await themeSelect.selectOption("dark");
  await expect(panel).toHaveAttribute("theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-resolved-theme", "dark");
  await expect.poll(() => readBgSurface(page)).toBe(kDarkBgSurface);

  await themeSelect.selectOption("light");
  await expect(panel).toHaveAttribute("theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-resolved-theme", "light");
  await expect.poll(() => readBgSurface(page)).toBe(kLightBgSurface);

  await themeSelect.selectOption("auto");
  await expect(panel).toHaveAttribute("theme", "auto");
});
