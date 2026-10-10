// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect,
  playground
} from "./fixtures.ts";
import type { PixelArtPanel } from "./support/panel.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

function surfaceBrightness(
  panel: PixelArtPanel
): Promise<number> {
  return panel.root.evaluate((element: PixelDrawPanel) => {
    element.style.setProperty("color", "var(--color-bg-surface)");
    const [r, g, b] = getComputedStyle(element).color.match(/\d+/g)!.map(Number);
    element.style.removeProperty("color");

    return r + g + b;
  });
}

function readRowHeight(
  panel: PixelArtPanel
): Promise<string> {
  return panel.root.evaluate(
    (element) => getComputedStyle(element)
      .getPropertyValue("--jolly-row-height")
      .trim()
  );
}

test("the theme variable switches the panel between auto, dark and light", async({
  panel,
  page,
  commands
}) => {
  function theme() {
    return panel.root.evaluate((element: PixelDrawPanel) => element.theme);
  }
  const html = page.locator("html");

  expect(await theme()).toBe("auto");
  await expect(panel.root).not.toHaveAttribute("theme");

  await commands.submit("theme dark");
  await expect(panel.root).toHaveAttribute("theme", "dark");
  await expect(html).toHaveAttribute("data-resolved-theme", "dark");
  const dark = await surfaceBrightness(panel);

  await commands.submit("theme light");
  await expect(panel.root).toHaveAttribute("theme", "light");
  await expect(html).toHaveAttribute("data-resolved-theme", "light");
  await expect.poll(() => surfaceBrightness(panel)).toBeGreaterThan(dark);

  await commands.submit("theme auto");
  await expect(panel.root).not.toHaveAttribute("theme");
  await expect.poll(theme).toBe("auto");
});

test("the density variable resizes the panel rows", async({ panel, commands }) => {
  expect(await readRowHeight(panel)).toBe("20px");

  await commands.submit("density compact");
  await expect(panel.root).toHaveAttribute("density", "compact");
  await expect.poll(() => readRowHeight(panel)).toBe("16px");

  await commands.submit("density comfortable");
  await expect.poll(() => readRowHeight(panel)).toBe("26px");
});

test.describe("3D preview", () => {
  test.use({ editor: playground({ runtime: true }) });

  function rotating(
    page: Page
  ): Promise<boolean | undefined> {
    return page.evaluate(() => window.pixelArtEditor?.preview?.scene.rotating);
  }

  test("pixelart.preview.rotate stops the spin across a reload", async({ panel, page, commands }) => {
    expect(await rotating(page)).toBe(true);

    await commands.submit("pixelart.preview.rotate false");
    await expect.poll(() => rotating(page)).toBe(false);

    await panel.reload();
    expect(await rotating(page)).toBe(false);
  });
});
