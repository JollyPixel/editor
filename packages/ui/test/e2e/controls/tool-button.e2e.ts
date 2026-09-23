// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";
import {
  boxOf,
  centerOf,
  hold,
  widthOf
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";

test.describe("Tool button", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "controls/tool-button");
  });

  test("renders pressed state, icon and a notch towards the flyout", async({ page }) => {
    const plain = page.getByTestId("plain").locator(".button").first();
    await expect(plain).toHaveAttribute("aria-pressed", "true");
    await expect(plain).not.toHaveAttribute("aria-haspopup");

    const mode = page.getByTestId("mode");
    const icon = mode.locator(".button jolly-icon").first();
    await expect(icon).toBeVisible();
    await expect.poll(() => widthOf(icon)).toBeGreaterThan(0);

    const notch = mode.locator(".notch").first();
    const [notchBox, buttonBox] = await Promise.all([
      boxOf(notch),
      boxOf(mode.locator(".button").first())
    ]);
    expect(notchBox.y - buttonBox.y).toBeLessThan(buttonBox.height / 2);
    expect(Math.abs(
      (notchBox.x + (notchBox.width / 2)) -
      (buttonBox.x + (buttonBox.width / 2))
    )).toBeLessThan(1);
    await expect(notch).toHaveCSS("border-bottom-width", "4px");
  });

  test("hover opens the flyout, and it survives the trip into it", async({ page }) => {
    const mode = page.getByTestId("mode");

    await mode.locator(".button").first().hover();
    await expect(mode).toHaveAttribute("open");
    await expect(mode.locator(".flyout").first()).toBeVisible();

    await mode.locator("jolly-tool-button").first().hover();
    await expect(mode).toHaveAttribute("open");

    await page.mouse.move(5, 5);
    await expect(mode).not.toHaveAttribute("open");
  });

  test("clicking an option picks it and closes the flyout", async({ page }) => {
    const mode = page.getByTestId("mode");

    await mode.locator(".button").first().hover();
    await mode.locator("jolly-tool-button").first().click();

    await expect(mode).not.toHaveAttribute("open");
    await expect(mode).toHaveJSProperty("icon", "lock");
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

  test("a vertical slider drag keeps the flyout open past its edge", async({ page }) => {
    const size = page.getByTestId("size");

    await size.locator(".button").first().hover();
    const lane = size.locator("jolly-slider .lane");
    await expect(lane).toBeVisible();
    const box = await boxOf(lane);
    expect(box.height).toBeGreaterThan(box.width);

    await hold(page, await centerOf(lane), {
      x: box.x + 200,
      y: box.y - 20
    }, 5);
    await expect(size).toHaveAttribute("open");
    await expect(page.getByTestId("size-value")).toHaveText("8");

    await page.mouse.up();
    await expect(size).not.toHaveAttribute("open");
  });

  test("ArrowUp raises a vertical slider", async({ page }) => {
    const size = page.getByTestId("size");

    await size.locator(".button").first().hover();
    await expect(size.locator("jolly-slider"))
      .toHaveAttribute("orientation", "vertical");
    await size.locator("jolly-slider input[type=range]").focus();
    await page.keyboard.press("ArrowUp");

    await expect(page.getByTestId("size-value")).toHaveText("4");
  });
});
