// Import Third-party Dependencies
import {
  boxOf,
  centerOf,
  dragTo,
  heightOf,
  widthOf
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "../../fixtures.ts";
import { reloadGallery } from "../../support/gallery.ts";
import { Dock } from "../../support/dock.ts";
import { FloatingWindow } from "../../support/floating.ts";
import { Pane } from "../../support/pane.ts";

// CONSTANTS
const kReset = "[data-action='reset-layout']";

test.describe("DockLayout persistence", () => {
  test.use({
    example: "scenarios/dock-layout"
  });

  test("a window remembers its size through docking and reloads until reset", async({ page }) => {
    const left = new Dock(page, "left");
    const frame = new FloatingWindow(page);
    const origin = await boxOf(frame.root);
    await frame.resizeTo({ width: 170, height: 130 });
    const resized = await boxOf(frame.root);
    expect(resized.width).toBeLessThan(origin.width);
    expect(resized.height).toBeLessThan(origin.height);

    await left.drop(frame.pane("assets").header);
    await expect(frame.root).toHaveCount(0);
    await expect(left.paneKeys())
      .resolves.toEqual(["hierarchy", "inspector", "assets"]);
    await reloadGallery(page);

    await dragTo(page, new Pane(page, "assets").header, { x: 700, y: 400 });
    const restored = await boxOf(frame.root);
    expect(restored.width).toBeCloseTo(resized.width, 0);
    expect(restored.height).toBeCloseTo(resized.height, 0);
    expect(700 - restored.x).toBeGreaterThan(0);
    expect(700 - restored.x).toBeLessThan(restored.width);

    await page.locator(kReset).click();
    await expect.poll(() => widthOf(frame.root)).toBe(260);
  });

  test("reset restores the authored geometry, not only the placement", async({ page }) => {
    const dock = new Dock(page, "left");
    const frame = new FloatingWindow(page);
    const width = await widthOf(dock.root);
    const origin = await boxOf(frame.root);

    await dock.resizeHandle.focus();
    await dock.resizeHandle.press("ArrowRight");
    await expect.poll(() => widthOf(dock.root)).toBeGreaterThan(width);

    await dragTo(page, frame.pane("assets").header, {
      x: origin.x + 220,
      y: origin.y + 180
    });
    await expect.poll(async() => (await boxOf(frame.root)).x)
      .toBeGreaterThan(origin.x);

    await page.locator(kReset).click();
    await expect.poll(() => widthOf(dock.root)).toBe(width);
    await expect.poll(async() => (await boxOf(frame.root)).x).toBe(origin.x);
    await expect.poll(async() => (await boxOf(frame.root)).y).toBe(origin.y);
  });

  test("folds, folders and a collapsed dock survive a reload", async({ page }) => {
    const inspector = new Pane(page, "inspector");
    const folder = new Pane(page, "hud").root.locator("jolly-folder");
    const dock = new Dock(page, "left");
    const expanded = await heightOf(inspector.root);

    await inspector.fold.click();
    await expect(inspector.root).toHaveAttribute("collapsed");
    await expect(inspector.fold).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => heightOf(inspector.root)).toBeLessThan(expanded);

    await folder.locator(".toggle").click();
    await dock.resizeHandle.dblclick();
    await expect(folder).not.toHaveAttribute("open");
    await expect(dock.root).toHaveAttribute("collapsed");

    await reloadGallery(page);
    await expect(inspector.root).toHaveAttribute("collapsed");
    await expect(folder).not.toHaveAttribute("open");
    await expect(dock.root).toHaveAttribute("collapsed");
  });

  test("an emptied solid dock gives its space back and still takes a pane", async({ page }) => {
    const dock = new Dock(page, "left");
    const viewport = await centerOf(page.locator(".dock-layout-viewport"));
    expect(await widthOf(dock.root)).toBeGreaterThan(0);

    for (const [key, offset] of [["hierarchy", 0], ["inspector", 80]] as const) {
      await dragTo(page, dock.pane(key).header, {
        x: viewport.x,
        y: viewport.y + offset
      });
    }
    await expect(dock.root).toHaveAttribute("empty");
    await expect.poll(() => widthOf(dock.root)).toBe(0);

    const edge = await boxOf(dock.root);
    await dragTo(page, new FloatingWindow(page).pane("hierarchy").header, {
      x: edge.x + 8,
      y: edge.y + 200
    });
    await expect(dock.paneKeys()).resolves.toEqual(["hierarchy"]);
    await expect(dock.root).not.toHaveAttribute("empty");
  });

  test("the arrangement survives a reload and Reset restores the markup", async({ page }) => {
    const left = new Dock(page, "left");
    await dragTo(
      page,
      new Pane(page, "hierarchy").header,
      await centerOf(page.locator(".dock-layout-viewport"))
    );
    await expect(left.paneKeys()).resolves.toEqual(["inspector"]);

    await reloadGallery(page);
    await expect(left.paneKeys()).resolves.toEqual(["inspector"]);
    await expect(new FloatingWindow(page, "hierarchy").root).toHaveCount(1);

    await page.locator(kReset).click();
    await expect(left.paneKeys())
      .resolves.toEqual(["hierarchy", "inspector"]);
  });
});
