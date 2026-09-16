// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import {
  boxOf,
  centerOf,
  dragTo,
  heightOf,
  widthOf
} from "../../support/pointer.ts";
import { reloadGallery } from "../../support/gallery.ts";
import {
  dropIntoDock,
  openDockLayout,
  paneKeysOf,
  resizeFrame
} from "../../support/dock.ts";

// CONSTANTS
const kFloatingAssets = "jolly-floating jolly-pane[key='assets'] .header";
const kReset = "[data-action='reset-layout']";

test.describe("DockLayout persistence", () => {
  test.beforeEach(async({ page }) => {
    await openDockLayout(page);
  });

  test("a window remembers its size through docking and reloads until reset", async({ page }) => {
    const frame = page.locator("jolly-floating");
    const origin = await boxOf(frame);
    await resizeFrame(page, { width: 170, height: 130 });
    const resized = await boxOf(frame);
    expect(resized.width).toBeLessThan(origin.width);
    expect(resized.height).toBeLessThan(origin.height);

    await dropIntoDock(page, kFloatingAssets, "left");
    await expect(frame).toHaveCount(0);
    await reloadGallery(page);

    await dragTo(
      page,
      page.locator("jolly-pane[key='assets'] .header"),
      { x: 700, y: 400 }
    );
    const restored = await boxOf(frame);
    expect(restored.width).toBeCloseTo(resized.width, 0);
    expect(restored.height).toBeCloseTo(resized.height, 0);
    expect(700 - restored.x).toBeGreaterThan(0);
    expect(700 - restored.x).toBeLessThan(restored.width);

    await page.locator(kReset).click();
    await expect.poll(() => widthOf(frame)).toBe(260);
  });

  test("reset restores the authored geometry, not only the placement", async({ page }) => {
    const dock = page.locator("jolly-dock[key='left']");
    const frame = page.locator("jolly-floating");
    const width = await widthOf(dock);
    const origin = await boxOf(frame);

    const handle = dock.locator(".resize-handle");
    await handle.focus();
    await handle.press("ArrowRight");
    await expect.poll(() => widthOf(dock)).toBeGreaterThan(width);

    await dragTo(page, page.locator(kFloatingAssets), {
      x: origin.x + 220,
      y: origin.y + 180
    });
    await expect.poll(async() => (await boxOf(frame)).x)
      .toBeGreaterThan(origin.x);

    await page.locator(kReset).click();
    await expect.poll(() => widthOf(dock)).toBe(width);
    await expect.poll(async() => (await boxOf(frame)).x).toBe(origin.x);
    await expect.poll(async() => (await boxOf(frame)).y).toBe(origin.y);
  });

  test("folds, folders and a collapsed dock survive a reload", async({ page }) => {
    const inspector = page.locator("jolly-pane[key='inspector']");
    const folder = page.locator("jolly-pane[key='hud'] jolly-folder");
    const dock = page.locator("jolly-dock[key='left']");
    const expanded = await heightOf(inspector);

    await inspector.locator(".fold").click();
    await expect(inspector).toHaveAttribute("collapsed");
    await expect(inspector.locator(".fold"))
      .toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => heightOf(inspector)).toBeLessThan(expanded);

    await folder.locator(".toggle").click();
    await dock.locator(".resize-handle").dblclick();
    await expect(folder).not.toHaveAttribute("open");
    await expect(dock).toHaveAttribute("collapsed");

    await reloadGallery(page);
    await expect(inspector).toHaveAttribute("collapsed");
    await expect(folder).not.toHaveAttribute("open");
    await expect(dock).toHaveAttribute("collapsed");
  });

  test("an emptied solid dock gives its space back and still takes a pane", async({ page }) => {
    const dock = page.locator("jolly-dock[key='left']");
    const viewport = await centerOf(page.locator(".dock-layout-viewport"));
    expect(await widthOf(dock)).toBeGreaterThan(0);

    for (const [key, offset] of [["hierarchy", 0], ["inspector", 80]] as const) {
      await dragTo(
        page,
        page.locator(`jolly-dock[key='left'] jolly-pane[key='${key}'] .header`),
        {
          x: viewport.x,
          y: viewport.y + offset
        }
      );
    }
    await expect(dock).toHaveAttribute("empty");
    await expect.poll(() => widthOf(dock)).toBe(0);

    const edge = await boxOf(dock);
    await dragTo(
      page,
      page.locator("jolly-floating jolly-pane[key='hierarchy'] .header"),
      {
        x: edge.x + 8,
        y: edge.y + 200
      }
    );
    await expect(paneKeysOf(page, "left")).resolves.toEqual(["hierarchy"]);
    await expect(dock).not.toHaveAttribute("empty");
  });

  test("the arrangement survives a reload and Reset restores the markup", async({ page }) => {
    await dragTo(
      page,
      page.locator("jolly-pane[key='hierarchy'] .header"),
      await centerOf(page.locator(".dock-layout-viewport"))
    );
    await expect(paneKeysOf(page, "left")).resolves.toEqual(["inspector"]);

    await reloadGallery(page);
    await expect(paneKeysOf(page, "left")).resolves.toEqual(["inspector"]);
    await expect(
      page.locator("jolly-floating jolly-pane[key='hierarchy']")
    ).toHaveCount(1);

    await page.locator(kReset).click();
    await expect(paneKeysOf(page, "left"))
      .resolves.toEqual(["hierarchy", "inspector"]);
  });
});
