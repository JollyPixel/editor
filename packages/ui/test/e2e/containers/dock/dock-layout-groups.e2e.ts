// Import Third-party Dependencies
import {
  boxOf,
  centerOf,
  dragTo,
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
import { reloadGallery } from "../../support/gallery.ts";
import {
  DOCK_HANDLE_SIZE,
  Dock
} from "../../support/dock.ts";
import { FloatingWindow } from "../../support/floating.ts";
import {
  Pane,
  PaneGroup
} from "../../support/pane.ts";

async function rightEdgeOf(
  page: Page
): Promise<Point> {
  const stage = await boxOf(page.locator(".dock-layout-stage"));

  return {
    x: stage.x + stage.width - 12,
    y: stage.y + (stage.height / 2)
  };
}

test.describe("DockLayout groups", () => {
  test.use({
    example: "scenarios/dock-layout-groups"
  });

  test("a group shows one pane behind its tabs and a tab click swaps it", async({ page }) => {
    const group = new PaneGroup(page);
    const blocks = new Pane(page, "blocks");
    const paint = new Pane(page, "paint");
    const visible = page.locator(".dock-layout-visible");

    await expect(group.tabs).toHaveText(["General", "Blocks", "Paint"]);
    await expect(group.selectedTab).toHaveText("Blocks");
    await expect(blocks.root).toBeVisible();
    await expect(blocks.title).toHaveCount(0);
    await expect(paint.root).toBeHidden();
    await expect(visible).toHaveText("blocks layers");

    await group.tab("Paint").click();
    await expect(paint.root).toBeVisible();
    await expect(blocks.root).toHaveAttribute("inactive");
    await expect(visible).toHaveText("layers paint");
  });

  test("tabs with an icon collapse to it when the labels no longer fit", async({ page }) => {
    const group = new PaneGroup(page);
    const general = group.tab("General");

    await expect(general).not.toHaveAttribute("data-icon-only");
    await expect(general).not.toHaveAttribute("title");

    await group.root.evaluate((element) => {
      (element as HTMLElement).style.width = "120px";
    });
    await expect(general).toHaveAttribute("data-icon-only");
    await expect(general).toHaveAttribute("title", "General");
    await expect(general).toHaveAccessibleName("General");
    await expect(group.tab("Blocks")).not.toHaveAttribute("data-icon-only");

    await group.root.evaluate((element) => {
      (element as HTMLElement).style.width = "";
    });
    await expect(new Dock(page, "left").root).toBeVisible();
    await expect(general).not.toHaveAttribute("data-icon-only");
    await expect(general).toHaveText("General");
  });

  test("a pane icon leads its tab, its header and its drag ghost", async({ page }) => {
    const group = new PaneGroup(page);
    const general = group.tab("General");
    const layersHeader = new Pane(page, "layers").header;

    await expect(general.locator("jolly-icon")).toHaveAttribute("name", "info");
    await expect(group.tab("Blocks").locator("jolly-icon")).toHaveCount(0);
    await expect(layersHeader.locator("jolly-icon.icon")).toHaveAttribute("name", "eye");

    const [icon, label] = await Promise.all([
      boxOf(general.locator("jolly-icon")),
      boxOf(general.locator(".label"))
    ]);
    expect(icon.x).toBeLessThan(label.x);

    const from = await centerOf(layersHeader);
    await hold(page, from, {
      x: from.x + 40,
      y: from.y - 60
    });
    await expect(page.locator(".jolly-drag-overlay > jolly-pane jolly-icon.icon"))
      .toHaveAttribute("name", "eye");
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("stretched tabs restore their labels after widening the dock", async({ page }) => {
    const group = new PaneGroup(page);
    const dock = new Dock(page, "left").root;
    await group.root.evaluate((element) => {
      const style = document.createElement("style");
      style.textContent = "jolly-pane-group::part(tab) { flex: 1 1 0; }";
      const root = element.getRootNode();
      (root instanceof ShadowRoot ? root : document.head).append(style);
    });

    const strip = await boxOf(group.tabStrip);
    const widths = await group.tabs.evaluateAll(
      (tabs) => tabs.map((tab) => tab.getBoundingClientRect().width)
    );
    expect(widths.reduce((sum, width) => sum + width, 0))
      .toBeGreaterThan(strip.width - (widths.length * 2));
    for (const width of widths) {
      expect(width).toBeCloseTo(widths[0], 0);
    }

    await dock.evaluate((element) => {
      element.setAttribute("size", "150");
    });
    const general = group.tab("General");
    await expect.poll(() => widthOf(general)).toBeLessThan(60);
    expect(await widthOf(general.locator("jolly-icon"))).toBeCloseTo(14, 0);
    expect(await general.locator(".label").evaluate(
      (label) => label.scrollWidth > label.clientWidth
    )).toBe(true);

    await dock.evaluate((element) => {
      element.setAttribute("size", "400");
    });
    await expect(general).not.toHaveAttribute("data-icon-only");
    await expect(general.locator(".label")).toHaveCSS("position", "static");
    await expect.poll(() => general.locator(".label").evaluate(
      (label) => label.clientWidth >= label.scrollWidth
    )).toBe(true);
  });

  test("an empty dock previews, takes and gives back its width", async({ page }) => {
    const right = new Dock(page, "right");
    const layers = new Pane(page, "layers");
    await expect(right.root).toHaveAttribute("empty");
    expect(await widthOf(right.root)).toBe(0);

    await hold(
      page,
      await centerOf(layers.header),
      await rightEdgeOf(page),
      16
    );
    const armed = page.locator(".jolly-drag-zone-armed");
    await expect(armed).toHaveCount(1);
    expect((await boxOf(armed)).width).toBe(240);
    await page.mouse.up();

    await expect(right.root).not.toHaveAttribute("empty");
    await expect.poll(() => widthOf(right.root)).toBe(240 + DOCK_HANDLE_SIZE);
    await expect(right.slots()).resolves.toEqual([["layers"]]);

    await new Dock(page, "left").drop(layers.header, 20);
    await expect(right.root).toHaveAttribute("empty");
    await expect.poll(() => widthOf(right.root)).toBe(0);
  });

  test("an empty dock shows no resize handle and cannot be collapsed", async({ page }) => {
    const right = new Dock(page, "right");
    await right.root.evaluate((dock) => dock.setAttribute("collapsible", ""));
    await expect(right.resizeHandle).toBeHidden();

    await right.resizeHandle.dispatchEvent("dblclick");
    await expect(right.root).not.toHaveAttribute("collapsed");
  });

  test("a pane dropped into a collapsed dock opens it", async({ page }) => {
    const right = new Dock(page, "right");
    await right.root.evaluate((dock) => dock.setAttribute("collapsible", ""));
    await dragTo(
      page,
      new Pane(page, "layers").header,
      await rightEdgeOf(page)
    );
    await right.resizeHandle.dblclick();
    await expect(right.root).toHaveAttribute("collapsed");

    const edge = await boxOf(right.root);
    await dragTo(page, new PaneGroup(page).tab("Paint"), {
      x: edge.x - 8,
      y: edge.y + (edge.height / 2)
    });

    await expect(right.slots()).resolves.toEqual([["layers"], ["paint"]]);
    await expect(right.root).not.toHaveAttribute("collapsed");
    await expect.poll(() => widthOf(right.root)).toBe(240 + DOCK_HANDLE_SIZE);
  });

  test("a tab dropped into another dock takes its own slot", async({ page }) => {
    await dragTo(page, new PaneGroup(page).tab("Paint"), await rightEdgeOf(page));

    const paint = new Pane(page, "paint");
    await expect(new Dock(page, "right").slots()).resolves.toEqual([["paint"]]);
    await expect(new Dock(page, "left").slots())
      .resolves.toEqual([["general", "blocks"], ["layers"]]);
    await expect(paint.root).not.toHaveAttribute("grouped");
    await expect(paint.root).toBeVisible();
    await expect(page.locator(".dock-layout-visible"))
      .toHaveText("blocks layers paint");
  });

  test("a hidden tab floats at its declared size, else at its group size", async({ page }) => {
    const group = new PaneGroup(page);
    const groupBox = await boxOf(group.root);
    const viewport = await centerOf(page.locator(".dock-layout-viewport"));

    await dragTo(page, group.tab("Paint"), viewport);
    const declared = await boxOf(new FloatingWindow(page, "paint").root);
    expect(declared.width).toBeCloseTo(300, 0);
    expect(declared.height).toBeCloseTo(420, 0);

    await dragTo(page, group.tab("General"), {
      x: viewport.x - 200,
      y: viewport.y
    });
    const inherited = await boxOf(new FloatingWindow(page, "general").root);
    expect(inherited.width).toBeCloseTo(groupBox.width, 0);
    expect(inherited.height).toBeCloseTo(groupBox.height, 0);
  });

  test("a pane dropped on a tab strip joins the group as the shown tab", async({ page }) => {
    const group = new PaneGroup(page);
    const strip = await boxOf(group.tabStrip);
    await dragTo(page, new Pane(page, "layers").header, {
      x: strip.x + strip.width - 8,
      y: strip.y + (strip.height / 2)
    });

    await expect(new Dock(page, "left").slots())
      .resolves.toEqual([["general", "blocks", "paint", "layers"]]);
    await expect(new Pane(page, "layers").root).toHaveAttribute("grouped");
    await expect(group.selectedTab).toHaveText("Layers");
  });

  test("a tab dropped on a pane header creates a group", async({ page }) => {
    const group = new PaneGroup(page);
    const header = await boxOf(new Pane(page, "layers").header);
    await dragTo(page, group.tab("General"), {
      x: header.x + 12,
      y: header.y + (header.height / 2)
    });

    await expect(new Dock(page, "left").slots())
      .resolves.toEqual([["blocks", "paint"], ["general", "layers"]]);
    await expect(group.root).toHaveCount(2);
  });

  test("a group left with one pane gives way to that pane", async({ page }) => {
    const left = new Dock(page, "left");
    for (const label of ["General", "Blocks"]) {
      await dragTo(page, new PaneGroup(page).tab(label), await rightEdgeOf(page));
    }

    await expect(new PaneGroup(left.root).root).toHaveCount(0);
    await expect(left.slots()).resolves.toEqual([["paint"], ["layers"]]);
    await expect(new Pane(page, "paint").title).toHaveText("Paint");
  });

  test("the keyboard takes a tab out of its group and back in", async({ page }) => {
    const left = new Dock(page, "left");
    const announcer = new Pane(page, "blocks").liveRegion;
    await new PaneGroup(page).tab("Blocks").focus();
    await page.keyboard.press(" ");
    await page.keyboard.press("ArrowDown");

    await expect(left.slots())
      .resolves.toEqual([["general", "paint"], ["blocks"], ["layers"]]);
    await expect(announcer).toHaveText("Blocks, left dock, position 2 of 3");

    await page.keyboard.press("Shift+ArrowUp");
    await expect(left.slots())
      .resolves.toEqual([["general", "paint", "blocks"], ["layers"]]);
    await expect(announcer)
      .toHaveText("Blocks, left dock, position 1 of 2, tab 3 of 3");

    await page.keyboard.press("Escape");
    await expect(left.slots())
      .resolves.toEqual([["general", "blocks", "paint"], ["layers"]]);
  });

  test("groups survive a reload and Reset restores the markup", async({ page }) => {
    const group = new PaneGroup(page);
    const left = new Dock(page, "left");
    const right = new Dock(page, "right");
    await group.tab("General").click();
    await dragTo(page, group.tab("Paint"), await rightEdgeOf(page));
    await reloadGallery(page);

    await expect(left.slots())
      .resolves.toEqual([["general", "blocks"], ["layers"]]);
    await expect(right.slots()).resolves.toEqual([["paint"]]);
    await expect(group.selectedTab).toHaveText("General");

    await page.locator("[data-action='reset-layout']").click();
    await expect(left.slots())
      .resolves.toEqual([["general", "blocks", "paint"], ["layers"]]);
    await expect(right.slots()).resolves.toEqual([]);
  });
});
