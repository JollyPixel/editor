// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import {
  gotoGallery,
  reloadGallery
} from "../../support/gallery.ts";
import {
  centerOf,
  dragTo,
  heightOf,
  widthOf
} from "../../support/pointer.ts";

test.describe("Floating", () => {
  test("moves, clamps, and resizes through the supplied handles", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/floating",
      chrome: "off"
    });

    const floating = page.locator("jolly-floating");
    const title = floating.locator("jolly-pane .title");
    const titleBox = await title.boundingBox();
    if (titleBox === null) {
      throw new Error("Floating title did not render");
    }

    await page.mouse.move(titleBox.x + 5, titleBox.y + 5);
    await page.mouse.down();
    await page.mouse.move(-100, -100);
    await page.mouse.up();
    await expect(floating).toHaveAttribute("x", "0");
    await expect(floating).toHaveAttribute("y", "0");

    const width = await floating.evaluate((element) => element.getBoundingClientRect().width);
    const handle = floating.locator(".resize-handle.right");
    await handle.focus();
    await handle.press("ArrowRight");
    await expect.poll(
      () => floating.evaluate((element) => element.getBoundingClientRect().width)
    ).toBe(width + 8);
  });

  test("the corner handle resizes both axes together from one drag", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/floating",
      chrome: "off"
    });

    const floating = page.locator("jolly-floating");
    const width = await widthOf(floating);
    const height = await heightOf(floating);

    const corner = floating.locator(".resize-handle.corner");
    const from = await centerOf(corner);
    await dragTo(page, corner, {
      x: from.x + 40,
      y: from.y + 30
    });

    await expect.poll(() => widthOf(floating)).toBe(width + 40);
    await expect.poll(() => heightOf(floating)).toBe(height + 30);
  });

  test("folding the held pane shrinks the window to its header, not just its content", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/floating",
      chrome: "off"
    });

    const floating = page.locator("jolly-floating");
    const pane = floating.locator("jolly-pane");
    const height = await heightOf(floating);

    await pane.locator(".fold").click();
    await expect(pane).toHaveAttribute("collapsed");
    const headerHeight = await heightOf(pane.locator(".header"));
    await expect.poll(() => heightOf(floating)).toBeCloseTo(headerHeight, 0);

    // Folded windows disable handles that would alter stored height.
    await expect(floating.locator(".resize-handle.bottom")).toHaveClass(/disabled/);
    await expect(floating.locator(".resize-handle.corner")).toHaveClass(/disabled/);
    await expect(floating.locator(".resize-handle.right")).not.toHaveClass(/disabled/);

    await pane.locator(".fold").click();
    await expect(pane).not.toHaveAttribute("collapsed");
    await expect.poll(() => heightOf(floating)).toBeCloseTo(height, 0);
    await expect(floating.locator(".resize-handle.bottom")).not.toHaveClass(/disabled/);
  });

  test("a window hidden by its owner comes back hidden", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/floating",
      chrome: "off"
    });

    const floating = page.locator("jolly-floating");
    await floating.evaluate((element: HTMLElement) => {
      element.hidden = true;
    });
    await expect(floating).toBeHidden();

    await reloadGallery(page);
    await expect(floating).toBeHidden();

    await floating.evaluate((element: HTMLElement) => {
      element.hidden = false;
    });
    await reloadGallery(page);
    await expect(floating).toBeVisible();
  });
});
