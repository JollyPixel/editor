// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import {
  boxOf,
  centerOf,
  hold
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  openExample,
  reloadGallery
} from "../../support/gallery.ts";
import {
  partStyleOf,
  styleOf
} from "../../support/styles.ts";

// CONSTANTS
const kDefaultOrder = ["Transform", "Material", "Physics"];

function channelSpread(
  page: Page,
  color: string
): Promise<number> {
  return page.evaluate((value) => {
    const context = document.createElement("canvas").getContext("2d")!;
    context.fillStyle = "#000";
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;

    return Math.max(red, green, blue) - Math.min(red, green, blue);
  }, color);
}

function chevronAngleOf(
  chevron: Locator
): Promise<number> {
  return chevron.evaluate(async(element) => {
    await Promise.all(element.getAnimations().map(
      (animation) => animation.finished.catch(() => undefined)
    ));

    const { transform } = getComputedStyle(element);
    if (transform === "none") {
      return 0;
    }

    const [a, b] = transform
      .slice(transform.indexOf("(") + 1, -1)
      .split(",")
      .map(Number);

    return Math.round(Math.atan2(b, a) * (180 / Math.PI));
  });
}

function visualOrder(
  folders: Locator
): Promise<string[]> {
  return folders.evaluateAll((elements) => elements
    .map((element) => {
      return {
        label: element.shadowRoot?.querySelector(".toggle")?.textContent ?? "",
        order: element instanceof HTMLElement ? Number(element.style.order) : 0
      };
    })
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.label));
}

test.describe("Folder", () => {
  test("headers open, close and run actions independently", async({ page }) => {
    await openExample(page, "containers/folder");

    const folder = page.locator("jolly-folder");
    const action = folder.locator("jolly-button[data-action=plus]");
    const [header, label, actionBox] = await Promise.all([
      boxOf(folder.locator(".header")),
      boxOf(folder.locator(".toggle .label")),
      boxOf(action)
    ]);
    expect(actionBox.x).toBeGreaterThan(label.x + label.width);
    expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(header.x + header.width);
    expect(actionBox.y).toBeGreaterThanOrEqual(header.y);
    expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(header.y + header.height);

    await expect(folder).toHaveAttribute("open");
    await action.click();
    await expect(action).toHaveAttribute("data-clicks", "1");
    await expect(folder).toHaveAttribute("open");

    await folder.locator(".toggle").click();
    await expect(folder).not.toHaveAttribute("open");
    await action.click();
    await expect(action).toHaveAttribute("data-clicks", "2");
    await expect(folder).not.toHaveAttribute("open");
  });

  test("a non-collapsible folder stays open, toggle-less, aligned like a collapsible", async({ page }) => {
    const folder = page.locator("jolly-folder");

    await openExample(page, "containers/folder");
    await expect(folder.locator(".chevron")).toHaveCount(1);
    const toggleLabel = await boxOf(folder.locator(".toggle .label"));

    await openExample(page, "containers/folder", {
      options: { collapsible: false }
    });
    await expect(folder.locator(".toggle")).toHaveCount(0);
    await expect(folder.locator(".chevron")).toHaveCount(0);
    await expect(folder.locator(".title .label")).toHaveText("Transform");
    await expect(folder.locator("jolly-button[data-action=plus]")).toBeVisible();
    expect((await boxOf(folder.locator(".title .label"))).x).toBe(toggleLabel.x);

    await folder.locator(".header").click();
    await expect(folder).toHaveAttribute("open");
    await expect(folder.locator("p[data-row]")).toBeVisible();
  });

  test("flush folders and a zero indent token drop the content inset", async({ page }) => {
    const outer = page.locator("jolly-folder[data-folder=outer]");
    const row = page.locator("p[data-row]");

    await openExample(page, "containers/folder", {
      options: { nested: true, flush: true }
    });
    await expect(outer.locator(".content").first()).toHaveCSS("padding-left", "0px");
    expect((await boxOf(row)).x).toBe((await boxOf(outer)).x);

    await openExample(page, "containers/folder", {
      options: { nested: true }
    });
    await expect(outer.locator(".content").first()).toHaveCSS("padding-left", "4px");
    await outer.evaluate(
      (element: HTMLElement) => element.style.setProperty("--jolly-folder-indent", "0px")
    );
    expect((await boxOf(row)).x).toBe((await boxOf(outer)).x);
  });

  test("holds a nested field short of the header bar it sits under", async({ page }) => {
    await openExample(page, "scenarios/facade");

    const folder = page.locator("jolly-folder").first();
    const value = folder.locator("jolly-slider input[type=text]");
    const header = await boxOf(folder.locator(".header"));
    const headerRight = header.x + header.width;
    const inset = await boxOf(value);
    expect(headerRight - (inset.x + inset.width)).toBe(4);

    await folder.evaluate(
      (element: HTMLElement) => element.style.setProperty("--jolly-field-inset-end", "0px")
    );
    const flush = await boxOf(value);
    expect(flush.x + flush.width).toBeCloseTo(headerRight, 0);
  });

  test("distinguishes pane, folder, and control fills", async({ page }) => {
    await openExample(page, "scenarios/editor");

    const inspector = page.locator("jolly-dock[side=right]");
    const fills = await Promise.all([
      styleOf(inspector.locator("jolly-pane > .header"), "background-color"),
      styleOf(inspector.locator("jolly-folder > .header").first(), "background-color"),
      styleOf(inspector.locator("jolly-vector3 input").first(), "background-color")
    ]);

    expect(new Set(fills).size).toBe(3);
  });

  test("a folder and a pane turn their chevron the same way", async({ page }) => {
    await openExample(page, "scenarios/dock-layout");

    const pane = page.locator("jolly-pane[key='inspector']");
    const paneOpen = await chevronAngleOf(pane.locator(".chevron"));
    await pane.locator(".fold").click();
    await expect(pane).toHaveAttribute("collapsed");
    const paneShut = await chevronAngleOf(pane.locator(".chevron"));

    await openExample(page, "scenarios/reorder-persist");

    const folder = page.locator("jolly-pane > jolly-folder").first();
    await expect(folder).toHaveAttribute("open");
    const folderOpen = await chevronAngleOf(folder.locator(".chevron"));
    await folder.locator(".toggle").click();
    await expect(folder).not.toHaveAttribute("open");
    const folderShut = await chevronAngleOf(folder.locator(".chevron"));

    expect(paneOpen).not.toBe(paneShut);
    expect(folderOpen).toBe(paneOpen);
    expect(folderShut).toBe(paneShut);
  });
});

test.describe("Folder reorder", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "scenarios/reorder-persist");
  });

  test("headers carry a faded pixel pattern and a light gap", async({ page }) => {
    const folders = page.locator("jolly-pane > jolly-folder");
    const header = folders.first().locator(".header");

    await expect(folders.locator(".folder-mark")).toHaveCount(0);
    await expect(folders.nth(0)).toHaveCSS("margin-block-end", "2px");
    await expect(folders.nth(1)).toHaveCSS("margin-block-end", "2px");
    await expect(folders.nth(2)).toHaveCSS("margin-block-end", "2px");
    expect(await styleOf(header, "background-image", "::after"))
      .toContain("conic-gradient");
    await expect.poll(() => styleOf(header, "opacity", "::after")).toBe("0.08");

    await header.hover();
    await expect.poll(() => styleOf(header, "opacity", "::after")).toBe("0.14");
  });

  test("a pointer drag carries a header replica, draws a neutral line, commits once", async({ page }) => {
    const folders = page.locator("jolly-pane > jolly-folder");
    const source = folders.first();
    const [sourceBox, sourceHeader, target] = await Promise.all([
      boxOf(source),
      boxOf(source.locator(".header")),
      boxOf(folders.nth(2))
    ]);
    const grip = await centerOf(source.locator(".grip"));

    await hold(page, grip, {
      x: grip.x,
      y: target.y + target.height - 2
    });

    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(1);
    await expect(source).toHaveAttribute("dragging");

    const ghost = page.locator(".jolly-drag-overlay > jolly-folder");
    await expect(ghost).toHaveCount(1);
    await expect(ghost.locator(".toggle")).toHaveText("Transform");
    await expect(ghost.locator(".chevron")).toHaveCount(1);
    await expect(ghost.locator(".grip")).toHaveCount(1);
    await expect(ghost).toHaveAttribute("open");
    await expect.poll(
      () => ghost.evaluate((element) => element.children.length)
    ).toBe(0);
    const carried = await boxOf(ghost);
    expect(carried.width).toBeCloseTo(sourceBox.width, 0);
    expect(carried.height).toBeCloseTo(sourceHeader.height, 0);
    expect(await styleOf(ghost.locator(".header"), "background-color"))
      .toBe(await styleOf(folders.nth(1).locator(".header"), "background-color"));

    const line = page.locator(".jolly-drag-insertion");
    const lineFill = await styleOf(line, "background-color");
    const headerFill = await partStyleOf(
      page.locator("jolly-pane").first(),
      ".header",
      "background-color"
    );
    expect(lineFill).not.toBe(headerFill);
    expect(await styleOf(line, "box-shadow")).not.toBe("none");
    expect(await channelSpread(page, lineFill))
      .toBeLessThan(await channelSpread(page, headerFill) / 2);
    await expect.poll(() => visualOrder(folders)).toEqual(kDefaultOrder);

    await page.mouse.up();
    await expect.poll(() => visualOrder(folders))
      .toEqual(["Material", "Physics", "Transform"]);
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
    await expect(source).not.toHaveAttribute("dragging");
  });

  test("a grip click does nothing and a keyboard reorder survives reload", async({ page }) => {
    const folders = page.locator("jolly-pane > jolly-folder");
    const grip = folders.first().locator(".grip");

    await grip.click();
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
    await expect.poll(() => visualOrder(folders)).toEqual(kDefaultOrder);

    await grip.focus();
    await grip.press("Space");
    await grip.press("ArrowDown");
    await grip.press("Space");

    const moved = ["Material", "Transform", "Physics"];
    await expect.poll(() => visualOrder(folders)).toEqual(moved);
    await reloadGallery(page);
    await expect.poll(() => visualOrder(folders)).toEqual(moved);
  });
});
