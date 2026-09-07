// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  gotoGallery,
  reloadGallery
} from "../support/gallery.ts";
import { boxOf } from "../support/pointer.ts";

test.describe("Folder", () => {
  test("uses a faded pixel pattern in every header", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/reorder-persist",
      chrome: "off"
    });

    const folders = page.locator("jolly-pane > jolly-folder");
    const header = folders.first().locator(".header");

    await expect(folders.locator(".folder-mark")).toHaveCount(0);
    expect(
      await header.evaluate((element) => getComputedStyle(element, "::after")
        .backgroundImage)
    ).toContain("conic-gradient");
    await expect.poll(
      () => header.evaluate((element) => getComputedStyle(element, "::after")
        .opacity)
    ).toBe("0.08");

    await header.hover();
    await expect.poll(
      () => header.evaluate((element) => getComputedStyle(element, "::after")
        .opacity)
    ).toBe("0.14");
  });

  test("adds a light bottom gap between folder groups", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/reorder-persist",
      chrome: "off"
    });

    const margins = await page.locator("jolly-pane > jolly-folder")
      .evaluateAll((folders) => folders.map(
        (folder) => getComputedStyle(folder).marginBlockEnd
      ));

    expect(margins).toEqual(["2px", "2px", "2px"]);
  });

  test("lays header actions out between the label and the grip", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/folder",
      chrome: "off"
    });

    const folder = page.locator("jolly-folder");
    const header = await boxOf(folder.locator(".header"));
    const label = await boxOf(folder.locator(".toggle .label"));
    const action = await boxOf(folder.locator("jolly-button[data-action=plus]"));

    expect(action.x).toBeGreaterThan(label.x + label.width);
    expect(action.x).toBeGreaterThanOrEqual(header.x);
    expect(action.x + action.width).toBeLessThanOrEqual(header.x + header.width);
    expect(action.y).toBeGreaterThanOrEqual(header.y);
    expect(action.y + action.height).toBeLessThanOrEqual(header.y + header.height);
  });

  test("runs a header action without toggling the folder, open or shut", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/folder",
      chrome: "off"
    });

    const folder = page.locator("jolly-folder");
    const action = folder.locator("jolly-button[data-action=plus]");

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

  test("holds a non-collapsible folder open, without a toggle", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/folder-collapsible",
      chrome: "off"
    });

    const pinned = page.locator("jolly-folder[data-folder=pinned]");
    const row = pinned.locator("p[data-row=pinned]");

    await expect(pinned).toHaveAttribute("open");
    await expect(pinned.locator(".toggle")).toHaveCount(0);
    await expect(pinned.locator(".chevron")).toHaveCount(0);
    await expect(pinned.locator(".title .label")).toHaveText("Always open");
    await expect(row).toBeVisible();

    await pinned.locator(".header").click();
    await expect(pinned).toHaveAttribute("open");
    await expect(row).toBeVisible();

    await expect(pinned.locator("jolly-button[data-action=pinned]"))
      .toBeVisible();

    // The missing chevron leaves a gutter, so both labels start together.
    const pinnedLabel = await boxOf(pinned.locator(".title .label"));
    const toggleLabel = await boxOf(
      page.locator("jolly-folder[data-folder=collapsible] .toggle .label")
    );

    expect(pinnedLabel.x).toBe(toggleLabel.x);
  });

  test("keeps the toggle on a collapsible neighbour", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/folder-collapsible",
      chrome: "off"
    });

    const folder = page.locator("jolly-folder[data-folder=collapsible]");

    await expect(folder.locator(".chevron")).toHaveCount(1);
    await folder.locator(".toggle").click();
    await expect(folder).not.toHaveAttribute("open");
    await expect(folder.locator("p[data-row=collapsible]")).toBeHidden();
  });

  test("drops the content inset of a flush folder", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/folder-flush",
      chrome: "off"
    });

    const indented = page.locator("jolly-folder[data-folder=indented]");
    const flush = page.locator("jolly-folder[data-folder=flush]");

    await expect(indented.locator(".content").first())
      .toHaveCSS("padding-left", "4px");
    await expect(flush.locator(".content").first())
      .toHaveCSS("padding-left", "0px");

    const nested = await boxOf(page.locator("p[data-row=flush]"));
    const owner = await boxOf(flush);

    expect(nested.x).toBe(owner.x);
  });

  test("flattens a folder subtree from the indent token", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/folder-flush",
      chrome: "off"
    });

    const indented = page.locator("jolly-folder[data-folder=indented]");
    await indented.evaluate(
      (element: HTMLElement) => element.style.setProperty(
        "--jolly-folder-indent",
        "0px"
      )
    );

    const nested = await boxOf(page.locator("p[data-row=indented]"));
    const owner = await boxOf(indented);

    expect(nested.x).toBe(owner.x);
  });

  test("holds a nested field short of the header bar it sits under", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/facade-parity",
      chrome: "off"
    });

    const folder = page.locator("jolly-folder").first();
    const value = folder.locator("jolly-slider input[type=text]");

    const header = await boxOf(folder.locator(".header"));
    const inset = await boxOf(value);
    expect((header.x + header.width) - (inset.x + inset.width)).toBe(4);

    // Zeroing the token lands the value on the edge the bar already paints to.
    await folder.evaluate(
      (element: HTMLElement) => element.style.setProperty(
        "--jolly-field-inset-end",
        "0px"
      )
    );

    const flush = await boxOf(value);
    expect(flush.x + flush.width).toBeCloseTo(header.x + header.width, 0);
  });

  test("distinguishes pane, folder, and control fills", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor",
      chrome: "off"
    });

    const inspector = page.locator("jolly-dock[side=right]");
    const paneFill = await inspector.locator("jolly-pane > .header")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    const folderFill = await inspector.locator("jolly-folder > .header")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    const controlFill = await inspector.locator("jolly-vector3 input")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor);

    expect(new Set([paneFill, folderFill, controlFill]).size).toBe(3);
  });

  test("pointer reorder previews a target and commits once", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/reorder-persist",
      chrome: "off"
    });

    const folders = page.locator("jolly-pane > jolly-folder");
    const grip = folders.first().locator(".grip");
    const gripBox = await grip.boundingBox();
    const target = await folders.nth(2).boundingBox();
    if (gripBox === null || target === null) {
      throw new Error("Folder geometry did not render");
    }

    await page.mouse.move(
      gripBox.x + (gripBox.width / 2),
      gripBox.y + (gripBox.height / 2)
    );
    await page.mouse.down();
    await page.mouse.move(
      gripBox.x + (gripBox.width / 2),
      target.y + target.height - 2,
      { steps: 12 }
    );

    // Dragging previews the order without moving panes.
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(1);
    await expect(folders.first()).toHaveAttribute("dragging");

    // Use the pane treatment; accent would merge with blue pane headers.
    const painted = await page.locator(".jolly-drag-insertion").evaluate(
      (element) => {
        const style = getComputedStyle(element);

        return {
          fill: style.backgroundColor,
          halo: style.boxShadow
        };
      }
    );
    const headerFill = await page.locator("jolly-pane").first().evaluate(
      (element) => getComputedStyle(
        element.shadowRoot!.querySelector(".header")!
      ).backgroundColor
    );

    expect(painted.fill).not.toBe(headerFill);
    expect(painted.halo).not.toBe("none");
    // Neutral channel spread stays below half the accent header's.
    expect(await channelSpread(page, painted.fill))
      .toBeLessThan(await channelSpread(page, headerFill) / 2);
    await expect.poll(() => visualOrder(folders)).toEqual([
      "Transform",
      "Material",
      "Physics"
    ]);

    await page.mouse.up();
    await expect.poll(() => visualOrder(folders)).toEqual([
      "Material",
      "Physics",
      "Transform"
    ]);
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
    await expect(folders.first()).not.toHaveAttribute("dragging");
  });

  test("a folder and a pane turn their chevron the same way", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/dock-layout",
      chrome: "off"
    });

    const pane = page.locator("jolly-pane[key='inspector']");
    // Both containers point down when open and right when closed.
    await expect(pane).not.toHaveAttribute("collapsed");
    const paneOpen = await chevronAngleOf(pane.locator(".chevron"));
    await pane.locator(".fold").click();
    await expect(pane).toHaveAttribute("collapsed");
    const paneShut = await chevronAngleOf(pane.locator(".chevron"));

    await gotoGallery(page, {
      example: "scenarios/reorder-persist",
      chrome: "off"
    });

    const folder = page.locator("jolly-pane > jolly-folder").first();
    await expect(folder).toHaveAttribute("open");
    const folderOpen = await chevronAngleOf(folder.locator(".chevron"));
    await folder.locator(".toggle").click();
    await expect(folder).not.toHaveAttribute("open");
    const folderShut = await chevronAngleOf(folder.locator(".chevron"));

    expect(paneOpen).toBe(folderOpen);
    expect(paneShut).toBe(folderShut);
    expect(paneOpen).not.toBe(paneShut);
  });

  test("a dragged folder is carried as a replica of its own header", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/reorder-persist",
      chrome: "off"
    });

    const folders = page.locator("jolly-pane > jolly-folder");
    const source = await boxOf(folders.first());
    const grip = await boxOf(folders.first().locator(".grip"));

    await page.mouse.move(
      grip.x + (grip.width / 2),
      grip.y + (grip.height / 2)
    );
    await page.mouse.down();
    await page.mouse.move(
      grip.x + (grip.width / 2),
      grip.y + 80,
      { steps: 12 }
    );

    const ghost = page.locator(".jolly-drag-overlay > jolly-folder");
    await expect(ghost).toHaveCount(1);
    // Property-only labels require explicit cloning.
    await expect(ghost.locator(".toggle")).toHaveText("Transform");
    await expect(ghost.locator(".chevron")).toHaveCount(1);
    await expect(ghost.locator(".grip")).toHaveCount(1);
    // The ghost keeps open state but clips to the empty header.
    await expect(ghost).toHaveAttribute("open");
    await expect.poll(
      () => ghost.evaluate((element) => element.children.length)
    ).toBe(0);

    const carried = await boxOf(ghost);
    const sourceHeader = await boxOf(folders.first().locator(".header"));
    expect(carried.width).toBeCloseTo(source.width, 0);
    expect(carried.height).toBeCloseTo(sourceHeader.height, 0);

    // Compare against an untouched sibling to exclude hover and drag state.
    const fill = await ghost.locator(".header").evaluate(
      (element) => getComputedStyle(element).backgroundColor
    );
    const expected = await folders.nth(1).locator(".header").evaluate(
      (element) => getComputedStyle(element).backgroundColor
    );
    expect(fill).toBe(expected);

    await page.mouse.up();
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
  });

  test("a click on the grip does not reorder", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/reorder-persist",
      chrome: "off"
    });

    const folders = page.locator("jolly-pane > jolly-folder");
    await folders.first().locator(".grip").click();

    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);
    await expect.poll(() => visualOrder(folders)).toEqual([
      "Transform",
      "Material",
      "Physics"
    ]);
  });

  test("keyboard reorder commits and survives reload", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/reorder-persist",
      chrome: "off"
    });

    const folders = page.locator("jolly-pane > jolly-folder");
    const firstGrip = folders.first().locator(".grip");
    await firstGrip.focus();
    await firstGrip.press("Space");
    await firstGrip.press("ArrowDown");
    await firstGrip.press("Space");

    await expect.poll(() => visualOrder(folders)).toEqual([
      "Material",
      "Transform",
      "Physics"
    ]);
    await reloadGallery(page);
    await expect.poll(() => visualOrder(folders)).toEqual([
      "Material",
      "Transform",
      "Physics"
    ]);
  });
});

function channelSpread(
  page: Page,
  color: string
): Promise<number> {
  return page.evaluate(
    (value) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#000";
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;

      return Math.max(red, green, blue) - Math.min(red, green, blue);
    },
    color
  );
}

/** Reads a chevron's settled rotation from its computed transform matrix. */
function chevronAngleOf(
  chevron: Locator
): Promise<number> {
  return chevron.evaluate(
    async(element) => {
      await Promise.all(
        element.getAnimations().map(
          (animation) => animation.finished.catch(() => undefined)
        )
      );

      const { transform } = getComputedStyle(element);
      if (transform === "none") {
        return 0;
      }

      const [a, b] = transform
        .slice(transform.indexOf("(") + 1, -1)
        .split(",")
        .map(Number);

      return Math.round(Math.atan2(b, a) * (180 / Math.PI));
    }
  );
}

async function visualOrder(
  folders: Locator
): Promise<string[]> {
  return folders.evaluateAll((elements) => elements
    .map((element) => {
      if (!(element instanceof HTMLElement)) {
        return {
          label: "",
          order: 0
        };
      }

      return {
        label: element.shadowRoot?.querySelector(".toggle")?.textContent ?? "",
        order: Number(element.style.order)
      };
    })
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.label));
}
