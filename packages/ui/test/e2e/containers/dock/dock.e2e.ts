// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../../support/gallery.ts";
import {
  boxOf,
  dragTo
} from "../../support/pointer.ts";

test.describe("Dock", () => {
  test("keyboard resizing and both collapse inputs share the host", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/dock",
      chrome: "off"
    });

    const dock = page.locator("jolly-dock");
    const handle = dock.locator(".resize-handle");
    const initial = await dock.evaluate((element) => element.getBoundingClientRect().width);

    await handle.focus();
    await handle.press("ArrowLeft");
    await expect.poll(
      () => dock.evaluate((element) => element.getBoundingClientRect().width)
    ).toBe(initial + 8);

    await handle.dblclick();
    await expect(dock).toHaveAttribute("collapsed");
    await handle.press("Enter");
    await expect(dock).not.toHaveAttribute("collapsed");
  });

  test("uses flush panes and the pixel editor resize grip", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/dock",
      chrome: "off"
    });

    const dock = page.locator("jolly-dock");
    const pane = dock.locator("jolly-pane");
    const handle = dock.locator(".resize-handle");

    await expect(dock).toHaveAttribute("side", "right");
    expect(
      await dock.evaluate((element) => element.style.marginInlineStart)
    ).toBe("auto");
    await expect.poll(
      () => pane.evaluate((element) => getComputedStyle(element).borderRadius)
    ).toBe("0px");
    expect(
      await handle.evaluate((element) => getComputedStyle(element, "::after")
        .backgroundImage)
    ).toContain("radial-gradient");
    await expect(handle).toHaveCSS("width", "4px");

    const colors = await handle.evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = "var(--jolly-dock-resize-bg)";
      element.append(probe);
      const values = {
        handle: getComputedStyle(element).backgroundColor,
        token: getComputedStyle(probe).backgroundColor
      };
      probe.remove();

      return values;
    });
    expect(colors.handle).toBe(colors.token);
    await handle.hover();
    await expect.poll(
      () => handle.evaluate((element) => getComputedStyle(element).backgroundColor)
    ).not.toBe(colors.handle);
  });
});

test.describe("Placement", () => {
  test("the floating pane docks into either side and comes back out", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/dock-resize",
      chrome: "off"
    });

    const stage = page.locator(".placement-stage");
    await expect(stage.locator("jolly-dock-layout")).toHaveCount(1);
    const header = page.locator("jolly-pane[key='floating'] .header");
    const viewport = await boxOf(page.locator(".placement-viewport"));

    for (const side of ["left", "right"] as const) {
      const box = await boxOf(page.locator(`jolly-dock[side='${side}']`));
      await dragTo(page, header, {
        x: box.x + (box.width / 2),
        y: box.y + box.height - 60
      });
      await expect(
        page.locator(`jolly-dock[side='${side}'] jolly-pane[key='floating']`)
      ).toHaveCount(1);
      await expect(page.locator("jolly-floating")).toHaveCount(0);

      // Re-enter each dock from a floating window.
      await dragTo(page, header, {
        x: viewport.x + (viewport.width / 2),
        y: viewport.y + 160
      });
      await expect(
        page.locator("jolly-floating jolly-pane[key='floating']")
      ).toHaveCount(1);
    }
  });

  test("the docked panes are locked in place", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/dock-resize",
      chrome: "off"
    });

    for (const key of ["left", "right"]) {
      const pane = page.locator(`jolly-pane[key='${key}']`);
      await expect(pane).toHaveAttribute("locked");
      await expect(pane).not.toHaveAttribute("movable");
      await expect(pane.locator(".grip")).toHaveCount(0);
    }
    await expect(page.locator("jolly-pane[key='floating']")).toHaveAttribute(
      "movable"
    );

    // An inert header prevents dragging the only pane out.
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

  test("a stored snapshot cannot strand a locked pane in a window", async({ page }) => {
    // Simulate a stale snapshot that floated a now-locked pane.
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
    await gotoGallery(page, {
      example: "scenarios/dock-resize",
      chrome: "off"
    });

    await expect(
      page.locator("jolly-dock[side='left'] jolly-pane[key='left']")
    ).toHaveCount(1);
    await expect(page.locator("jolly-floating")).toHaveCount(1);
  });

  test("both docks fill the stage height", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/dock-resize",
      chrome: "off"
    });

    const stage = await boxOf(page.locator(".placement-stage"));
    for (const side of ["left", "right"]) {
      const dock = await boxOf(page.locator(`jolly-dock[side='${side}']`));
      // The stage adds a one pixel border on each edge.
      expect(dock.height).toBe(stage.height - 2);
    }
  });
});
