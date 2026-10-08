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
import { Pane } from "../../support/pane.ts";

async function pastInnerEdge(
  page: Page,
  dock: string
): Promise<Point> {
  const box = await boxOf(new Dock(page, dock).root);

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
    new Pane(page, "paint").header,
    await pastInnerEdge(page, "left")
  );
  await expect(new Dock(page, "left").root).toHaveAttribute("split");
}

test.describe("DockLayout double docks", () => {
  test.use({
    example: "scenarios/dock-layout-double"
  });

  test("a pane dropped past the inner edge opens a second column", async({ page }) => {
    const left = new Dock(page, "left");
    const before = await boxOf(left.root);
    expect(before.width).toBe(200 + DOCK_HANDLE_SIZE);
    await expect(left.root).not.toHaveAttribute("split");

    await hold(
      page,
      await centerOf(new Pane(page, "paint").header),
      await pastInnerEdge(page, "left"),
      16
    );
    const armed = page.locator(".jolly-drag-zone-armed");
    await expect(armed).toHaveCount(1);
    const preview = await boxOf(armed);
    expect(preview.x).toBeCloseTo(before.x + before.width, 0);
    expect(preview.width).toBe(200);
    await page.mouse.up();

    await expect(left.root).toHaveAttribute("split");
    await expect.poll(() => widthOf(left.root)).toBe(400 + DOCK_HANDLE_SIZE);
    await expect(left.columns()).resolves.toEqual([
      [["general", "blocks"], ["layers"]],
      [["paint"]]
    ]);
    await expect(new Pane(page, "paint").root).toBeVisible();
    await expect(new Pane(page, "general").root).toBeVisible();

    const [primary, secondary, handle] = await Promise.all([
      boxOf(left.primaryColumn),
      boxOf(left.secondaryColumn),
      boxOf(left.resizeHandle)
    ]);
    expect(primary.width).toBeCloseTo(secondary.width, 0);
    expect(secondary.x).toBeGreaterThan(primary.x);
    expect(handle.x).toBeCloseTo(before.x + 400, 0);
  });

  test("the resize handle splits the new width between both columns and persists it", async({ page }) => {
    const left = new Dock(page, "left");
    await openSecondary(page);

    const handle = await boxOf(left.resizeHandle);
    await dragTo(page, left.resizeHandle, {
      x: handle.x + (handle.width / 2) + 100,
      y: handle.y + (handle.height / 2)
    });

    await expect.poll(() => widthOf(left.root)).toBe(500 + DOCK_HANDLE_SIZE);
    await expect.poll(() => widthOf(left.secondaryColumn)).toBeCloseTo(250, 0);

    await reloadGallery(page);
    await expect(left.root).toHaveAttribute("split");
    await expect.poll(() => widthOf(left.root)).toBe(500 + DOCK_HANDLE_SIZE);
    await expect(left.columns()).resolves.toEqual([
      [["general", "blocks"], ["layers"]],
      [["paint"]]
    ]);
  });

  test("the second column closes when its last pane leaves", async({ page }) => {
    const left = new Dock(page, "left");
    await openSecondary(page);

    const primary = await boxOf(left.primaryColumn);
    await dragTo(page, new Pane(page, "paint").header, {
      x: primary.x + (primary.width / 2),
      y: primary.y + primary.height - 20
    });

    await expect(left.root).not.toHaveAttribute("split");
    await expect.poll(() => widthOf(left.root)).toBe(200 + DOCK_HANDLE_SIZE);
    await expect(left.columns()).resolves.toEqual([
      [["general", "blocks"], ["layers"], ["paint"]],
      []
    ]);
  });

  test("the only pane of a dock offers no second column", async({ page }) => {
    const right = new Dock(page, "right");
    await dragTo(
      page,
      new Pane(page, "inspector").header,
      await pastInnerEdge(page, "right")
    );
    await expect(right.root).toHaveAttribute("split");

    await dragTo(
      page,
      new Pane(page, "assets").header,
      await pastInnerEdge(page, "right")
    );
    await expect(right.columns()).resolves.toEqual([
      [["inspector"]],
      []
    ]);
    await expect(right.root).not.toHaveAttribute("split");
  });

  test("a right dock opens its second column toward the viewport", async({ page }) => {
    const right = new Dock(page, "right");
    const before = await boxOf(right.root);
    await dragTo(
      page,
      new Pane(page, "assets").header,
      await pastInnerEdge(page, "right")
    );

    await expect(right.root).toHaveAttribute("split");
    await expect.poll(() => widthOf(right.root)).toBe(360 + DOCK_HANDLE_SIZE);
    const [primary, secondary, handle] = await Promise.all([
      boxOf(right.primaryColumn),
      boxOf(right.secondaryColumn),
      boxOf(right.resizeHandle)
    ]);
    expect(secondary.x).toBeLessThan(primary.x);
    expect(primary.x + primary.width).toBeCloseTo(before.x + before.width, 0);
    expect(handle.x + handle.width).toBeCloseTo(secondary.x, 0);
  });

  test("collapsing hides both columns", async({ page }) => {
    const left = new Dock(page, "left");
    await openSecondary(page);

    await left.resizeHandle.dblclick();
    await expect(left.root).toHaveAttribute("collapsed");
    await expect.poll(() => widthOf(left.root)).toBe(DOCK_HANDLE_SIZE);
    await expect(new Pane(page, "paint").root).toBeHidden();

    await left.resizeHandle.dblclick();
    await expect.poll(() => widthOf(left.root)).toBe(400 + DOCK_HANDLE_SIZE);
  });

  test("the keyboard steps a pane through the second column", async({ page }) => {
    const left = new Dock(page, "left");
    const layers = new Pane(page, "layers");
    const grip = layers.grip;

    await grip.focus();
    await grip.press(" ");
    await grip.press("ArrowRight");
    await expect(left.columns()).resolves.toEqual([
      [["general", "blocks"], ["paint"]],
      [["layers"]]
    ]);
    await expect(layers.liveRegion)
      .toHaveText("Layers, left dock, second column, position 1 of 1");

    await grip.press("ArrowRight");
    await expect(new Dock(page, "right").columns()).resolves.toEqual([
      [["inspector"], ["assets"]],
      [["layers"]]
    ]);

    await grip.press("Escape");
    await expect(left.columns()).resolves.toEqual([
      [["general", "blocks"], ["paint"], ["layers"]],
      []
    ]);
  });
});
