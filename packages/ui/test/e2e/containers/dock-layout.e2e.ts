// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  partStyleOf,
  shadowBlurOf,
  styleOf
} from "../support/styles.ts";
import {
  boxOf,
  centerOf,
  dragTo,
  heightOf,
  widthOf
} from "../support/pointer.ts";
import {
  gotoGallery,
  reloadGallery
} from "../support/gallery.ts";

// CONSTANTS
const kExample = "scenarios/dock-layout";

/*
 * Every test gets a fresh browser context, so localStorage starts empty
 * without any explicit clearing. An init script would be actively wrong here:
 * it also runs on reload, and would wipe the layout the reload is asserting.
 */
test.describe("DockLayout", () => {
  test("renders the authored arrangement", async({ page }) => {
    await open(page);

    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "hierarchy",
      "inspector"
    ]);
    await expect(paneKeysOf(page, "right")).resolves.toEqual(["hud"]);
    await expect(page.locator("jolly-floating")).toHaveCount(1);
  });

  test("an overlay dock leaves the flow and lets clicks through", async({ page }) => {
    await open(page);

    const overlay = page.locator("jolly-dock[key='right']");
    await expect(overlay).toHaveAttribute("overlay");
    await expect(overlay).toHaveAttribute("align", "end");
    await expect(overlay.locator(".resize-handle")).toHaveCount(0);
    await expect.poll(
      () => overlay.evaluate((element) => getComputedStyle(element).pointerEvents)
    ).toBe("none");
    // Its pane still takes its own clicks.
    await expect.poll(
      () => overlay.evaluate(
        (element) => getComputedStyle(
          element.querySelector("jolly-pane")!
        ).pointerEvents
      )
    ).toBe("auto");
  });

  test("an overlay dock keeps its panes inside its own box", async({ page }) => {
    await open(page);

    const dock = await boxOf(page.locator("jolly-dock[key='right']"));
    const pane = await boxOf(page.locator("jolly-pane[key='hud']"));

    expect(pane.x).toBeGreaterThanOrEqual(dock.x);
    expect(pane.x + pane.width).toBeLessThanOrEqual(dock.x + dock.width);
    expect(pane.y).toBeGreaterThanOrEqual(dock.y);
    expect(pane.y + pane.height).toBeLessThanOrEqual(dock.y + dock.height);
  });

  test("a solid dock scrolls its packed panes, an overlay one spills", async({ page }) => {
    await open(page);

    // Only a dock bounded by an edge of the page can run out of room, so only
    // that one scrolls. An overlay dock is sized by what is in it, and its
    // box ends a gap short of panes that cast a shadow, so it clips nothing.
    await expect.poll(
      () => partStyleOf(
        page.locator("jolly-dock[key='left']"),
        ".content",
        "overflow-y"
      )
    ).toBe("auto");
    await expect.poll(
      () => partStyleOf(
        page.locator("jolly-dock[key='right']"),
        ".content",
        "overflow"
      )
    ).toBe("visible");

    // And it casts the shorter elevation: these sit a gap apart in a column,
    // near enough that a window's shadow would pool between them.
    const cast = await shadowBlurOf(page.locator("jolly-pane[key='hud']"));
    expect(cast).toBeGreaterThan(0);
    expect(cast).toBeLessThan(
      await shadowBlurOf(page.locator("jolly-floating"))
    );
  });

  test("packing panes to one edge does not realign their text", async({ page }) => {
    await open(page);

    // "align" is also a legacy presentational attribute, and the UA maps it
    // onto text-align for custom elements too.
    await expect.poll(
      () => page.locator("jolly-dock[key='right']").evaluate(
        (element) => getComputedStyle(element).textAlign
      )
    ).toBe("start");
  });

  test("a click on the grip does not block the next drag", async({ page }) => {
    await open(page);

    // A press released below the movement threshold is a click, not a drag,
    // and has to end the session all the same.
    await page.locator("jolly-pane[key='hierarchy'] .grip").click();
    await expect(
      page.locator("jolly-pane[key='hierarchy']")
    ).not.toHaveAttribute("dragging");

    const viewport = await centerOf(page.locator(".dock-layout-viewport"));
    await dragTo(
      page,
      page.locator("jolly-pane[key='inspector'] .header"),
      viewport
    );
    await expect(paneKeysOf(page, "left")).resolves.toEqual(["hierarchy"]);
  });

  test("the chevron folds a pane to its header", async({ page }) => {
    await open(page);

    const pane = page.locator("jolly-pane[key='inspector']");
    const expanded = await heightOf(pane);
    await pane.locator(".fold").click();

    await expect(pane).toHaveAttribute("collapsed");
    await expect.poll(() => heightOf(pane)).toBeLessThan(expanded);
    await expect(pane.locator(".fold")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  test("nothing reorders until the drag is released", async({ page }) => {
    await open(page);

    const inspector = page.locator("jolly-pane[key='inspector']");
    const hierarchy = page.locator("jolly-pane[key='hierarchy']");
    const from = await centerOf(inspector.locator(".header"));
    const to = await centerOf(hierarchy.locator(".header"));

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y - 10, { steps: 12 });

    // The preview is painted, and the real order has not moved.
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(1);
    await expect(inspector).toHaveAttribute("dragging");
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "hierarchy",
      "inspector"
    ]);

    await page.mouse.up();
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "inspector",
      "hierarchy"
    ]);
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
  });

  test("a dragged pane is carried as a replica of its own header", async({ page }) => {
    await open(page);

    const inspector = page.locator("jolly-pane[key='inspector']");
    const source = await boxOf(inspector);
    const from = await centerOf(inspector.locator(".header"));

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 60, { steps: 12 });

    // The ghost is a real pane, not a chip standing for one.
    const ghost = page.locator(".jolly-drag-overlay > jolly-pane");
    await expect(ghost).toHaveCount(1);
    await expect(ghost.locator(".title")).toHaveText("Inspector");
    // The grip it was grabbed by survives, and the content does not.
    await expect(ghost.locator(".grip")).toHaveCount(1);
    await expect(ghost.locator("jolly-folder")).toHaveCount(0);

    const carried = await boxOf(ghost);
    const sourceHeader = await boxOf(inspector.locator(".header"));
    expect(carried.width).toBeCloseTo(source.width, 0);
    // Clipped to its header, so it cannot cover the insertion line below it.
    expect(carried.height).toBeCloseTo(sourceHeader.height, 0);
    // Clipped, not folded: a collapsed clone would turn its chevron and report
    // a state the pane being carried is not in.
    await expect(ghost).not.toHaveAttribute("collapsed");

    await page.mouse.up();
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
  });

  test("the carried pane keeps the offset it was grabbed at", async({ page }) => {
    await open(page);

    const inspector = page.locator("jolly-pane[key='inspector']");
    const source = await boxOf(inspector);
    const header = await boxOf(inspector.locator(".header"));
    // Grabbed well off centre, so a ghost merely trailing the cursor would
    // land somewhere else entirely.
    const from = {
      x: header.x + header.width - 40,
      y: header.y + (header.height / 2)
    };

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 120, from.y + 90, { steps: 12 });

    const carried = await boxOf(page.locator(".jolly-drag-overlay > jolly-pane"));
    expect(carried.x).toBeCloseTo(source.x + 120, 0);
    expect(carried.y).toBeCloseTo(source.y + 90, 0);

    await page.mouse.up();
  });

  test("the carried pane paints itself out of the live theme", async({ page }) => {
    await open(page);

    const inspector = page.locator("jolly-pane[key='inspector']");
    const from = await centerOf(inspector.locator(".header"));

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 60, { steps: 12 });

    // Outside every scope host, the ghost resolves its tokens only because the
    // overlay copied them across. A fallback would read as a different blue.
    const ghost = page.locator(".jolly-drag-ghost");
    await expect.poll(() => partStyleOf(ghost, ".header", "background-color")).toBe(
      await partStyleOf(inspector, ".header", "background-color")
    );

    await page.mouse.up();
  });

  test("a floating pane is carried by its window, not by a replica", async({ page }) => {
    await open(page);

    const header = page.locator("jolly-floating jolly-pane[key='assets'] .header");
    const from = await centerOf(header);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 120, from.y + 40, { steps: 12 });

    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(1);
    // The window itself is the thing following the cursor, so the overlay
    // carries nothing: no replica, and the chip stays hidden.
    await expect(page.locator(".jolly-drag-overlay > jolly-pane")).toHaveCount(0);
    await expect(page.locator(".jolly-drag-ghost")).toBeHidden();

    await page.mouse.up();
  });

  test("drop zones are a wash, with no outline drawn over the layout", async({ page }) => {
    await open(page);

    const from = await centerOf(
      page.locator("jolly-pane[key='inspector'] .header")
    );
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(700, 400, { steps: 12 });

    const painted = await page.locator(".jolly-drag-zone").first().evaluate(
      (element) => {
        const style = getComputedStyle(element);

        return {
          outline: style.boxShadow,
          border: style.borderStyle,
          radius: style.borderRadius
        };
      }
    );

    expect(painted.outline).toBe("none");
    expect(painted.border).toBe("none");
    expect(painted.radius).toBe("0px");

    await page.mouse.up();
  });

  test("the armed dock steps up from the docks merely on offer", async({ page }) => {
    await open(page);

    const from = await centerOf(
      page.locator("jolly-pane[key='inspector'] .header")
    );
    const zones = page.locator(".jolly-drag-zone");
    const armed = page.locator(".jolly-drag-zone-armed");

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    // Out over the viewport first, where every dock is on offer and none armed.
    await page.mouse.move(700, 400, { steps: 12 });
    await expect(zones.first()).toBeVisible();
    await expect(armed).toHaveCount(0);
    const idle = await styleOf(zones.first(), "background-color");

    // Then into the middle of the right dock, which is the only one that may
    // arm there. A dock arms across the whole of itself, so its middle is as
    // good a target as its edge.
    const dock = await boxOf(page.locator("jolly-dock[key='right']"));
    await page.mouse.move(dock.x + (dock.width / 2), 300, { steps: 12 });
    await expect(armed).toHaveCount(1);
    const box = await boxOf(armed);
    expect(box.x).toBeCloseTo(dock.x, 0);
    expect(box.width).toBeCloseTo(dock.width, 0);
    await expect.poll(() => styleOf(armed, "background-color")).not.toBe(idle);

    await page.mouse.up();
  });

  test("a docked pane moves to another dock in one gesture", async({ page }) => {
    await open(page);

    // No detour through a floating window: the pane leaves one dock and
    // arrives in the other on a single press.
    const dock = await boxOf(page.locator("jolly-dock[key='right']"));
    await dragTo(
      page,
      page.locator("jolly-pane[key='inspector'] .header"),
      {
        x: dock.x + (dock.width / 2),
        y: dock.y + dock.height - 20
      }
    );

    await expect(page.locator("jolly-floating")).toHaveCount(1);
    await expect(paneKeysOf(page, "left")).resolves.toEqual(["hierarchy"]);
    await expect(paneKeysOf(page, "right")).resolves.toEqual([
      "hud",
      "inspector"
    ]);
  });

  test("the empty dock below a pane's content takes the drop", async({ page }) => {
    await open(page);

    /*
     * Stretched panes are what this is about, so the dock is put into that
     * mode here rather than borrowing an example that happens to be authored
     * that way: which examples pack their panes and which stretch them is a
     * matter of taste, and re-tuning one must not quietly retire this.
     */
    await page.locator("jolly-dock[key='left']").evaluate(
      (dock) => dock.removeAttribute("align")
    );

    const dock = await boxOf(page.locator("jolly-dock[key='left']"));
    const pane = await boxOf(page.locator("jolly-pane[key='hierarchy']"));
    const body = await boxOf(page.locator("jolly-pane[key='hierarchy'] p"));
    const contentBottom = body.y + body.height;
    const middle = pane.y + (pane.height / 2);
    expect(contentBottom).toBeLessThan(middle);

    const header = await centerOf(
      page.locator("jolly-floating jolly-pane[key='assets'] .header")
    );
    await page.mouse.move(header.x, header.y);
    await page.mouse.down();
    // Empty dock, below everything the pane draws but above the middle of the
    // box it was handed. Resolved against that box this read as a drop before
    // the pane, with the line drawn at the top of the dock.
    const aim = contentBottom + 40;
    expect(aim).toBeLessThan(middle);
    await page.mouse.move(dock.x + (dock.width / 2), aim, { steps: 12 });

    const line = await boxOf(page.locator(".jolly-drag-insertion"));
    expect(line.y).toBeGreaterThan(contentBottom - 4);
    expect(line.y).toBeLessThan(contentBottom + 4);

    await page.mouse.up();
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "hierarchy",
      "assets",
      "inspector"
    ]);
  });

  test("Escape cancels a drag in flight", async({ page }) => {
    await open(page);

    const inspector = page.locator("jolly-pane[key='inspector']");
    const hierarchy = page.locator("jolly-pane[key='hierarchy']");
    const from = await centerOf(inspector.locator(".header"));
    const to = await centerOf(hierarchy.locator(".header"));

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y - 10, { steps: 12 });
    await page.keyboard.press("Escape");

    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
    await expect(inspector).not.toHaveAttribute("dragging");

    await page.mouse.up();
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "hierarchy",
      "inspector"
    ]);
  });

  test("dragging a pane onto the viewport extracts it into a window", async({ page }) => {
    await open(page);

    const viewport = await centerOf(page.locator(".dock-layout-viewport"));
    await dragTo(
      page,
      page.locator("jolly-pane[key='hierarchy'] .header"),
      viewport
    );

    await expect(page.locator("jolly-floating")).toHaveCount(2);
    await expect(
      page.locator("jolly-floating jolly-pane[key='hierarchy']")
    ).toHaveCount(1);
    await expect(paneKeysOf(page, "left")).resolves.toEqual(["inspector"]);
  });

  test("dragging a floating pane onto a dock combines it back", async({ page }) => {
    await open(page);

    const dock = page.locator("jolly-dock[key='left']");
    const box = await boxOf(dock);
    // A floating pane crosses no dock on its way anywhere, so every dock takes
    // it across its whole surface rather than on its outer band alone.
    await dragTo(
      page,
      page.locator("jolly-floating jolly-pane[key='assets'] .header"),
      {
        x: box.x + (box.width / 2),
        y: box.y + box.height - 40
      }
    );

    await expect(page.locator("jolly-floating")).toHaveCount(0);
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "hierarchy",
      "inspector",
      "assets"
    ]);
  });

  test("a window comes back out at the size it went in at", async({ page }) => {
    await open(page);

    const frame = page.locator("jolly-floating");
    const origin = await boxOf(frame);
    // Well under the size the left dock will stretch the pane to, so a window
    // sized from its dock cannot pass for one that remembered.
    await resizeFrame(page, { width: 170, height: 130 });
    const resized = await boxOf(frame);
    expect(resized.width).toBeLessThan(origin.width);
    expect(resized.height).toBeLessThan(origin.height);

    const dock = await boxOf(page.locator("jolly-dock[key='left']"));
    await dragTo(
      page,
      page.locator("jolly-floating jolly-pane[key='assets'] .header"),
      {
        x: dock.x + (dock.width / 2),
        y: dock.y + dock.height - 40
      }
    );
    await expect(page.locator("jolly-floating")).toHaveCount(0);

    await dragTo(
      page,
      page.locator("jolly-pane[key='assets'] .header"),
      { x: 700, y: 400 }
    );

    const restored = await boxOf(frame);
    expect(restored.width).toBeCloseTo(resized.width, 0);
    expect(restored.height).toBeCloseTo(resized.height, 0);
    // Dropped under the cursor even though it came back narrower than the
    // pane was in its dock.
    expect(700 - restored.x).toBeGreaterThan(0);
    expect(700 - restored.x).toBeLessThan(restored.width);
  });

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

  test("the keyboard docks a floating pane and it stays docked", async({ page }) => {
    await open(page);

    const grip = page.locator("jolly-floating jolly-pane[key='assets'] .grip");
    await grip.focus();
    await grip.press(" ");
    await grip.press("ArrowLeft");

    // Discarding the emptied window re-runs the host slot change. The sync
    // behind it must see the move, or it reconciles the pane straight back
    // out into a fresh window.
    await expect(page.locator("jolly-floating")).toHaveCount(0);
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "hierarchy",
      "inspector",
      "assets"
    ]);
  });

  test("a dragged window ghosts and keeps following the cursor", async({ page }) => {
    await open(page);

    const frame = page.locator("jolly-floating");
    const dock = await boxOf(page.locator("jolly-dock[key='left']"));
    const header = await boxOf(
      page.locator("jolly-floating jolly-pane[key='assets'] .header")
    );
    const grabX = 40;
    const grabY = header.height / 2;

    await page.mouse.move(header.x + grabX, header.y + grabY);
    await page.mouse.down();
    const target = {
      x: dock.x + (dock.width / 2),
      y: dock.y + 300
    };
    await page.mouse.move(target.x, target.y, { steps: 16 });

    // Over an armed dock the window used to stop dead, which reads as a
    // gesture that has already been dropped.
    const moved = await boxOf(frame);
    expect(Math.round(moved.x)).toBe(Math.round(target.x - grabX));
    expect(Math.round(moved.y)).toBe(Math.round(target.y - grabY));
    await expect(frame).toHaveAttribute("dragging");

    await page.mouse.up();
    await expect(frame).toHaveCount(0);
  });

  test("the insertion line does not use the pane header colour", async({ page }) => {
    await open(page);

    const from = await centerOf(page.locator("jolly-pane[key='hierarchy'] .header"));
    const inspector = await boxOf(page.locator("jolly-pane[key='inspector']"));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, inspector.y + inspector.height - 4, { steps: 14 });

    const line = page.locator(".jolly-drag-insertion");
    await expect(line).toBeVisible();
    const painted = await line.evaluate((element) => {
      const style = getComputedStyle(element);

      return {
        background: style.backgroundColor,
        halo: style.boxShadow
      };
    });
    const headerFill = await page.locator("jolly-pane[key='hierarchy']").evaluate(
      (element) => getComputedStyle(
        element.shadowRoot!.querySelector(".header")!
      ).backgroundColor
    );

    expect(painted.background).not.toBe(headerFill);
    expect(painted.halo).not.toBe("none");
    await page.mouse.up();
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

  test("a window docks once its box enters, cursor short of the dock", async({ page }) => {
    await open(page);

    const dock = await boxOf(page.locator("jolly-dock[key='right']"));
    const header = page.locator("jolly-floating jolly-pane[key='assets'] .header");
    // Half the window is over the dock while the cursor is still 60px shy of
    // it, which is the whole point: the eye follows the window, not the arrow.
    await dragTo(page, header, {
      x: dock.x - 60,
      y: dock.y + 200
    });

    await expect(page.locator("jolly-floating")).toHaveCount(0);
    await expect(paneKeysOf(page, "right")).resolves.toEqual([
      "assets",
      "hud"
    ]);
  });

  test("a lone pane in a dock paints no insertion line", async({ page }) => {
    await open(page);

    const viewport = await centerOf(page.locator(".dock-layout-viewport"));
    await dragTo(
      page,
      page.locator("jolly-pane[key='inspector'] .header"),
      viewport
    );
    await expect(paneKeysOf(page, "left")).resolves.toEqual(["hierarchy"]);

    const header = await centerOf(page.locator("jolly-pane[key='hierarchy'] .header"));
    const dock = await boxOf(page.locator("jolly-dock[key='left']"));
    await page.mouse.move(header.x, header.y);
    await page.mouse.down();

    // There is nothing to insert between, so the line would only ever say the
    // pane lands where it already is.
    for (const y of [header.y + 60, dock.y + dock.height - 20]) {
      await page.mouse.move(header.x, y, { steps: 8 });
      await expect(page.locator(".jolly-drag-insertion")).toBeHidden();
    }

    await page.mouse.up();
    await expect(paneKeysOf(page, "left")).resolves.toEqual(["hierarchy"]);
  });

  test("no line is painted for a drop back onto the pane's own slot", async({ page }) => {
    await open(page);

    const header = await centerOf(page.locator("jolly-pane[key='hierarchy'] .header"));
    const inspector = await boxOf(page.locator("jolly-pane[key='inspector']"));
    await page.mouse.move(header.x, header.y);
    await page.mouse.down();

    await page.mouse.move(header.x, inspector.y + inspector.height - 4, { steps: 12 });
    await expect(page.locator(".jolly-drag-insertion")).toBeVisible();

    await page.mouse.move(header.x, header.y + 4, { steps: 8 });
    await expect(page.locator(".jolly-drag-insertion")).toBeHidden();
    await page.mouse.up();
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

  test("the grip moves a pane with the keyboard and announces it", async({ page }) => {
    await open(page);

    const grip = page.locator("jolly-pane[key='hierarchy'] .grip");
    await grip.focus();
    await grip.press(" ");
    await expect(grip).toHaveAttribute("aria-pressed", "true");

    await grip.press("ArrowDown");
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "inspector",
      "hierarchy"
    ]);
    await expect(
      page.locator("jolly-pane[key='hierarchy'] .live-region")
    ).toHaveText("Hierarchy, left dock, position 2 of 2");

    await grip.press(" ");
    await expect(grip).toHaveAttribute("aria-pressed", "false");
  });

  test("Escape restores the order a keyboard move started from", async({ page }) => {
    await open(page);

    const grip = page.locator("jolly-pane[key='hierarchy'] .grip");
    await grip.focus();
    await grip.press(" ");
    await grip.press("ArrowDown");
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "inspector",
      "hierarchy"
    ]);

    await grip.press("Escape");
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "hierarchy",
      "inspector"
    ]);
  });

  test("the right arrow sends a pane to the adjacent dock", async({ page }) => {
    await open(page);

    const grip = page.locator("jolly-pane[key='hierarchy'] .grip");
    await grip.focus();
    await grip.press(" ");
    await grip.press("ArrowRight");

    await expect(paneKeysOf(page, "left")).resolves.toEqual(["inspector"]);
    await expect(paneKeysOf(page, "right")).resolves.toEqual([
      "hud",
      "hierarchy"
    ]);
  });
});

function open(
  page: Page
): Promise<void> {
  return gotoGallery(page, {
    example: kExample,
    chrome: "off"
  });
}

function paneKeysOf(
  page: Page,
  dock: string
): Promise<string[]> {
  return page.locator(`jolly-dock[key='${dock}']`).evaluate(
    (element) => [...element.querySelectorAll("jolly-pane")].map(
      (pane) => pane.getAttribute("key") ?? ""
    )
  );
}

/**
 * Resizes the floating window by its own handles, one axis at a time.
 */
async function resizeFrame(
  page: Page,
  size: { width: number; height: number; }
): Promise<void> {
  const frame = page.locator("jolly-floating");
  for (const edge of ["right", "bottom"] as const) {
    const box = await boxOf(frame);
    const grip = await centerOf(frame.locator(`.resize-handle.${edge}`));
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(
      edge === "right" ? box.x + size.width : grip.x,
      edge === "bottom" ? box.y + size.height : grip.y,
      { steps: 10 }
    );
    await page.mouse.up();
  }
}
