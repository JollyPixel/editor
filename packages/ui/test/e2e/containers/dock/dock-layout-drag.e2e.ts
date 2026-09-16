// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import {
  partStyleOf,
  styleOf
} from "../../support/styles.ts";
import {
  boxOf,
  centerOf,
  dragTo,
  hold
} from "../../support/pointer.ts";
import {
  dropIntoDock,
  openDockLayout,
  paneKeysOf
} from "../../support/dock.ts";

// CONSTANTS
const kInspector = "jolly-pane[key='inspector']";
const kHierarchy = "jolly-pane[key='hierarchy']";
const kFloatingAssets = "jolly-floating jolly-pane[key='assets'] .header";

test.describe("DockLayout drag", () => {
  test.beforeEach(async({ page }) => {
    await openDockLayout(page);
  });

  test("a docked pane is carried as a themed header replica at its grab offset", async({ page }) => {
    const inspector = page.locator(kInspector);
    const [source, header] = await Promise.all([
      boxOf(inspector),
      boxOf(inspector.locator(".header"))
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
    ).toBe(await partStyleOf(inspector, ".header", "background-color"));

    await page.mouse.up();
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
  });

  test("nothing reorders until the drag is released", async({ page }) => {
    const inspector = page.locator(kInspector);
    const to = await centerOf(page.locator(`${kHierarchy} .header`));

    await hold(page, await centerOf(inspector.locator(".header")), {
      x: to.x,
      y: to.y - 10
    });
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(1);
    await expect(inspector).toHaveAttribute("dragging");
    await expect(paneKeysOf(page, "left"))
      .resolves.toEqual(["hierarchy", "inspector"]);

    await page.mouse.up();
    await expect(paneKeysOf(page, "left"))
      .resolves.toEqual(["inspector", "hierarchy"]);
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
  });

  test("Escape cancels a drag in flight", async({ page }) => {
    const inspector = page.locator(kInspector);
    const to = await centerOf(page.locator(`${kHierarchy} .header`));

    await hold(page, await centerOf(inspector.locator(".header")), {
      x: to.x,
      y: to.y - 10
    });
    await page.keyboard.press("Escape");
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
    await expect(inspector).not.toHaveAttribute("dragging");

    await page.mouse.up();
    await expect(paneKeysOf(page, "left"))
      .resolves.toEqual(["hierarchy", "inspector"]);
  });

  test("drop zones are an unoutlined wash until one dock arms", async({ page }) => {
    const zones = page.locator(".jolly-drag-zone");
    const armed = page.locator(".jolly-drag-zone-armed");

    await hold(page, await centerOf(page.locator(`${kInspector} .header`)), {
      x: 700,
      y: 400
    });
    await expect(zones.first()).toBeVisible();
    await expect(armed).toHaveCount(0);
    await expect(zones.first()).toHaveCSS("box-shadow", "none");
    await expect(zones.first()).toHaveCSS("border-style", "none");
    await expect(zones.first()).toHaveCSS("border-radius", "0px");
    const idle = await styleOf(zones.first(), "background-color");

    const dock = await boxOf(page.locator("jolly-dock[key='right']"));
    await page.mouse.move(dock.x + (dock.width / 2), 300, { steps: 12 });
    await expect(armed).toHaveCount(1);
    const box = await boxOf(armed);
    expect(box.x).toBeCloseTo(dock.x, 0);
    expect(box.width).toBeCloseTo(dock.width, 0);
    await expect.poll(() => styleOf(armed, "background-color")).not.toBe(idle);

    await page.mouse.up();
  });

  test("the insertion line shows between panes but not for the pane's own slot", async({ page }) => {
    const line = page.locator(".jolly-drag-insertion");
    const header = await centerOf(page.locator(`${kHierarchy} .header`));
    const inspector = await boxOf(page.locator(kInspector));

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
    await page.locator(`${kHierarchy} .grip`).click();
    await expect(page.locator(kHierarchy)).not.toHaveAttribute("dragging");

    await dragTo(
      page,
      page.locator(`${kInspector} .header`),
      await centerOf(page.locator(".dock-layout-viewport"))
    );
    await expect(page.locator("jolly-floating")).toHaveCount(2);
    await expect(page.locator(`jolly-floating ${kInspector}`)).toHaveCount(1);
    await expect(paneKeysOf(page, "left")).resolves.toEqual(["hierarchy"]);

    const header = await centerOf(page.locator(`${kHierarchy} .header`));
    const dock = await boxOf(page.locator("jolly-dock[key='left']"));
    await hold(page, header, header);
    for (const y of [header.y + 60, dock.y + dock.height - 20]) {
      await page.mouse.move(header.x, y, { steps: 8 });
      await expect(page.locator(".jolly-drag-insertion")).toBeHidden();
    }
    await page.mouse.up();
    await expect(paneKeysOf(page, "left")).resolves.toEqual(["hierarchy"]);
  });

  test("a docked pane moves to another dock in one gesture", async({ page }) => {
    await dropIntoDock(page, `${kInspector} .header`, "right", 20);

    await expect(page.locator("jolly-floating")).toHaveCount(1);
    await expect(paneKeysOf(page, "left")).resolves.toEqual(["hierarchy"]);
    await expect(paneKeysOf(page, "right"))
      .resolves.toEqual(["hud", "inspector"]);
  });

  test("the empty dock below a stretched pane's content takes the drop", async({ page }) => {
    const left = page.locator("jolly-dock[key='left']");
    await left.evaluate((dock) => dock.removeAttribute("align"));

    const [dock, pane, body] = await Promise.all([
      boxOf(left),
      boxOf(page.locator(kHierarchy)),
      boxOf(page.locator(`${kHierarchy} p`))
    ]);
    const contentBottom = body.y + body.height;
    const aim = contentBottom + 40;
    expect(aim).toBeLessThan(pane.y + (pane.height / 2));

    await hold(page, await centerOf(page.locator(kFloatingAssets)), {
      x: dock.x + (dock.width / 2),
      y: aim
    });
    const line = await boxOf(page.locator(".jolly-drag-insertion"));
    expect(Math.abs(line.y - contentBottom)).toBeLessThan(4);

    await page.mouse.up();
    await expect(paneKeysOf(page, "left"))
      .resolves.toEqual(["hierarchy", "assets", "inspector"]);
  });

  test("a floating pane is carried by its window, not by a replica", async({ page }) => {
    const from = await centerOf(page.locator(kFloatingAssets));

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
    const frame = page.locator("jolly-floating");
    const [dock, header] = await Promise.all([
      boxOf(page.locator("jolly-dock[key='left']")),
      boxOf(page.locator(kFloatingAssets))
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
    const moved = await boxOf(frame);
    expect(Math.round(moved.x)).toBe(Math.round(target.x - (grab.x - header.x)));
    expect(Math.round(moved.y)).toBe(Math.round(target.y - (grab.y - header.y)));
    await expect(frame).toHaveAttribute("dragging");

    await page.mouse.up();
    await expect(frame).toHaveCount(0);
  });

  test("dragging a floating pane onto a dock combines it back", async({ page }) => {
    await dropIntoDock(page, kFloatingAssets, "left");

    await expect(page.locator("jolly-floating")).toHaveCount(0);
    await expect(paneKeysOf(page, "left"))
      .resolves.toEqual(["hierarchy", "inspector", "assets"]);
  });

  test("a window docks once its box enters, cursor short of the dock", async({ page }) => {
    const dock = await boxOf(page.locator("jolly-dock[key='right']"));

    await dragTo(page, page.locator(kFloatingAssets), {
      x: dock.x - 60,
      y: dock.y + 200
    });

    await expect(page.locator("jolly-floating")).toHaveCount(0);
    await expect(paneKeysOf(page, "right")).resolves.toEqual(["assets", "hud"]);
  });
});
