// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { openExample } from "../../support/gallery.ts";
import {
  boxOf,
  dragTo,
  widthOf
} from "../../support/pointer.ts";
import {
  resolvedColorOf,
  styleOf
} from "../../support/styles.ts";

test.describe("Dock", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "containers/dock");
  });

  test("keyboard resizing and both collapse inputs share the handle", async({ page }) => {
    const dock = page.locator("jolly-dock");
    const handle = dock.locator(".resize-handle");
    const initial = await widthOf(dock);

    await handle.focus();
    await handle.press("ArrowLeft");
    await expect.poll(() => widthOf(dock)).toBe(initial + 8);

    await handle.dblclick();
    await expect(dock).toHaveAttribute("collapsed");
    await handle.press("Enter");
    await expect(dock).not.toHaveAttribute("collapsed");
  });

  test("uses flush panes and the pixel editor resize grip", async({ page }) => {
    const dock = page.locator("jolly-dock");
    const handle = dock.locator(".resize-handle");

    await expect(dock).toHaveAttribute("side", "right");
    expect(await dock.evaluate(
      (element: HTMLElement) => element.style.marginInlineStart
    )).toBe("auto");
    await expect(dock.locator("jolly-pane")).toHaveCSS("border-radius", "0px");
    expect(await styleOf(handle, "background-image", "::after"))
      .toContain("radial-gradient");
    await expect(handle).toHaveCSS("width", "4px");

    const rest = await resolvedColorOf(handle, "var(--jolly-dock-resize-bg)");
    await expect(handle).toHaveCSS("background-color", rest);
    await handle.hover();
    await expect(handle).not.toHaveCSS("background-color", rest);
  });
});

test.describe("Placement", () => {
  test("docks fill the stage and hold locked panes over a stacked window", async({ page }) => {
    await openExample(page, "scenarios/dock-resize");

    expect(await styleOf(page.locator("jolly-floating"), "z-index"))
      .not.toBe("auto");

    const stage = await boxOf(page.locator(".placement-stage"));
    for (const side of ["left", "right"]) {
      const pane = page.locator(`jolly-pane[key='${side}']`);
      const dock = await boxOf(page.locator(`jolly-dock[side='${side}']`));

      expect(dock.height).toBe(stage.height - 2);
      await expect(pane).toHaveAttribute("locked");
      await expect(pane).not.toHaveAttribute("movable");
      await expect(pane.locator(".grip")).toHaveCount(0);
    }
    await expect(page.locator("jolly-pane[key='floating']"))
      .toHaveAttribute("movable");

    const viewport = await boxOf(page.locator(".placement-viewport"));
    await dragTo(page, page.locator("jolly-pane[key='left'] .header"), {
      x: viewport.x + (viewport.width / 2),
      y: viewport.y + 200
    });
    await expect(page.locator("jolly-floating")).toHaveCount(1);
    await expect(
      page.locator("jolly-dock[side='left'] jolly-pane[key='left']")
    ).toHaveCount(1);
  });

  test("the floating pane docks into either side and comes back out", async({ page }) => {
    await openExample(page, "scenarios/dock-resize");

    await expect(page.locator(".placement-stage jolly-dock-layout")).toHaveCount(1);
    const header = page.locator("jolly-pane[key='floating'] .header");
    const viewport = await boxOf(page.locator(".placement-viewport"));

    for (const side of ["left", "right"]) {
      const box = await boxOf(page.locator(`jolly-dock[side='${side}']`));
      await dragTo(page, header, {
        x: box.x + (box.width / 2),
        y: box.y + box.height - 60
      });
      await expect(
        page.locator(`jolly-dock[side='${side}'] jolly-pane[key='floating']`)
      ).toHaveCount(1);
      await expect(page.locator("jolly-floating")).toHaveCount(0);

      await dragTo(page, header, {
        x: viewport.x + (viewport.width / 2),
        y: viewport.y + 160
      });
      await expect(
        page.locator("jolly-floating jolly-pane[key='floating']")
      ).toHaveCount(1);
    }
  });

  test("a stored snapshot cannot strand a locked pane in a window", async({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("gallery-example:placement", JSON.stringify({
        v: 1,
        docks: {
          left: { size: 240, collapsed: false, panes: [] },
          right: { size: 240, collapsed: false, panes: ["right"] }
        },
        floating: {
          left: { x: 700, y: 600, width: 280, height: 220 }
        },
        panes: {}
      }));
    });
    await openExample(page, "scenarios/dock-resize");

    await expect(
      page.locator("jolly-dock[side='left'] jolly-pane[key='left']")
    ).toHaveCount(1);
    await expect(page.locator("jolly-floating")).toHaveCount(1);
  });
});
