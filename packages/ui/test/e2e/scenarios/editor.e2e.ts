// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";
import { boxOf, hold } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import { paneKeysOf } from "../support/dock.ts";
import { styleOf } from "../support/styles.ts";

async function dropBrushNearTop(
  page: Page,
  dock: string,
  y?: number
): Promise<void> {
  const [header, target, firstHeader] = await Promise.all([
    boxOf(page.locator("jolly-pane[key='brush'] .header")),
    boxOf(page.locator(`jolly-dock[key='${dock}']`)),
    boxOf(page.locator(`jolly-dock[key='${dock}'] > jolly-pane .header`).first())
  ]);

  await hold(page, {
    x: header.x + 60,
    y: header.y + (header.height / 2)
  }, {
    x: target.x + target.width - 12,
    y: y ?? firstHeader.y + firstHeader.height + 12
  }, 20);
  await page.mouse.up();
}

test.describe("editor scenario", () => {
  test("a docked Brush keeps its own label column", async({ page }) => {
    await openExample(page, "scenarios/editor");

    await dropBrushNearTop(page, "inspector");
    await expect(paneKeysOf(page, "inspector")).resolves.toEqual(["brush", "inspector"]);
    expect(await styleOf(page.locator("jolly-pane[key='brush']"), "--jolly-label-width"))
      .toBe("10ch");
  });

  test.describe("a dock shorter than the panes stacked in it", () => {
    test.use({ viewport: { width: 1280, height: 520 } });

    test("scrolls to the pane the fold would have swallowed", async({ page }) => {
      await openExample(page, "scenarios/editor");

      const dock = page.locator("jolly-dock[key='inspector']");
      const target = await boxOf(dock);
      await dropBrushNearTop(page, "inspector", target.y + target.height - 20);
      await expect(paneKeysOf(page, "inspector"))
        .resolves.toEqual(["inspector", "brush"]);

      const content = await dock.evaluate((element) => {
        const surface = element.shadowRoot!.querySelector(".content")!;

        return {
          overflowY: getComputedStyle(surface).overflowY,
          overflows: surface.scrollHeight > surface.clientHeight
        };
      });
      expect(content).toEqual({
        overflowY: "auto",
        overflows: true
      });

      const brush = page.locator("jolly-pane[key='brush']");
      const stranded = await boxOf(brush);
      expect(stranded.y + stranded.height).toBeGreaterThan(520);

      await brush.scrollIntoViewIfNeeded();
      const reached = await boxOf(brush);
      expect(reached.y).toBeGreaterThanOrEqual(0);
      expect(reached.y + reached.height).toBeLessThanOrEqual(521);

      const end = await dock.evaluate((element) => {
        const surface = element.shadowRoot!.querySelector(".content")!;
        const last = element.querySelector("jolly-pane[key='brush']")!;
        surface.scrollTop = surface.scrollHeight;

        return {
          atEnd: surface.scrollTop + surface.clientHeight >= surface.scrollHeight - 1,
          gutter: Math.round(
            surface.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom
          )
        };
      });
      expect(end).toEqual({
        atEnd: true,
        gutter: 8
      });
    });
  });
});
