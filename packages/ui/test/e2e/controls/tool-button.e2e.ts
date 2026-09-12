// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

test.describe("Tool button", () => {
  test.beforeEach(async({ page }) => {
    await gotoGallery(page, {
      example: "controls/tool-button",
      chrome: "off"
    });
  });

  test("a plain button reports its pressed state", async({ page }) => {
    const button = page.getByTestId("plain").locator(".button").first();

    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).not.toHaveAttribute("aria-haspopup");
  });

  test("the icon stays visible next to whitespace children", async({ page }) => {
    const icon = page.getByTestId("mode").locator(".button jolly-icon").first();

    await expect(icon).toBeVisible();
    await expect.poll(
      () => icon.evaluate((element) => element.getBoundingClientRect().width)
    ).toBeGreaterThan(0);
  });

  test("the notch points towards the flyout side", async({ page }) => {
    const notch = page.getByTestId("mode").locator(".notch").first();
    const button = page.getByTestId("mode").locator(".button").first();
    const [notchBox, buttonBox] = await Promise.all([
      notch.boundingBox(),
      button.boundingBox()
    ]);
    if (notchBox === null || buttonBox === null) {
      throw new Error("The notch and its button must have layout boxes");
    }

    expect(notchBox.y - buttonBox.y).toBeLessThan(buttonBox.height / 2);
    expect(
      Math.abs((notchBox.x + (notchBox.width / 2)) - (buttonBox.x + (buttonBox.width / 2)))
    ).toBeLessThan(1);
    await expect(notch).toHaveCSS("border-bottom-width", "4px");
  });

  test("hover opens the flyout and leaving closes it", async({ page }) => {
    const mode = page.getByTestId("mode");

    await mode.locator(".button").first().hover();
    await expect(mode).toHaveAttribute("open");
    await expect(mode.locator(".flyout").first()).toBeVisible();

    await page.mouse.move(5, 5);
    await expect(mode).not.toHaveAttribute("open");
  });

  test("the pointer can travel from the button into the flyout", async({ page }) => {
    const mode = page.getByTestId("mode");
    const option = mode.locator("jolly-tool-button").first();

    await mode.locator(".button").first().hover();
    await option.hover();

    await expect(mode).toHaveAttribute("open");
  });

  test("clicking an option closes the flyout", async({ page }) => {
    const mode = page.getByTestId("mode");

    await mode.locator(".button").first().hover();
    await mode.locator("jolly-tool-button").first().click();

    await expect(mode).not.toHaveAttribute("open");
    await expect.poll(
      () => mode.evaluate((element: HTMLElement & { icon?: string; }) => element.icon)
    ).toBe("lock");
  });

  test("Escape closes the flyout and returns focus", async({ page }) => {
    const mode = page.getByTestId("mode");
    const button = mode.locator(".button").first();

    await button.focus();
    await page.keyboard.press("Enter");
    await expect(mode).toHaveAttribute("open");
    await expect(button).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(mode).not.toHaveAttribute("open");
    await expect(button).toBeFocused();
  });

  test("a disabled button never opens", async({ page }) => {
    const disabled = page.getByTestId("disabled");

    await disabled.hover();
    await expect(disabled).not.toHaveAttribute("open");
  });

  test("a slider drag keeps the flyout open past its edge", async({ page }) => {
    const size = page.getByTestId("size");

    await size.locator(".button").first().hover();
    const lane = size.locator("jolly-slider .lane");
    await expect(lane).toBeVisible();
    const box = await lane.boundingBox();
    if (box === null) {
      throw new Error("The vertical slider lane must have a layout box");
    }

    expect(box.height).toBeGreaterThan(box.width);
    await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y - 20, { steps: 5 });

    await expect(size).toHaveAttribute("open");
    await expect(page.getByTestId("size-value")).toHaveText("8");

    await page.mouse.up();
    await expect(size).not.toHaveAttribute("open");
  });

  test("ArrowUp raises a vertical slider", async({ page }) => {
    const size = page.getByTestId("size");

    await size.locator(".button").first().hover();
    const range = size.locator("jolly-slider input[type=range]");
    await range.focus();
    await page.keyboard.press("ArrowUp");

    await expect(page.getByTestId("size-value")).toHaveText("4");
    await expect(size.locator("jolly-slider")).toHaveAttribute(
      "orientation",
      "vertical"
    );
  });
});
