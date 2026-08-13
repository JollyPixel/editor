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
  widthOf
} from "../support/pointer.ts";
import { reloadGallery } from "../support/gallery.ts";
import {
  open,
  paneKeysOf,
  resizeFrame
} from "../support/dockLayoutFixture.ts";

/*
 * Storage-backed behaviour of `scenarios/dock-layout`: what a reload brings
 * back, what Reset restores, and how an emptied dock holds and gives back
 * its place. Pointer and keyboard reordering live in their own files
 * alongside this one.
 */
test.describe("DockLayout persistence", () => {
  test("a remembered size survives a reload and a reset forgets it", async({ page }) => {
    await open(page);

    await resizeFrame(page, { width: 170, height: 130 });
    const resized = await boxOf(page.locator("jolly-floating"));

    const dock = await boxOf(page.locator("jolly-dock[key='left']"));
    await dragTo(
      page,
      page.locator("jolly-floating jolly-pane[key='assets'] .header"),
      {
        x: dock.x + (dock.width / 2),
        y: dock.y + dock.height - 40
      }
    );

    await reloadGallery(page);
    await dragTo(
      page,
      page.locator("jolly-pane[key='assets'] .header"),
      { x: 700, y: 400 }
    );
    await expect.poll(
      async() => (await boxOf(page.locator("jolly-floating"))).width
    ).toBeCloseTo(resized.width, 0);

    // Reset restores the authored size, not the one it was given since.
    await page.locator("[data-action='reset-layout']").click();
    await expect.poll(
      async() => (await boxOf(page.locator("jolly-floating"))).width
    ).toBe(260);
  });

  test("reset restores the authored geometry, not only the placement", async({ page }) => {
    await open(page);

    const dock = page.locator("jolly-dock[key='left']");
    const frame = page.locator("jolly-floating");
    const width = (await boxOf(dock)).width;
    const origin = await boxOf(frame);

    const handle = dock.locator(".resize-handle");
    await handle.focus();
    await handle.press("ArrowRight");
    await expect.poll(async() => (await boxOf(dock)).width).toBeGreaterThan(width);

    await dragTo(
      page,
      page.locator("jolly-floating jolly-pane[key='assets'] .header"),
      { x: origin.x + 220, y: origin.y + 180 }
    );
    await expect.poll(async() => (await boxOf(frame)).x).toBeGreaterThan(origin.x);

    await page.locator("[data-action='reset-layout']").click();
    await expect.poll(async() => (await boxOf(dock)).width).toBe(width);
    await expect.poll(async() => (await boxOf(frame)).x).toBe(origin.x);
    await expect.poll(async() => (await boxOf(frame)).y).toBe(origin.y);
  });

  test("emptying a solid dock gives its space back", async({ page }) => {
    await open(page);

    const dock = page.locator("jolly-dock[key='left']");
    const viewport = page.locator(".dock-layout-viewport");
    expect(await widthOf(dock)).toBeGreaterThan(0);

    for (const key of ["hierarchy", "inspector"]) {
      const target = await centerOf(viewport);
      await dragTo(
        page,
        page.locator(`jolly-dock[key='left'] jolly-pane[key='${key}'] .header`),
        {
          x: target.x,
          y: target.y + (key === "inspector" ? 80 : 0)
        }
      );
    }

    await expect(dock).toHaveAttribute("empty");
    await expect.poll(() => widthOf(dock)).toBe(0);
  });

  test("an emptied dock still takes a pane back", async({ page }) => {
    await open(page);

    const dock = page.locator("jolly-dock[key='left']");
    const viewport = page.locator(".dock-layout-viewport");
    for (const key of ["hierarchy", "inspector"]) {
      const target = await centerOf(viewport);
      await dragTo(
        page,
        page.locator(`jolly-dock[key='left'] jolly-pane[key='${key}'] .header`),
        {
          x: target.x,
          y: target.y + (key === "inspector" ? 80 : 0)
        }
      );
    }
    await expect(dock).toHaveAttribute("empty");

    // The dock kept its place in the flow, so its band is where it collapsed
    // to, not against the viewport edge the page may not even start at.
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
    await open(page);

    const viewport = await centerOf(page.locator(".dock-layout-viewport"));
    await dragTo(
      page,
      page.locator("jolly-pane[key='hierarchy'] .header"),
      viewport
    );
    await expect(paneKeysOf(page, "left")).resolves.toEqual(["inspector"]);

    await reloadGallery(page);
    await expect(paneKeysOf(page, "left")).resolves.toEqual(["inspector"]);
    await expect(
      page.locator("jolly-floating jolly-pane[key='hierarchy']")
    ).toHaveCount(1);

    await page.locator("[data-action='reset-layout']").click();
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "hierarchy",
      "inspector"
    ]);
  });
});
