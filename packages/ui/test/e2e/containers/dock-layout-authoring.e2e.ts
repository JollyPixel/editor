// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import {
  partStyleOf,
  shadowBlurOf
} from "../support/styles.ts";
import {
  boxOf,
  centerOf,
  heightOf,
  widthOf
} from "../support/pointer.ts";
import {
  open,
  paneKeysOf
} from "../support/dockLayoutFixture.ts";

/*
 * Static shape of the authored `scenarios/dock-layout` arrangement: what
 * renders, how overlay and solid docks differ, and the chevron/handle
 * affordances that do not involve a drag. See `dock-layout-drag.e2e.ts` for
 * pointer-driven reordering and `dock-layout-persistence.e2e.ts` for
 * reload/reset coverage.
 */
test.describe("DockLayout", () => {
  test("renders the authored arrangement", async({ page }) => {
    await open(page);

    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "hierarchy",
      "inspector"
    ]);
    await expect(paneKeysOf(page, "right")).resolves.toEqual(["hud"]);
    await expect(page.locator("jolly-floating")).toHaveCount(1);
  });

  test("an overlay dock has a transparent resize edge and lets clicks through", async({ page }) => {
    await open(page);

    const overlay = page.locator("jolly-dock[key='right']");
    const handle = overlay.locator(".resize-handle");
    await expect(overlay).toHaveAttribute("overlay");
    await expect(overlay).toHaveAttribute("align", "end");
    await expect(handle).toHaveCount(1);
    await expect.poll(
      () => partStyleOf(overlay, ".resize-handle", "background-color")
    ).toBe("rgba(0, 0, 0, 0)");
    await expect.poll(
      () => overlay.evaluate((element) => getComputedStyle(element).pointerEvents)
    ).toBe("none");
    // Its pane still takes its own clicks.
    await expect.poll(
      () => overlay.evaluate(
        (element) => getComputedStyle(
          element.querySelector("jolly-pane")!
        ).pointerEvents
      )
    ).toBe("auto");

    const width = await widthOf(overlay);
    await handle.focus();
    await handle.press("ArrowLeft");
    await expect.poll(() => widthOf(overlay)).not.toBe(width);

    const resizedWidth = await widthOf(overlay);
    const center = await centerOf(handle);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x - 40, center.y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => widthOf(overlay)).not.toBe(resizedWidth);
  });

  test("an overlay dock keeps its panes inside its own box", async({ page }) => {
    await open(page);

    const dock = await boxOf(page.locator("jolly-dock[key='right']"));
    const pane = await boxOf(page.locator("jolly-pane[key='hud']"));

    expect(pane.x).toBeGreaterThanOrEqual(dock.x);
    expect(pane.x + pane.width).toBeLessThanOrEqual(dock.x + dock.width);
    expect(pane.y).toBeGreaterThanOrEqual(dock.y);
    expect(pane.y + pane.height).toBeLessThanOrEqual(dock.y + dock.height);
  });

  test("a solid dock scrolls its packed panes, and an aligned overlay can scroll", async({ page }) => {
    await open(page);

    // A solid dock is bounded by the edge of the page. An aligned overlay can
    // also scroll when its content is taller than the viewport.
    await expect.poll(
      () => partStyleOf(
        page.locator("jolly-dock[key='left']"),
        ".content",
        "overflow-y"
      )
    ).toBe("auto");
    await expect.poll(
      () => partStyleOf(
        page.locator("jolly-dock[key='right']"),
        ".content",
        "overflow"
      )
    ).toBe("auto");

    // And it casts the shorter elevation: these sit a gap apart in a column,
    // near enough that a window's shadow would pool between them.
    const cast = await shadowBlurOf(page.locator("jolly-pane[key='hud']"));
    expect(cast).toBeGreaterThan(0);
    expect(cast).toBeLessThan(
      await shadowBlurOf(page.locator("jolly-floating"))
    );
  });

  test("packing panes to one edge does not realign their text", async({ page }) => {
    await open(page);

    // "align" is also a legacy presentational attribute, and the UA maps it
    // onto text-align for custom elements too.
    await expect.poll(
      () => page.locator("jolly-dock[key='right']").evaluate(
        (element) => getComputedStyle(element).textAlign
      )
    ).toBe("start");
  });

  test("the chevron folds a pane to its header", async({ page }) => {
    await open(page);

    const pane = page.locator("jolly-pane[key='inspector']");
    const expanded = await heightOf(pane);
    await pane.locator(".fold").click();

    await expect(pane).toHaveAttribute("collapsed");
    await expect.poll(() => heightOf(pane)).toBeLessThan(expanded);
    await expect(pane.locator(".fold")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  test("a jittery click on a collapsed dock's handle does not corrupt its remembered size", async({ page }) => {
    await open(page);

    const dock = page.locator("jolly-dock[key='left']");
    const originalSize = await dock.evaluate((element) => element.size);
    const handle = dock.locator(".resize-handle");

    await handle.dblclick();
    await expect.poll(() => widthOf(dock)).toBe(0);

    // Collapsing moves the handle to where the dock's now-zero-width edge
    // sits, so its position has to be read after collapsing, not before.
    const point = await centerOf(handle);

    // A double-click is two independent click cycles under the hood, each
    // driving the resize handle's own pointerdown/pointerup. A couple of
    // pixels of real-world jitter on either one reads as a resize drag on the
    // collapsed (0px) dock, which is nearly impossible to force on purpose
    // and exactly why this is hard to reproduce by hand.
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 3, point.y);
    await page.mouse.up();

    await expect.poll(() => dock.evaluate((element) => element.size)).toBe(originalSize);

    await handle.dblclick();
    await expect.poll(() => widthOf(dock)).toBe(originalSize);
  });
});
