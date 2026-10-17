// Import Third-party Dependencies
import { measureBox, hold } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect,
  type Page
} from "../fixtures.ts";
import { openExample } from "../support/gallery.ts";
import { Dock } from "../support/dock.ts";
import { Pane } from "../support/pane.ts";
import { readStyle } from "../support/styles.ts";

async function dropBrushNearTop(
  page: Page,
  dock: Dock,
  y?: number
): Promise<void> {
  const [header, target, firstHeader] = await Promise.all([
    measureBox(new Pane(page, "brush").header),
    measureBox(dock.root),
    measureBox(dock.root.locator(":scope > jolly-pane .header").first())
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

    const dock = new Dock(page, "inspector");
    await dropBrushNearTop(page, dock);
    await expect(dock.paneKeys()).resolves.toEqual(["brush", "inspector"]);
    expect(await readStyle(new Pane(page, "brush").root, "--jolly-label-width"))
      .toBe("10ch");
  });

  test.describe("a dock shorter than the panes stacked in it", () => {
    test.use({ viewport: { width: 1280, height: 520 } });

    test("scrolls to the pane the fold would have swallowed", async({ page }) => {
      await openExample(page, "scenarios/editor");

      const inspector = new Dock(page, "inspector");
      const dock = inspector.root;
      const target = await measureBox(dock);
      await dropBrushNearTop(page, inspector, target.y + target.height - 20);
      await expect(inspector.paneKeys())
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

      const brush = new Pane(page, "brush").root;
      const stranded = await measureBox(brush);
      expect(stranded.y + stranded.height).toBeGreaterThan(520);

      await brush.scrollIntoViewIfNeeded();
      const reached = await measureBox(brush);
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
