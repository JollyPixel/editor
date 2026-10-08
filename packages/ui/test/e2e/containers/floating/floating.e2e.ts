// Import Third-party Dependencies
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
  test,
  expect
} from "../../fixtures.ts";
import { reloadGallery } from "../../support/gallery.ts";
import { FloatingWindow } from "../../support/floating.ts";

test.describe("Floating", () => {
  test.use({
    example: "containers/floating"
  });

  test("moves within the viewport and resizes from the keyboard", async({ page }) => {
    const frame = new FloatingWindow(page);
    const floating = frame.root;
    const title = await boxOf(frame.pane().title);

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
    const handle = frame.resizeHandle("right");
    await handle.focus();
    await handle.press("ArrowRight");
    await expect.poll(() => widthOf(floating)).toBe(width + 8);
  });

  test("a button in the pane actions is clicked, not dragged", async({ page }) => {
    const frame = new FloatingWindow(page);
    const floating = frame.root;
    const title = await boxOf(frame.pane().title);
    await hold(page, {
      x: title.x + 5,
      y: title.y + 5
    }, {
      x: 60,
      y: 40
    }, 1);
    await page.mouse.up();
    await expect(floating).not.toHaveAttribute("x", "280");

    await floating.getByRole("button", { name: "Reset position" }).click();

    await expect(floating).toHaveAttribute("x", "280");
    await expect(floating).toHaveAttribute("y", "48");
  });

  test("the corner handle resizes both axes from one drag", async({ page }) => {
    const frame = new FloatingWindow(page);
    const floating = frame.root;
    const corner = frame.resizeHandle("corner");
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
    const frame = new FloatingWindow(page);
    const floating = frame.root;
    const pane = frame.pane();
    const bottom = frame.resizeHandle("bottom");
    const height = await heightOf(floating);

    await pane.fold.click();
    await expect(pane.root).toHaveAttribute("collapsed");
    const header = await heightOf(pane.header);
    await expect.poll(() => heightOf(floating)).toBeCloseTo(header, 0);
    await expect(bottom).toHaveClass(/disabled/);
    await expect(frame.resizeHandle("corner")).toHaveClass(/disabled/);
    await expect(frame.resizeHandle("right")).not.toHaveClass(/disabled/);

    await pane.fold.click();
    await expect(pane.root).not.toHaveAttribute("collapsed");
    await expect.poll(() => heightOf(floating)).toBeCloseTo(height, 0);
    await expect(bottom).not.toHaveClass(/disabled/);
  });

  test("a window hidden by its owner comes back hidden", async({ page }) => {
    const floating = new FloatingWindow(page).root;
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
