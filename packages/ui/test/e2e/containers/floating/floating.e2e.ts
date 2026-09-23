// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";
import {
  boxOf,
  centerOf,
  dragTo,
  heightOf,
  hold,
  widthOf
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  openExample,
  reloadGallery
} from "../../support/gallery.ts";

test.describe("Floating", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "containers/floating");
  });

  test("moves within the viewport and resizes from the keyboard", async({ page }) => {
    const floating = page.locator("jolly-floating");
    const title = await boxOf(floating.locator("jolly-pane .title"));

    await hold(page, {
      x: title.x + 5,
      y: title.y + 5
    }, {
      x: -100,
      y: -100
    }, 1);
    await page.mouse.up();
    await expect(floating).toHaveAttribute("x", "0");
    await expect(floating).toHaveAttribute("y", "0");

    const width = await widthOf(floating);
    const handle = floating.locator(".resize-handle.right");
    await handle.focus();
    await handle.press("ArrowRight");
    await expect.poll(() => widthOf(floating)).toBe(width + 8);
  });

  test("the corner handle resizes both axes from one drag", async({ page }) => {
    const floating = page.locator("jolly-floating");
    const corner = floating.locator(".resize-handle.corner");
    const [width, height, from] = await Promise.all([
      widthOf(floating),
      heightOf(floating),
      centerOf(corner)
    ]);

    await dragTo(page, corner, {
      x: from.x + 40,
      y: from.y + 30
    });

    await expect.poll(() => widthOf(floating)).toBe(width + 40);
    await expect.poll(() => heightOf(floating)).toBe(height + 30);
  });

  test("folding the held pane shrinks the window to its header and locks its height", async({ page }) => {
    const floating = page.locator("jolly-floating");
    const pane = floating.locator("jolly-pane");
    const bottom = floating.locator(".resize-handle.bottom");
    const height = await heightOf(floating);

    await pane.locator(".fold").click();
    await expect(pane).toHaveAttribute("collapsed");
    const header = await heightOf(pane.locator(".header"));
    await expect.poll(() => heightOf(floating)).toBeCloseTo(header, 0);
    await expect(bottom).toHaveClass(/disabled/);
    await expect(floating.locator(".resize-handle.corner")).toHaveClass(/disabled/);
    await expect(floating.locator(".resize-handle.right")).not.toHaveClass(/disabled/);

    await pane.locator(".fold").click();
    await expect(pane).not.toHaveAttribute("collapsed");
    await expect.poll(() => heightOf(floating)).toBeCloseTo(height, 0);
    await expect(bottom).not.toHaveClass(/disabled/);
  });

  test("a window hidden by its owner comes back hidden", async({ page }) => {
    const floating = page.locator("jolly-floating");
    function setHidden(hidden: boolean): Promise<void> {
      return floating.evaluate(
        (element: HTMLElement, value) => {
          element.hidden = value;
        },
        hidden
      );
    }

    await setHidden(true);
    await expect(floating).toBeHidden();
    await reloadGallery(page);
    await expect(floating).toBeHidden();

    await setHidden(false);
    await reloadGallery(page);
    await expect(floating).toBeVisible();
  });
});
