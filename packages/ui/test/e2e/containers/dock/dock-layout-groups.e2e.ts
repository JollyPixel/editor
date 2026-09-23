// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";
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
  openExample,
  reloadGallery
} from "../../support/gallery.ts";
import {
  dropIntoDock,
  slotsOf
} from "../../support/dock.ts";

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
  test.beforeEach(async({ page }) => {
    await openExample(page, "scenarios/dock-layout-groups");
  });

  test("a group shows one pane behind its tabs and a tab click swaps it", async({ page }) => {
    const group = page.locator("jolly-pane-group");
    const visible = page.locator(".dock-layout-visible");

    await expect(group.locator(".tab")).toHaveText(["General", "Blocks", "Paint"]);
    await expect(group.locator(".tab[aria-selected='true']")).toHaveText("Blocks");
    await expect(page.locator("jolly-pane[key='blocks']")).toBeVisible();
    await expect(page.locator("jolly-pane[key='blocks'] .title")).toHaveCount(0);
    await expect(page.locator("jolly-pane[key='paint']")).toBeHidden();
    await expect(visible).toHaveText("blocks layers");

    await group.locator(".tab", { hasText: "Paint" }).click();
    await expect(page.locator("jolly-pane[key='paint']")).toBeVisible();
    await expect(page.locator("jolly-pane[key='blocks']")).toHaveAttribute("inactive");
    await expect(visible).toHaveText("layers paint");
  });

  test("a pane icon leads its tab, its header and its drag ghost", async({ page }) => {
    const general = page.locator("jolly-pane-group .tab", { hasText: "General" });
    const layersHeader = page.locator("jolly-pane[key='layers'] .header");

    await expect(general.locator("jolly-icon")).toHaveAttribute("name", "info");
    await expect(
      page.locator("jolly-pane-group .tab", { hasText: "Blocks" }).locator("jolly-icon")
    ).toHaveCount(0);
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

  test("stretched tabs share the strip and keep their icons when narrow", async({ page }) => {
    const group = page.locator("jolly-pane-group");
    await group.evaluate((element) => {
      const style = document.createElement("style");
      style.textContent = "jolly-pane-group::part(tab) { flex: 1 1 0; }";
      const root = element.getRootNode();
      (root instanceof ShadowRoot ? root : document.head).append(style);
    });

    const strip = await boxOf(group.locator(".tabs"));
    const widths = await group.locator(".tab").evaluateAll(
      (tabs) => tabs.map((tab) => tab.getBoundingClientRect().width)
    );
    expect(widths.reduce((sum, width) => sum + width, 0))
      .toBeGreaterThan(strip.width - (widths.length * 2));
    for (const width of widths) {
      expect(width).toBeCloseTo(widths[0], 0);
    }

    await group.evaluate((element: HTMLElement) => {
      element.style.width = "150px";
    });
    const general = group.locator(".tab", { hasText: "General" });
    await expect.poll(() => widthOf(general)).toBeLessThan(60);
    expect(await widthOf(general.locator("jolly-icon"))).toBeCloseTo(14, 0);
    expect(await general.locator(".label").evaluate(
      (label) => label.scrollWidth > label.clientWidth
    )).toBe(true);
  });

  test("an empty dock previews, takes and gives back its width", async({ page }) => {
    const right = page.locator("jolly-dock[key='right']");
    await expect(right).toHaveAttribute("empty");
    expect(await widthOf(right)).toBe(0);

    await hold(
      page,
      await centerOf(page.locator("jolly-pane[key='layers'] .header")),
      await rightEdgeOf(page),
      16
    );
    const armed = page.locator(".jolly-drag-zone-armed");
    await expect(armed).toHaveCount(1);
    expect((await boxOf(armed)).width).toBe(240);
    await page.mouse.up();

    await expect(right).not.toHaveAttribute("empty");
    await expect.poll(() => widthOf(right)).toBe(240);
    await expect(slotsOf(page, "right")).resolves.toEqual([["layers"]]);

    await dropIntoDock(page, "jolly-pane[key='layers'] .header", "left", 20);
    await expect(right).toHaveAttribute("empty");
    await expect.poll(() => widthOf(right)).toBe(0);
  });

  test("an empty dock shows no resize handle and cannot be collapsed", async({ page }) => {
    const right = page.locator("jolly-dock[key='right']");
    await right.evaluate((dock) => dock.setAttribute("collapsible", ""));
    await expect(right.locator(".resize-handle")).toBeHidden();

    await right.locator(".resize-handle").dispatchEvent("dblclick");
    await expect(right).not.toHaveAttribute("collapsed");
  });

  test("a pane dropped into a collapsed dock opens it", async({ page }) => {
    const right = page.locator("jolly-dock[key='right']");
    await right.evaluate((dock) => dock.setAttribute("collapsible", ""));
    await dragTo(
      page,
      page.locator("jolly-pane[key='layers'] .header"),
      await rightEdgeOf(page)
    );
    await right.locator(".resize-handle").dblclick();
    await expect(right).toHaveAttribute("collapsed");

    const edge = await boxOf(right);
    await dragTo(
      page,
      page.locator("jolly-pane-group .tab", { hasText: "Paint" }),
      {
        x: edge.x - 8,
        y: edge.y + (edge.height / 2)
      }
    );

    await expect(slotsOf(page, "right")).resolves.toEqual([["layers"], ["paint"]]);
    await expect(right).not.toHaveAttribute("collapsed");
    await expect.poll(() => widthOf(right)).toBe(240);
  });

  test("a tab dropped into another dock takes its own slot", async({ page }) => {
    await dragTo(
      page,
      page.locator("jolly-pane-group .tab", { hasText: "Paint" }),
      await rightEdgeOf(page)
    );

    const paint = page.locator("jolly-pane[key='paint']");
    await expect(slotsOf(page, "right")).resolves.toEqual([["paint"]]);
    await expect(slotsOf(page, "left"))
      .resolves.toEqual([["general", "blocks"], ["layers"]]);
    await expect(paint).not.toHaveAttribute("grouped");
    await expect(paint).toBeVisible();
    await expect(page.locator(".dock-layout-visible"))
      .toHaveText("blocks layers paint");
  });

  test("a hidden tab floats at its declared size, else at its group size", async({ page }) => {
    const group = await boxOf(page.locator("jolly-pane-group"));
    const viewport = await centerOf(page.locator(".dock-layout-viewport"));

    await dragTo(page, page.locator("jolly-pane-group .tab", { hasText: "Paint" }), viewport);
    const declared = await boxOf(
      page.locator("jolly-floating:has(jolly-pane[key='paint'])")
    );
    expect(declared.width).toBeCloseTo(300, 0);
    expect(declared.height).toBeCloseTo(420, 0);

    await dragTo(page, page.locator("jolly-pane-group .tab", { hasText: "General" }), {
      x: viewport.x - 200,
      y: viewport.y
    });
    const inherited = await boxOf(
      page.locator("jolly-floating:has(jolly-pane[key='general'])")
    );
    expect(inherited.width).toBeCloseTo(group.width, 0);
    expect(inherited.height).toBeCloseTo(group.height, 0);
  });

  test("a pane dropped on a tab strip joins the group as the shown tab", async({ page }) => {
    const strip = await boxOf(page.locator("jolly-pane-group .tabs"));
    await dragTo(page, page.locator("jolly-pane[key='layers'] .header"), {
      x: strip.x + strip.width - 8,
      y: strip.y + (strip.height / 2)
    });

    await expect(slotsOf(page, "left"))
      .resolves.toEqual([["general", "blocks", "paint", "layers"]]);
    await expect(page.locator("jolly-pane[key='layers']")).toHaveAttribute("grouped");
    await expect(page.locator("jolly-pane-group .tab[aria-selected='true']"))
      .toHaveText("Layers");
  });

  test("a tab dropped on a pane header creates a group", async({ page }) => {
    const header = await boxOf(page.locator("jolly-pane[key='layers'] .header"));
    await dragTo(page, page.locator("jolly-pane-group .tab", { hasText: "General" }), {
      x: header.x + 12,
      y: header.y + (header.height / 2)
    });

    await expect(slotsOf(page, "left"))
      .resolves.toEqual([["blocks", "paint"], ["general", "layers"]]);
    await expect(page.locator("jolly-pane-group")).toHaveCount(2);
  });

  test("a group left with one pane gives way to that pane", async({ page }) => {
    for (const label of ["General", "Blocks"]) {
      await dragTo(
        page,
        page.locator("jolly-pane-group .tab", { hasText: label }),
        await rightEdgeOf(page)
      );
    }

    await expect(page.locator("jolly-dock[key='left'] jolly-pane-group")).toHaveCount(0);
    await expect(slotsOf(page, "left")).resolves.toEqual([["paint"], ["layers"]]);
    await expect(page.locator("jolly-pane[key='paint'] .title")).toHaveText("Paint");
  });

  test("the keyboard takes a tab out of its group and back in", async({ page }) => {
    const announcer = page.locator("jolly-pane[key='blocks'] .live-region");
    await page.locator("jolly-pane-group .tab", { hasText: "Blocks" }).focus();
    await page.keyboard.press(" ");
    await page.keyboard.press("ArrowDown");

    await expect(slotsOf(page, "left"))
      .resolves.toEqual([["general", "paint"], ["blocks"], ["layers"]]);
    await expect(announcer).toHaveText("Blocks, left dock, position 2 of 3");

    await page.keyboard.press("Shift+ArrowUp");
    await expect(slotsOf(page, "left"))
      .resolves.toEqual([["general", "paint", "blocks"], ["layers"]]);
    await expect(announcer)
      .toHaveText("Blocks, left dock, position 1 of 2, tab 3 of 3");

    await page.keyboard.press("Escape");
    await expect(slotsOf(page, "left"))
      .resolves.toEqual([["general", "blocks", "paint"], ["layers"]]);
  });

  test("groups survive a reload and Reset restores the markup", async({ page }) => {
    await page.locator("jolly-pane-group .tab", { hasText: "General" }).click();
    await dragTo(
      page,
      page.locator("jolly-pane-group .tab", { hasText: "Paint" }),
      await rightEdgeOf(page)
    );
    await reloadGallery(page);

    await expect(slotsOf(page, "left"))
      .resolves.toEqual([["general", "blocks"], ["layers"]]);
    await expect(slotsOf(page, "right")).resolves.toEqual([["paint"]]);
    await expect(page.locator("jolly-pane-group .tab[aria-selected='true']"))
      .toHaveText("General");

    await page.locator("[data-action='reset-layout']").click();
    await expect(slotsOf(page, "left"))
      .resolves.toEqual([["general", "blocks", "paint"], ["layers"]]);
    await expect(slotsOf(page, "right")).resolves.toEqual([]);
  });
});
