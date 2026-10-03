// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import { waitForEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  test,
  expect,
  playground
} from "./fixtures.ts";
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

function readRowHeight(
  panel: Locator
): Promise<string> {
  return panel.evaluate(
    (element) => getComputedStyle(element)
      .getPropertyValue("--jolly-row-height")
      .trim()
  );
}

async function submit(
  page: Page,
  line: string
): Promise<void> {
  const prompt = page.getByRole("combobox", { name: "Command" });
  if (!await prompt.isVisible()) {
    await page.keyboard.press("Control+k");
    await expect(prompt).toBeFocused();
  }
  await prompt.fill(line);
  await prompt.press("Enter");
  await expect(page.getByRole("log", { name: "Console output" }))
    .toContainText(line);
}

test("the theme variable switches the panel between auto, dark and light", async({ panel, page }) => {
  function theme() {
    return panel.evaluate((element: PixelDrawPanel) => element.theme);
  }
  const html = page.locator("html");

  expect(await theme()).toBe("auto");
  await expect(panel).not.toHaveAttribute("theme");

  await submit(page, "theme dark");
  await expect(panel).toHaveAttribute("theme", "dark");
  await expect(html).toHaveAttribute("data-resolved-theme", "dark");
  await expect.poll(() => readBgSurface(panel)).toBe(kDarkBgSurface);

  await submit(page, "theme light");
  await expect(panel).toHaveAttribute("theme", "light");
  await expect(html).toHaveAttribute("data-resolved-theme", "light");
  await expect.poll(() => readBgSurface(panel)).toBe(kLightBgSurface);

  await submit(page, "theme auto");
  await expect(panel).not.toHaveAttribute("theme");
  await expect.poll(theme).toBe("auto");
});

test("the density variable resizes the panel rows", async({ panel, page }) => {
  expect(await readRowHeight(panel)).toBe("20px");

  await submit(page, "density compact");
  await expect(panel).toHaveAttribute("density", "compact");
  await expect.poll(() => readRowHeight(panel)).toBe("16px");

  await submit(page, "density comfortable");
  await expect.poll(() => readRowHeight(panel)).toBe("26px");
});

test.describe("3D preview", () => {
  test.use({ editor: playground({ runtime: true }) });

  function rotating(
    page: Page
  ): Promise<boolean | undefined> {
    return page.evaluate(() => window.pixelArtEditor?.preview?.scene.rotating);
  }

  test("preview.rotate stops the spin across a reload", async({ page }) => {
    expect(await rotating(page)).toBe(true);

    await submit(page, "preview.rotate false");
    await expect.poll(() => rotating(page)).toBe(false);

    await page.reload();
    await waitForEditor(page);
    expect(await rotating(page)).toBe(false);
  });
});
