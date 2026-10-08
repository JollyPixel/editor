// Import Third-party Dependencies
import {
  boxOf,
  centerOf,
  dragTo,
  hold
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "../../fixtures.ts";
import {
  partStyleOf,
  styleOf
} from "../../support/styles.ts";
import { Dock } from "../../support/dock.ts";
import { FloatingWindow } from "../../support/floating.ts";
import { Pane } from "../../support/pane.ts";

test.describe("DockLayout drag", () => {
  test.use({
    example: "scenarios/dock-layout"
  });

  test("a docked pane is carried as a themed header replica at its grab offset", async({ page }) => {
    const inspector = new Pane(page, "inspector");
    const [source, header] = await Promise.all([
      boxOf(inspector.root),
      boxOf(inspector.header)
    ]);
    const from = {
      x: header.x + header.width - 40,
      y: header.y + (header.height / 2)
    };

    await hold(page, from, {
      x: from.x + 120,
      y: from.y + 90
    });

    const ghost = page.locator(".jolly-drag-overlay > jolly-pane");
    await expect(ghost).toHaveCount(1);
    await expect(ghost.locator(".title")).toHaveText("Inspector");
    await expect(ghost.locator(".grip")).toHaveCount(1);
    await expect(ghost.locator("jolly-folder")).toHaveCount(0);
    await expect(ghost).not.toHaveAttribute("collapsed");

    const carried = await boxOf(ghost);
    expect(carried.x).toBeCloseTo(source.x + 120, 0);
    expect(carried.y).toBeCloseTo(source.y + 90, 0);
    expect(carried.width).toBeCloseTo(source.width, 0);
    expect(carried.height).toBeCloseTo(header.height, 0);

    await expect.poll(
      () => partStyleOf(page.locator(".jolly-drag-ghost"), ".header", "background-color")
    ).toBe(await partStyleOf(inspector.root, ".header", "background-color"));

    await page.mouse.up();
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
  });

  test("nothing reorders until the drag is released", async({ page }) => {
    const left = new Dock(page, "left");
    const inspector = new Pane(page, "inspector");
    const to = await centerOf(new Pane(page, "hierarchy").header);

    await hold(page, await centerOf(inspector.header), {
      x: to.x,
      y: to.y - 10
    });
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(1);
    await expect(inspector.root).toHaveAttribute("dragging");
    await expect(left.paneKeys())
      .resolves.toEqual(["hierarchy", "inspector"]);

    await page.mouse.up();
    await expect(left.paneKeys())
      .resolves.toEqual(["inspector", "hierarchy"]);
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
  });

  test("Escape cancels a drag in flight", async({ page }) => {
    const inspector = new Pane(page, "inspector");
    const to = await centerOf(new Pane(page, "hierarchy").header);

    await hold(page, await centerOf(inspector.header), {
      x: to.x,
      y: to.y - 10
    });
    await page.keyboard.press("Escape");
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
    await expect(inspector.root).not.toHaveAttribute("dragging");

    await page.mouse.up();
    await expect(new Dock(page, "left").paneKeys())
      .resolves.toEqual(["hierarchy", "inspector"]);
  });

  test("drop zones are an unoutlined wash until one dock arms", async({ page }) => {
    const zones = page.locator(".jolly-drag-zone");
    const armed = page.locator(".jolly-drag-zone-armed");

    await hold(page, await centerOf(new Pane(page, "inspector").header), {
      x: 700,
      y: 400
    });
    await expect(zones.first()).toBeVisible();
    await expect(armed).toHaveCount(0);
    await expect(zones.first()).toHaveCSS("box-shadow", "none");
    await expect(zones.first()).toHaveCSS("border-style", "none");
    await expect(zones.first()).toHaveCSS("border-radius", "0px");
    const idle = await styleOf(zones.first(), "background-color");

    const dock = await boxOf(new Dock(page, "right").root);
    await page.mouse.move(dock.x + (dock.width / 2), 300, { steps: 12 });
    await expect(armed).toHaveCount(1);
    const box = await boxOf(armed);
    expect(box.x).toBeCloseTo(dock.x, 0);
    expect(box.width).toBeCloseTo(dock.width, 0);
    await expect.poll(() => styleOf(armed, "background-color")).not.toBe(idle);

    await page.mouse.up();
  });

  test("drop zones appear without motion under reduced motion", async({ page }) => {
    await hold(page, await centerOf(new Pane(page, "inspector").header), {
      x: 700,
      y: 400
    });
    const zone = page.locator(".jolly-drag-zone").first();
    await expect(zone).toBeVisible();
    await expect(zone).toHaveCSS("transition-duration", "0s");
    expect(await zone.evaluate((element) => element.getAnimations().length)).toBe(0);

    await page.mouse.up();
  });

  test("the insertion line shows between panes but not for the pane's own slot", async({ page }) => {
    const line = page.locator(".jolly-drag-insertion");
    const header = await centerOf(new Pane(page, "hierarchy").header);
    const inspector = await boxOf(new Pane(page, "inspector").root);

    await hold(page, header, {
      x: header.x,
      y: inspector.y + inspector.height - 4
    });
    await expect(line).toBeVisible();
    await expect(line).not.toHaveCSS("box-shadow", "none");

    await page.mouse.move(header.x, header.y + 4, { steps: 8 });
    await expect(line).toBeHidden();
    await page.mouse.up();
  });

  test("a pane dragged onto the viewport floats, right after a grip click", async({ page }) => {
    const left = new Dock(page, "left");
    const hierarchy = new Pane(page, "hierarchy");
    await hierarchy.grip.click();
    await expect(hierarchy.root).not.toHaveAttribute("dragging");

    await dragTo(
      page,
      new Pane(page, "inspector").header,
      await centerOf(page.locator(".dock-layout-viewport"))
    );
    await expect(new FloatingWindow(page).root).toHaveCount(2);
    await expect(new FloatingWindow(page, "inspector").root).toHaveCount(1);
    await expect(left.paneKeys()).resolves.toEqual(["hierarchy"]);

    const header = await centerOf(hierarchy.header);
    const dock = await boxOf(left.root);
    await hold(page, header, header);
    for (const y of [header.y + 60, dock.y + dock.height - 20]) {
      await page.mouse.move(header.x, y, { steps: 8 });
      await expect(page.locator(".jolly-drag-insertion")).toBeHidden();
    }
    await page.mouse.up();
    await expect(left.paneKeys()).resolves.toEqual(["hierarchy"]);
  });

  test("a docked pane moves to another dock in one gesture", async({ page }) => {
    const right = new Dock(page, "right");
    await right.drop(new Pane(page, "inspector").header, 20);

    await expect(new FloatingWindow(page).root).toHaveCount(1);
    await expect(new Dock(page, "left").paneKeys()).resolves.toEqual(["hierarchy"]);
    await expect(right.paneKeys())
      .resolves.toEqual(["hud", "inspector"]);
  });

  test("the empty dock below a stretched pane's content takes the drop", async({ page }) => {
    const left = new Dock(page, "left");
    const hierarchy = new Pane(page, "hierarchy");
    await left.root.evaluate((dock) => dock.removeAttribute("align"));

    const [dock, pane, body] = await Promise.all([
      boxOf(left.root),
      boxOf(hierarchy.root),
      boxOf(hierarchy.root.locator("p"))
    ]);
    const contentBottom = body.y + body.height;
    const aim = contentBottom + 40;
    expect(aim).toBeLessThan(pane.y + (pane.height / 2));

    await hold(page, await centerOf(new FloatingWindow(page).pane("assets").header), {
      x: dock.x + (dock.width / 2),
      y: aim
    });
    const line = await boxOf(page.locator(".jolly-drag-insertion"));
    expect(Math.abs(line.y - contentBottom)).toBeLessThan(4);

    await page.mouse.up();
    await expect(left.paneKeys())
      .resolves.toEqual(["hierarchy", "assets", "inspector"]);
  });

  test("a floating pane is carried by its window, not by a replica", async({ page }) => {
    const from = await centerOf(new FloatingWindow(page).pane("assets").header);

    await hold(page, from, {
      x: from.x - 120,
      y: from.y + 40
    });
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(1);
    await expect(page.locator(".jolly-drag-overlay > jolly-pane")).toHaveCount(0);
    await expect(page.locator(".jolly-drag-ghost")).toBeHidden();

    await page.mouse.up();
  });

  test("a dragged window keeps following the cursor over an armed dock", async({ page }) => {
    const frame = new FloatingWindow(page);
    const [dock, header] = await Promise.all([
      boxOf(new Dock(page, "left").root),
      boxOf(frame.pane("assets").header)
    ]);
    const grab = {
      x: header.x + 40,
      y: header.y + (header.height / 2)
    };
    const target = {
      x: dock.x + (dock.width / 2),
      y: dock.y + 300
    };

    await hold(page, grab, target, 16);
    const moved = await boxOf(frame.root);
    expect(Math.round(moved.x)).toBe(Math.round(target.x - (grab.x - header.x)));
    expect(Math.round(moved.y)).toBe(Math.round(target.y - (grab.y - header.y)));
    await expect(frame.root).toHaveAttribute("dragging");

    await page.mouse.up();
    await expect(frame.root).toHaveCount(0);
  });

  test("a window docks once its box enters, cursor short of the dock", async({ page }) => {
    const right = new Dock(page, "right");
    const dock = await boxOf(right.root);

    await dragTo(page, new FloatingWindow(page).pane("assets").header, {
      x: dock.x - 60,
      y: dock.y + 200
    });

    await expect(new FloatingWindow(page).root).toHaveCount(0);
    await expect(right.paneKeys()).resolves.toEqual(["assets", "hud"]);
  });
});
