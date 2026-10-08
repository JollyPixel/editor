// Import Third-party Dependencies
import {
  boxOf,
  centerOf,
  hold,
  widthOf,
  type Point
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect,
  type Page
} from "../../fixtures.ts";
import {
  partStyleOf,
  shadowBlurOf
} from "../../support/styles.ts";
import {
  DOCK_HANDLE_SIZE,
  Dock
} from "../../support/dock.ts";
import { FloatingWindow } from "../../support/floating.ts";
import { Pane } from "../../support/pane.ts";

function adoptExampleCss(
  page: Page,
  cssText: string
): Promise<void> {
  return page.locator("gallery-root").evaluate((root, text) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    root.shadowRoot!.adoptedStyleSheets = [
      ...root.shadowRoot!.adoptedStyleSheets,
      sheet
    ];
  }, cssText);
}

function hitsInside(
  page: Page,
  point: Point,
  tag: string
): Promise<boolean> {
  return page.locator("gallery-root").evaluate((root, { x, y, selector }) => {
    const hit = root.shadowRoot!.elementFromPoint(x, y);

    return hit !== null && hit.closest(selector) !== null;
  }, {
    ...point,
    selector: tag
  });
}

test.describe("DockLayout", () => {
  test.use({
    example: "scenarios/dock-layout"
  });

  test("renders the authored overlay and solid docks", async({ page }) => {
    const left = new Dock(page, "left");
    const right = new Dock(page, "right");
    const overlay = right.root;
    const hud = new Pane(page, "hud").root;

    await expect(left.paneKeys())
      .resolves.toEqual(["hierarchy", "inspector"]);
    await expect(right.paneKeys()).resolves.toEqual(["hud"]);
    await expect(new FloatingWindow(page).root).toHaveCount(1);
    await expect(overlay).toHaveAttribute("overlay");
    await expect(overlay).toHaveAttribute("align", "end");
    await expect(overlay).toHaveCSS("pointer-events", "none");
    await expect(overlay).toHaveCSS("text-align", "start");
    await expect(hud).toHaveCSS("pointer-events", "auto");
    await expect.poll(
      () => partStyleOf(overlay, ".resize-handle", "background-color")
    ).toBe("rgba(0, 0, 0, 0)");
    await expect.poll(
      () => partStyleOf(left.root, ".content", "overflow-y")
    ).toBe("auto");
    await expect.poll(
      () => partStyleOf(overlay, ".content", "overflow")
    ).toBe("auto");

    const [dockBox, paneBox] = await Promise.all([
      boxOf(overlay),
      boxOf(hud)
    ]);
    expect(paneBox.x).toBeGreaterThanOrEqual(dockBox.x);
    expect(paneBox.x + paneBox.width).toBeLessThanOrEqual(dockBox.x + dockBox.width);
    expect(paneBox.y).toBeGreaterThanOrEqual(dockBox.y);
    expect(paneBox.y + paneBox.height).toBeLessThanOrEqual(dockBox.y + dockBox.height);

    const cast = await shadowBlurOf(hud);
    expect(cast).toBeGreaterThan(0);
    expect(cast).toBeLessThan(await shadowBlurOf(new FloatingWindow(page).root));
  });

  test("an overlay dock resizes from its keyboard and pointer edge", async({ page }) => {
    const right = new Dock(page, "right");
    const overlay = right.root;
    const handle = right.resizeHandle;
    await expect(handle).toHaveCount(1);

    const width = await widthOf(overlay);
    await handle.focus();
    await handle.press("ArrowLeft");
    await expect.poll(() => widthOf(overlay)).not.toBe(width);

    const resized = await widthOf(overlay);
    const center = await centerOf(handle);
    await hold(page, center, {
      x: center.x - 40,
      y: center.y
    }, 8);
    await page.mouse.up();
    await expect.poll(() => widthOf(overlay)).not.toBe(resized);
  });

  test("an overlay dock lets clicks through despite page CSS re-enabling it", async({ page }) => {
    await adoptExampleCss(
      page,
      "jolly-dock, jolly-dock-layout { pointer-events: auto; }"
    );

    const pane = new Pane(page, "hud").root;
    const [dock, hud] = await Promise.all([
      boxOf(new Dock(page, "right").root),
      boxOf(pane)
    ]);
    expect(hud.y - dock.y).toBeGreaterThan(20);

    const voidPoint = {
      x: dock.x + (dock.width / 2),
      y: dock.y + 10
    };
    await expect.poll(() => hitsInside(page, voidPoint, "jolly-dock")).toBe(false);
    await expect.poll(
      async() => hitsInside(page, await centerOf(pane), "jolly-pane")
    ).toBe(true);

    const pressed = await page.evaluateHandle(() => {
      const paths: string[][] = [];
      document.addEventListener("mousedown", (event) => {
        paths.push(
          event.composedPath()
            .filter((node) => node instanceof Element)
            .map((node) => node.localName)
        );
      });

      return paths;
    });
    await page.mouse.click(voidPoint.x, voidPoint.y);
    const paths = await pressed.jsonValue();
    expect(paths).toHaveLength(1);
    expect(paths[0]).not.toContain("jolly-dock");
  });

  test("a solid dock and a floating window stay clickable in a pass-through layer", async({ page }) => {
    await adoptExampleCss(page, ".dock-layout-stage { pointer-events: none; }");

    await expect.poll(async() => hitsInside(
      page,
      await centerOf(new Dock(page, "left").root),
      "jolly-dock"
    )).toBe(true);
    await expect.poll(async() => hitsInside(
      page,
      await centerOf(new FloatingWindow(page).root),
      "jolly-floating"
    )).toBe(true);
  });

  test("an empty overlay dock does not keep a resize strip over the viewport", async({ page }) => {
    const right = new Dock(page, "right");
    await right.pane("hud").root.evaluate(
      (element) => element.remove()
    );

    await expect(right.root).toHaveAttribute("empty");
    await expect(right.resizeHandle).toBeHidden();
  });

  test("a jittery click on a collapsed dock's handle keeps its remembered size", async({ page }) => {
    const left = new Dock(page, "left");
    const dock = left.root;
    const handle = left.resizeHandle;
    function size(): Promise<number> {
      return dock.evaluate(
        (element: HTMLElementTagNameMap["jolly-dock"]) => element.size
      );
    }
    const original = await size();

    await handle.dblclick();
    await expect.poll(() => widthOf(dock)).toBe(DOCK_HANDLE_SIZE);

    const point = await centerOf(handle);
    await hold(page, point, {
      x: point.x + 3,
      y: point.y
    }, 1);
    await page.mouse.up();
    await expect.poll(size).toBe(original);

    await handle.dblclick();
    await expect.poll(() => widthOf(dock)).toBe(original + DOCK_HANDLE_SIZE);
  });
});
