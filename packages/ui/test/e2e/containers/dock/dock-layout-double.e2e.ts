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
import { DOCK_HANDLE_SIZE } from "../../support/dock.ts";

function columnsOf(
  page: Page,
  dock: string
): Promise<string[][][]> {
  return page.locator(`jolly-dock[key='${dock}']`).evaluate((element) => {
    const columns: string[][][] = [[], []];
    for (const child of element.children) {
      const keys = child.tagName === "JOLLY-PANE" ?
        [child.getAttribute("key") ?? ""] :
        [...child.querySelectorAll("jolly-pane")].map(
          (pane) => pane.getAttribute("key") ?? ""
        );
      columns[child.getAttribute("slot") === "secondary" ? 1 : 0].push(keys);
    }

    return columns;
  });
}

async function pastInnerEdge(
  page: Page,
  dock: string
): Promise<Point> {
  const box = await boxOf(page.locator(`jolly-dock[key='${dock}']`));

  return {
    x: dock === "left" ? box.x + box.width + 16 : box.x - 16,
    y: box.y + (box.height / 2)
  };
}

async function openSecondary(
  page: Page
): Promise<void> {
  await dragTo(
    page,
    page.locator("jolly-pane[key='paint'] .header"),
    await pastInnerEdge(page, "left")
  );
  await expect(page.locator("jolly-dock[key='left']")).toHaveAttribute("split");
}

test.describe("DockLayout double docks", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "scenarios/dock-layout-double");
  });

  test("a pane dropped past the inner edge opens a second column", async({ page }) => {
    const left = page.locator("jolly-dock[key='left']");
    const before = await boxOf(left);
    expect(before.width).toBe(200 + DOCK_HANDLE_SIZE);
    await expect(left).not.toHaveAttribute("split");

    await hold(
      page,
      await centerOf(page.locator("jolly-pane[key='paint'] .header")),
      await pastInnerEdge(page, "left"),
      16
    );
    const armed = page.locator(".jolly-drag-zone-armed");
    await expect(armed).toHaveCount(1);
    const preview = await boxOf(armed);
    expect(preview.x).toBeCloseTo(before.x + before.width, 0);
    expect(preview.width).toBe(200);
    await page.mouse.up();

    await expect(left).toHaveAttribute("split");
    await expect.poll(() => widthOf(left)).toBe(400 + DOCK_HANDLE_SIZE);
    await expect(columnsOf(page, "left")).resolves.toEqual([
      [["general", "blocks"], ["layers"]],
      [["paint"]]
    ]);
    await expect(page.locator("jolly-pane[key='paint']")).toBeVisible();
    await expect(page.locator("jolly-pane[key='general']")).toBeVisible();

    const [primary, secondary, handle] = await Promise.all([
      boxOf(left.locator(".primary")),
      boxOf(left.locator(".secondary")),
      boxOf(left.locator(".resize-handle"))
    ]);
    expect(primary.width).toBeCloseTo(secondary.width, 0);
    expect(secondary.x).toBeGreaterThan(primary.x);
    expect(handle.x).toBeCloseTo(before.x + 400, 0);
  });

  test("the resize handle splits the new width between both columns and persists it", async({ page }) => {
    const left = page.locator("jolly-dock[key='left']");
    await openSecondary(page);

    const handle = await boxOf(left.locator(".resize-handle"));
    await dragTo(page, left.locator(".resize-handle"), {
      x: handle.x + (handle.width / 2) + 100,
      y: handle.y + (handle.height / 2)
    });

    await expect.poll(() => widthOf(left)).toBe(500 + DOCK_HANDLE_SIZE);
    await expect.poll(() => widthOf(left.locator(".secondary"))).toBeCloseTo(250, 0);

    await reloadGallery(page);
    await expect(left).toHaveAttribute("split");
    await expect.poll(() => widthOf(left)).toBe(500 + DOCK_HANDLE_SIZE);
    await expect(columnsOf(page, "left")).resolves.toEqual([
      [["general", "blocks"], ["layers"]],
      [["paint"]]
    ]);
  });

  test("the second column closes when its last pane leaves", async({ page }) => {
    const left = page.locator("jolly-dock[key='left']");
    await openSecondary(page);

    const primary = await boxOf(left.locator(".primary"));
    await dragTo(page, page.locator("jolly-pane[key='paint'] .header"), {
      x: primary.x + (primary.width / 2),
      y: primary.y + primary.height - 20
    });

    await expect(left).not.toHaveAttribute("split");
    await expect.poll(() => widthOf(left)).toBe(200 + DOCK_HANDLE_SIZE);
    await expect(columnsOf(page, "left")).resolves.toEqual([
      [["general", "blocks"], ["layers"], ["paint"]],
      []
    ]);
  });

  test("the only pane of a dock offers no second column", async({ page }) => {
    await dragTo(
      page,
      page.locator("jolly-pane[key='inspector'] .header"),
      await pastInnerEdge(page, "right")
    );
    await expect(page.locator("jolly-dock[key='right']")).toHaveAttribute("split");

    await dragTo(
      page,
      page.locator("jolly-pane[key='assets'] .header"),
      await pastInnerEdge(page, "right")
    );
    await expect(columnsOf(page, "right")).resolves.toEqual([
      [["inspector"]],
      []
    ]);
    await expect(page.locator("jolly-dock[key='right']")).not.toHaveAttribute("split");
  });

  test("a right dock opens its second column toward the viewport", async({ page }) => {
    const right = page.locator("jolly-dock[key='right']");
    const before = await boxOf(right);
    await dragTo(
      page,
      page.locator("jolly-pane[key='assets'] .header"),
      await pastInnerEdge(page, "right")
    );

    await expect(right).toHaveAttribute("split");
    await expect.poll(() => widthOf(right)).toBe(360 + DOCK_HANDLE_SIZE);
    const [primary, secondary, handle] = await Promise.all([
      boxOf(right.locator(".primary")),
      boxOf(right.locator(".secondary")),
      boxOf(right.locator(".resize-handle"))
    ]);
    expect(secondary.x).toBeLessThan(primary.x);
    expect(primary.x + primary.width).toBeCloseTo(before.x + before.width, 0);
    expect(handle.x + handle.width).toBeCloseTo(secondary.x, 0);
  });

  test("collapsing hides both columns", async({ page }) => {
    const left = page.locator("jolly-dock[key='left']");
    await openSecondary(page);

    await left.locator(".resize-handle").dblclick();
    await expect(left).toHaveAttribute("collapsed");
    await expect.poll(() => widthOf(left)).toBe(DOCK_HANDLE_SIZE);
    await expect(page.locator("jolly-pane[key='paint']")).toBeHidden();

    await left.locator(".resize-handle").dblclick();
    await expect.poll(() => widthOf(left)).toBe(400 + DOCK_HANDLE_SIZE);
  });

  test("the keyboard steps a pane through the second column", async({ page }) => {
    const grip = page.locator("jolly-pane[key='layers'] .grip");
    const announcer = page.locator("jolly-pane[key='layers'] .live-region");

    await grip.focus();
    await grip.press(" ");
    await grip.press("ArrowRight");
    await expect(columnsOf(page, "left")).resolves.toEqual([
      [["general", "blocks"], ["paint"]],
      [["layers"]]
    ]);
    await expect(announcer)
      .toHaveText("Layers, left dock, second column, position 1 of 1");

    await grip.press("ArrowRight");
    await expect(columnsOf(page, "right")).resolves.toEqual([
      [["inspector"], ["assets"]],
      [["layers"]]
    ]);

    await grip.press("Escape");
    await expect(columnsOf(page, "left")).resolves.toEqual([
      [["general", "blocks"], ["paint"], ["layers"]],
      []
    ]);
  });
});
