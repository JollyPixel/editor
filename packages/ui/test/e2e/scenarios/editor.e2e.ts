// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

test.describe("editor examples", () => {
  test("Inspector sliders share a value edge with presence", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor-states",
      chrome: "off"
    });

    const sliders = page.locator("jolly-slider");
    const metalness = sliders.filter({ hasText: "Metalness" });
    const emission = sliders.filter({ hasText: "Emission" });
    const valueRights = await Promise.all([
      metalness.locator(".value").evaluate(
        (node) => node.getBoundingClientRect().right
      ),
      emission.locator(".value").evaluate(
        (node) => node.getBoundingClientRect().right
      )
    ]);

    expect(valueRights[0]).toBe(valueRights[1]);
  });

  test("Floating sliders align across optional revert chrome", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor",
      chrome: "off"
    });

    const sliders = page.locator("jolly-floating jolly-slider");
    const valueRights = await sliders.locator(".value").evaluateAll(
      (nodes) => nodes.map((node) => node.getBoundingClientRect().right)
    );

    await expect(sliders.first().locator(".revert")).toHaveCount(1);
    await expect(sliders.last().locator(".revert")).toHaveCount(0);
    expect(valueRights[0]).toBe(valueRights[1]);
  });

  test("the Brush window docks into either side and comes back out", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor",
      chrome: "off"
    });

    await expect(page.locator("jolly-floating")).toHaveCount(1);
    await expect(paneKeysOf(page, "inspector")).resolves.toEqual(["inspector"]);

    // Into the Inspector, where it lands above the pane already there.
    await dragBrushInto(page, "inspector");
    await expect(page.locator("jolly-floating")).toHaveCount(0);
    await expect(paneKeysOf(page, "inspector")).resolves.toEqual([
      "brush",
      "inspector"
    ]);

    // Across to the Outliner, without passing through a window on the way.
    await dragBrushInto(page, "outliner");
    await expect(paneKeysOf(page, "inspector")).resolves.toEqual(["inspector"]);
    await expect(paneKeysOf(page, "outliner")).resolves.toEqual([
      "brush",
      "outliner"
    ]);

    // And back out onto the viewport, which is a window again.
    const viewport = (await page.locator(".editor-viewport").boundingBox())!;
    const header = (await page
      .locator("jolly-pane[key='brush'] .header")
      .boundingBox())!;
    await page.mouse.move(header.x + 60, header.y + header.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      viewport.x + viewport.width / 2,
      viewport.y + viewport.height / 2,
      { steps: 20 }
    );
    await page.mouse.up();

    await expect(page.locator("jolly-floating")).toHaveCount(1);
    await expect(
      page.locator("jolly-floating jolly-pane[key='brush']")
    ).toHaveCount(1);
    await expect(paneKeysOf(page, "outliner")).resolves.toEqual(["outliner"]);
  });

  test("the docked editor panes keep their shared label column", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor",
      chrome: "off"
    });

    // The Brush pane sets the column itself, so docking it next to the
    // Inspector must not leave it inheriting the dock it landed in.
    await dragBrushInto(page, "inspector");

    const column = await page.locator("jolly-pane[key='brush']").evaluate(
      (element) => getComputedStyle(element).getPropertyValue("--jolly-label-width")
    );
    expect(column.trim()).toBe("10ch");
  });

  test.describe("a dock shorter than the panes stacked in it", () => {
    // Tall enough for the Inspector alone, too short for it and the Brush.
    test.use({ viewport: { width: 1280, height: 520 } });

    test("scrolls to the pane the fold would have swallowed", async({ page }) => {
      await gotoGallery(page, {
        example: "scenarios/editor",
        chrome: "off"
      });

      const dock = page.locator("jolly-dock[key='inspector']");
      const target = (await dock.boundingBox())!;
      await dragBrushInto(page, "inspector", target.y + target.height - 20);
      await expect(paneKeysOf(page, "inspector")).resolves.toEqual([
        "inspector",
        "brush"
      ]);

      const surface = await dock.evaluate((element) => {
        const content = element.shadowRoot!.querySelector(".content")!;

        return {
          overflowY: getComputedStyle(content).overflowY,
          overflows: content.scrollHeight > content.clientHeight
        };
      });
      expect(surface.overflows).toBe(true);
      expect(surface.overflowY).toBe("auto");

      // Off the bottom of the window, where it used to be stranded: nothing
      // could scroll to it, so it could not be grabbed, folded or dragged out.
      const brush = page.locator("jolly-pane[key='brush']");
      const stranded = (await brush.boundingBox())!;
      expect(stranded.y + stranded.height).toBeGreaterThan(520);

      await brush.scrollIntoViewIfNeeded();
      const reached = (await brush.boundingBox())!;
      expect(reached.y).toBeGreaterThanOrEqual(0);
      expect(reached.y + reached.height).toBeLessThanOrEqual(521);

      // Scrolled to the very end, the last pane still clears the edge, which
      // is what tells a stack that has run out from one cut off by the dock.
      const end = await dock.evaluate((element) => {
        const content = element.shadowRoot!.querySelector(".content")!;
        const last = element.querySelector("jolly-pane[key='brush']")!;

        return {
          atEnd: content.scrollTop + content.clientHeight >=
            content.scrollHeight - 1,
          gutter: Math.round(
            content.getBoundingClientRect().bottom -
            last.getBoundingClientRect().bottom
          )
        };
      });
      expect(end.atEnd).toBe(true);
      expect(end.gutter).toBe(8);
    });
  });

  test("Brush Primary color exposes transparency", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor",
      chrome: "off"
    });

    const primary = page.locator("jolly-floating jolly-color");

    await expect(primary).toHaveJSProperty("alpha", true);
    await expect(primary).toHaveJSProperty("value", "#e2b33ccc");
    await expect(primary.locator(".hex")).toHaveValue("#e2b33ccc");
  });
});

/**
 * Drags the Brush pane by its header into a dock, wherever it currently lives.
 *
 * Aimed by default near the top of the dock, which is the one drop position
 * that reads the same whatever is already stacked below it. Pass `y` to land
 * it somewhere else down the dock.
 */
async function dragBrushInto(
  page: Page,
  dock: string,
  y?: number
): Promise<void> {
  const header = (await page
    .locator("jolly-pane[key='brush'] .header")
    .boundingBox())!;
  const target = (await page
    .locator(`jolly-dock[key='${dock}']`)
    .boundingBox())!;
  const outerEdge = dock === "outliner" ?
    target.x + 12 :
    target.x + target.width - 12;

  await page.mouse.move(header.x + 60, header.y + (header.height / 2));
  await page.mouse.down();
  await page.mouse.move(outerEdge, y ?? target.y + 12, { steps: 20 });
  await page.mouse.up();
}

function paneKeysOf(
  page: Page,
  dock: string
): Promise<string[]> {
  return page.locator(`jolly-dock[key='${dock}']`).evaluate(
    (element) => [...element.querySelectorAll("jolly-pane")].map(
      (pane) => pane.getAttribute("key") ?? ""
    )
  );
}
