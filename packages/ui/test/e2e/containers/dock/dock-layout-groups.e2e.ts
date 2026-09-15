// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  gotoGallery,
  reloadGallery
} from "../../support/gallery.ts";
import {
  boxOf,
  centerOf,
  dragTo,
  widthOf
} from "../../support/pointer.ts";

// CONSTANTS
const kExample = "scenarios/dock-layout-groups";

function open(
  page: Page
): Promise<void> {
  return gotoGallery(page, {
    example: kExample,
    chrome: "off"
  });
}

function slotsOf(
  page: Page,
  dock: string
): Promise<string[][]> {
  return page.locator(`jolly-dock[key='${dock}']`).evaluate(
    (element) => [...element.children].map((child) => {
      if (child.tagName === "JOLLY-PANE") {
        return [child.getAttribute("key") ?? ""];
      }

      return [...child.querySelectorAll("jolly-pane")].map(
        (pane) => pane.getAttribute("key") ?? ""
      );
    })
  );
}

async function rightEdgeOf(
  page: Page
): Promise<{ x: number; y: number; }> {
  const stage = await boxOf(page.locator(".dock-layout-stage"));

  return {
    x: stage.x + stage.width - 12,
    y: stage.y + (stage.height / 2)
  };
}

test.describe("DockLayout groups", () => {
  test("the authored group shows one pane behind its tabs", async({ page }) => {
    await open(page);

    const group = page.locator("jolly-pane-group");
    await expect(group.locator(".tab")).toHaveText([
      "General",
      "Blocks",
      "Paint"
    ]);
    await expect(group.locator(".tab[aria-selected='true']")).toHaveText("Blocks");
    await expect(page.locator("jolly-pane[key='blocks']")).toBeVisible();
    await expect(page.locator("jolly-pane[key='paint']")).toBeHidden();
    await expect(page.locator("jolly-pane[key='blocks'] .title")).toHaveCount(0);
    await expect(page.locator(".dock-layout-visible")).toHaveText("blocks layers");
  });

  test("a tab click shows its pane and reports visibility", async({ page }) => {
    await open(page);

    await page.locator("jolly-pane-group .tab", { hasText: "Paint" }).click();

    await expect(page.locator("jolly-pane[key='paint']")).toBeVisible();
    await expect(page.locator("jolly-pane[key='blocks']")).toHaveAttribute("inactive");
    await expect(page.locator(".dock-layout-visible")).toHaveText("layers paint");
  });

  test("a pane icon leads its tab and its header", async({ page }) => {
    await open(page);

    const general = page.locator("jolly-pane-group .tab", { hasText: "General" });
    await expect(general.locator("jolly-icon")).toHaveAttribute("name", "info");
    await expect(
      page.locator("jolly-pane-group .tab", { hasText: "Blocks" }).locator("jolly-icon")
    ).toHaveCount(0);
    await expect(
      page.locator("jolly-pane[key='layers'] .header jolly-icon.icon")
    ).toHaveAttribute("name", "eye");

    const icon = await boxOf(general.locator("jolly-icon"));
    const label = await boxOf(general.locator(".label"));
    expect(icon.x).toBeLessThan(label.x);
  });

  test("a dragged pane carries its icon in the ghost", async({ page }) => {
    await open(page);

    const from = await centerOf(page.locator("jolly-pane[key='layers'] .header"));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y - 60, { steps: 12 });

    const ghost = page.locator(".jolly-drag-overlay > jolly-pane");
    await expect(ghost.locator("jolly-icon.icon")).toHaveAttribute("name", "eye");

    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("stretched tabs share the strip and keep their icons when narrow", async({ page }) => {
    await open(page);

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
    expect(widths.reduce((sum, width) => sum + width, 0)).toBeGreaterThan(
      strip.width - (widths.length * 2)
    );
    for (const width of widths) {
      expect(width).toBeCloseTo(widths[0], 0);
    }

    await group.evaluate((element) => {
      element.style.width = "150px";
    });
    const general = group.locator(".tab", { hasText: "General" });
    await expect.poll(() => widthOf(general)).toBeLessThan(60);
    expect((await boxOf(general.locator("jolly-icon"))).width).toBeCloseTo(14, 0);
    const clipped = await general.locator(".label").evaluate(
      (label) => label.scrollWidth > label.clientWidth
    );
    expect(clipped).toBe(true);
  });

  test("an empty dock takes no space until a pane lands in it", async({ page }) => {
    await open(page);

    const right = page.locator("jolly-dock[key='right']");
    await expect(right).toHaveAttribute("empty");
    expect(await widthOf(right)).toBe(0);

    await dragTo(
      page,
      page.locator("jolly-pane[key='layers'] .header"),
      await rightEdgeOf(page)
    );

    await expect(right).not.toHaveAttribute("empty");
    await expect.poll(() => widthOf(right)).toBe(240);
    await expect(slotsOf(page, "right")).resolves.toEqual([["layers"]]);

    const left = await boxOf(page.locator("jolly-dock[key='left']"));
    await dragTo(
      page,
      page.locator("jolly-pane[key='layers'] .header"),
      {
        x: left.x + (left.width / 2),
        y: left.y + left.height - 20
      }
    );

    await expect(right).toHaveAttribute("empty");
    await expect.poll(() => widthOf(right)).toBe(0);
  });

  test("an empty dock shows no resize handle and cannot be collapsed", async({ page }) => {
    await open(page);

    const right = page.locator("jolly-dock[key='right']");
    await right.evaluate((dock) => dock.setAttribute("collapsible", ""));
    await expect(right.locator(".resize-handle")).toBeHidden();

    await right.locator(".resize-handle").evaluate((handle) => {
      handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    await expect(right).not.toHaveAttribute("collapsed");
  });

  test("a pane dropped into a collapsed dock opens it", async({ page }) => {
    await open(page);

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

  test("an armed empty dock previews the width it will take", async({ page }) => {
    await open(page);

    const from = await centerOf(page.locator("jolly-pane[key='layers'] .header"));
    const to = await rightEdgeOf(page);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 16 });

    const armed = page.locator(".jolly-drag-zone-armed");
    await expect(armed).toHaveCount(1);
    expect((await boxOf(armed)).width).toBe(240);

    await page.mouse.up();
  });

  test("a tab dropped into another dock takes its own slot", async({ page }) => {
    await open(page);

    await dragTo(
      page,
      page.locator("jolly-pane-group .tab", { hasText: "Paint" }),
      await rightEdgeOf(page)
    );

    await expect(slotsOf(page, "right")).resolves.toEqual([["paint"]]);
    await expect(slotsOf(page, "left")).resolves.toEqual([
      ["general", "blocks"],
      ["layers"]
    ]);
    await expect(page.locator("jolly-pane[key='paint']")).not.toHaveAttribute("grouped");
    await expect(page.locator("jolly-pane[key='paint']")).toBeVisible();
    await expect(page.locator(".dock-layout-visible")).toHaveText("blocks layers paint");
  });

  test("a pane dropped on a tab strip joins the group as the shown tab", async({ page }) => {
    await open(page);

    const strip = await boxOf(page.locator("jolly-pane-group .tabs"));
    await dragTo(
      page,
      page.locator("jolly-pane[key='layers'] .header"),
      {
        x: strip.x + strip.width - 8,
        y: strip.y + (strip.height / 2)
      }
    );

    await expect(slotsOf(page, "left")).resolves.toEqual([
      ["general", "blocks", "paint", "layers"]
    ]);
    await expect(page.locator("jolly-pane[key='layers']")).toHaveAttribute("grouped");
    await expect(
      page.locator("jolly-pane-group .tab[aria-selected='true']")
    ).toHaveText("Layers");
  });

  test("a tab dropped on a pane header creates a group", async({ page }) => {
    await open(page);

    const header = await boxOf(page.locator("jolly-pane[key='layers'] .header"));
    await dragTo(
      page,
      page.locator("jolly-pane-group .tab", { hasText: "General" }),
      {
        x: header.x + 12,
        y: header.y + (header.height / 2)
      }
    );

    await expect(slotsOf(page, "left")).resolves.toEqual([
      ["blocks", "paint"],
      ["general", "layers"]
    ]);
    await expect(page.locator("jolly-pane-group")).toHaveCount(2);
  });

  test("a group left with one pane gives way to that pane", async({ page }) => {
    await open(page);

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
    await open(page);

    const tab = page.locator("jolly-pane-group .tab", { hasText: "Blocks" });
    await tab.focus();
    await page.keyboard.press(" ");
    await page.keyboard.press("ArrowDown");

    await expect(slotsOf(page, "left")).resolves.toEqual([
      ["general", "paint"],
      ["blocks"],
      ["layers"]
    ]);
    await expect(
      page.locator("jolly-pane[key='blocks'] .live-region")
    ).toHaveText("Blocks, left dock, position 2 of 3");

    await page.keyboard.press("Shift+ArrowUp");
    await expect(slotsOf(page, "left")).resolves.toEqual([
      ["general", "paint", "blocks"],
      ["layers"]
    ]);
    await expect(
      page.locator("jolly-pane[key='blocks'] .live-region")
    ).toHaveText("Blocks, left dock, position 1 of 2, tab 3 of 3");

    await page.keyboard.press("Escape");
    await expect(slotsOf(page, "left")).resolves.toEqual([
      ["general", "blocks", "paint"],
      ["layers"]
    ]);
  });

  test("groups survive a reload and Reset restores the markup", async({ page }) => {
    await open(page);

    await page.locator("jolly-pane-group .tab", { hasText: "General" }).click();
    await dragTo(
      page,
      page.locator("jolly-pane-group .tab", { hasText: "Paint" }),
      await rightEdgeOf(page)
    );
    await reloadGallery(page);

    await expect(slotsOf(page, "left")).resolves.toEqual([
      ["general", "blocks"],
      ["layers"]
    ]);
    await expect(slotsOf(page, "right")).resolves.toEqual([["paint"]]);
    await expect(
      page.locator("jolly-pane-group .tab[aria-selected='true']")
    ).toHaveText("General");

    await page.locator("[data-action='reset-layout']").click();
    await expect(slotsOf(page, "left")).resolves.toEqual([
      ["general", "blocks", "paint"],
      ["layers"]
    ]);
    await expect(slotsOf(page, "right")).resolves.toEqual([]);
  });
});
