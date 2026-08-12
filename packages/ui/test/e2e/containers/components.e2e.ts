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
import {
  boxOf,
  dragTo
} from "../support/pointer.ts";

test.describe("Dock", () => {
  test("keyboard resizing and both collapse inputs share the host", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/dock",
      chrome: "off"
    });

    const dock = page.locator("jolly-dock");
    const handle = dock.locator(".resize-handle");
    const initial = await dock.evaluate((element) => element.getBoundingClientRect().width);

    await handle.focus();
    await handle.press("ArrowLeft");
    await expect.poll(
      () => dock.evaluate((element) => element.getBoundingClientRect().width)
    ).toBe(initial + 8);

    await handle.dblclick();
    await expect(dock).toHaveAttribute("collapsed");
    await handle.press("Enter");
    await expect(dock).not.toHaveAttribute("collapsed");
  });

  test("uses flush panes and the pixel editor resize grip", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/dock",
      chrome: "off"
    });

    const dock = page.locator("jolly-dock");
    const pane = dock.locator("jolly-pane");
    const handle = dock.locator(".resize-handle");

    await expect(dock).toHaveAttribute("side", "right");
    expect(
      await dock.evaluate((element) => element.style.marginInlineStart)
    ).toBe("auto");
    await expect.poll(
      () => pane.evaluate((element) => getComputedStyle(element).borderRadius)
    ).toBe("0px");
    expect(
      await handle.evaluate((element) => getComputedStyle(element, "::after")
        .backgroundImage)
    ).toContain("radial-gradient");
    await expect(handle).toHaveCSS("width", "4px");

    const colors = await handle.evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = "var(--jolly-dock-resize-bg)";
      element.append(probe);
      const values = {
        handle: getComputedStyle(element).backgroundColor,
        token: getComputedStyle(probe).backgroundColor
      };
      probe.remove();

      return values;
    });
    expect(colors.handle).toBe(colors.token);
    await handle.hover();
    await expect.poll(
      () => handle.evaluate((element) => getComputedStyle(element).backgroundColor)
    ).not.toBe(colors.handle);
  });
});

test.describe("Pane", () => {
  test("uses a larger left-origin pixel pattern", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor",
      chrome: "off"
    });

    const header = page.locator("jolly-pane > .header").first();
    const title = header.locator(".title");
    const colors = await header.evaluate((element) => {
      const accentProbe = document.createElement("span");
      const textProbe = document.createElement("span");
      accentProbe.style.backgroundColor = "var(--jolly-accent-fill)";
      textProbe.style.color = "var(--jolly-text-on-fill)";
      element.append(accentProbe, textProbe);
      const values = {
        accent: getComputedStyle(accentProbe).backgroundColor,
        background: getComputedStyle(element).backgroundColor,
        foreground: getComputedStyle(element).color,
        textOnFill: getComputedStyle(textProbe).color
      };
      accentProbe.remove();
      textProbe.remove();

      return values;
    });
    const pattern = await header.evaluate((element) => {
      const style = getComputedStyle(element, "::before");

      return {
        backgroundImage: style.backgroundImage,
        color: style.color,
        insetInlineStart: style.insetInlineStart,
        maskImage: style.maskImage,
        opacity: style.opacity
      };
    });

    expect(pattern.backgroundImage).toContain("conic-gradient");
    expect(pattern.color).toBe(colors.textOnFill);
    expect(pattern.insetInlineStart).toBe("0px");
    expect(pattern.maskImage).toContain("linear-gradient");
    expect(pattern.opacity).toBe("0.07");
    expect(colors.background).toBe(colors.accent);
    expect(colors.foreground).toBe(colors.textOnFill);
    await expect(title).toHaveCSS("font-weight", "600");
    await expect(title).toHaveCSS("letter-spacing", "0.88px");
  });
});

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
    const controlFill = await inspector.locator("jolly-number input")
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

    // The order is previewed, not applied, so nothing slides under the hand.
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(1);
    await expect(folders.first()).toHaveAttribute("dragging");

    // The line is neutral and haloed, the same treatment panes get. An accent
    // line would land a blue bar directly under a blue pane header.
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
    // The neutral ramp is a cool grey, so an ink line separates its channels a
    // little; the accent separates them several times as far. Half the header's
    // separation sits well clear of both.
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
    // Both fold to their header, so both point down open and right when shut.
    // Read as a matrix, since either one alone proves nothing about the pair.
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
    // The example sets "label" as a property, so only an explicit reassignment
    // carries it across a clone that copies attributes alone.
    await expect(ghost.locator(".toggle")).toHaveText("Transform");
    // The chevron and grip come along, which a label chip never carried.
    await expect(ghost.locator(".chevron")).toHaveCount(1);
    await expect(ghost.locator(".grip")).toHaveCount(1);
    // Emptied and clipped, so it reduces to the header it stands for, while
    // still reading as open exactly as the folder it was taken from does.
    await expect(ghost).toHaveAttribute("open");
    await expect.poll(
      () => ghost.evaluate((element) => element.children.length)
    ).toBe(0);

    const carried = await boxOf(ghost);
    const sourceHeader = await boxOf(folders.first().locator(".header"));
    expect(carried.width).toBeCloseTo(source.width, 0);
    expect(carried.height).toBeCloseTo(sourceHeader.height, 0);

    // Its own header fill, which resolves only from the copied theme. A folder
    // wash is nothing like the flat accent the chip used to paint. Compared
    // against an untouched sibling, out of reach of hover and drag state.
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

test.describe("Tabs", () => {
  test("automatically activates with arrows and skips disabled tabs", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/tabs",
      chrome: "off"
    });

    const tabs = page.locator("jolly-tabs [role=tab]");
    await tabs.first().focus();
    await tabs.first().press("ArrowRight");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await tabs.nth(1).press("ArrowRight");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("Rail", () => {
  test("shows both layout orientations", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/rail",
      chrome: "off"
    });

    const rails = page.locator("jolly-rail");
    await expect(rails).toHaveCount(2);
    await expect(rails.first()).toHaveAttribute("orientation", "vertical");
    await expect(rails.last()).toHaveAttribute("orientation", "horizontal");
  });
});

test.describe("Floating", () => {
  test("moves, clamps, and resizes through the supplied handles", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/floating",
      chrome: "off"
    });

    const floating = page.locator("jolly-floating");
    const title = floating.locator("jolly-pane .title");
    const titleBox = await title.boundingBox();
    if (titleBox === null) {
      throw new Error("Floating title did not render");
    }

    await page.mouse.move(titleBox.x + 5, titleBox.y + 5);
    await page.mouse.down();
    await page.mouse.move(-100, -100);
    await page.mouse.up();
    await expect(floating).toHaveAttribute("x", "0");
    await expect(floating).toHaveAttribute("y", "0");

    const width = await floating.evaluate((element) => element.getBoundingClientRect().width);
    const handle = floating.locator(".resize-handle.right");
    await handle.focus();
    await handle.press("ArrowRight");
    await expect.poll(
      () => floating.evaluate((element) => element.getBoundingClientRect().width)
    ).toBe(width + 8);
  });
});

test.describe("Placement", () => {
  test("the floating pane docks into either side and comes back out", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/dock-resize",
      chrome: "off"
    });

    const stage = page.locator(".placement-stage");
    await expect(stage.locator("jolly-dock-layout")).toHaveCount(1);
    const header = page.locator("jolly-pane[key='floating'] .header");
    const viewport = await boxOf(page.locator(".placement-viewport"));

    for (const side of ["left", "right"] as const) {
      const box = await boxOf(page.locator(`jolly-dock[side='${side}']`));
      await dragTo(page, header, {
        x: box.x + (box.width / 2),
        y: box.y + box.height - 60
      });
      await expect(
        page.locator(`jolly-dock[side='${side}'] jolly-pane[key='floating']`)
      ).toHaveCount(1);
      await expect(page.locator("jolly-floating")).toHaveCount(0);

      // Back out to the viewport, so the next side is entered from a window
      // again rather than across the dock the pane now sits in.
      await dragTo(page, header, {
        x: viewport.x + (viewport.width / 2),
        y: viewport.y + 160
      });
      await expect(
        page.locator("jolly-floating jolly-pane[key='floating']")
      ).toHaveCount(1);
    }
  });

  test("the docked panes are locked in place", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/dock-resize",
      chrome: "off"
    });

    for (const key of ["left", "right"]) {
      const pane = page.locator(`jolly-pane[key='${key}']`);
      await expect(pane).toHaveAttribute("locked");
      await expect(pane).not.toHaveAttribute("movable");
      await expect(pane.locator(".grip")).toHaveCount(0);
    }
    await expect(page.locator("jolly-pane[key='floating']")).toHaveAttribute(
      "movable"
    );

    // Its header is inert too, so the dock cannot be emptied by dragging.
    const viewport = await boxOf(page.locator(".placement-viewport"));
    await dragTo(page, page.locator("jolly-pane[key='left'] .header"), {
      x: viewport.x + (viewport.width / 2),
      y: viewport.y + 200
    });
    await expect(page.locator("jolly-floating")).toHaveCount(1);
    await expect(
      page.locator("jolly-dock[side='left'] jolly-pane[key='left']")
    ).toHaveCount(1);
  });

  test("a stored snapshot cannot strand a locked pane in a window", async({ page }) => {
    // A snapshot written before the pane was locked, or by an older build:
    // the pane it floats has no grip, so nothing could drag it home again.
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("gallery-example:placement", JSON.stringify({
        v: 1,
        docks: {
          left: { size: 240, collapsed: false, panes: [] },
          right: { size: 240, collapsed: false, panes: ["right"] }
        },
        floating: {
          left: { x: 700, y: 600, width: 280, height: 220 }
        },
        panes: {}
      }));
    });
    await gotoGallery(page, {
      example: "scenarios/dock-resize",
      chrome: "off"
    });

    await expect(
      page.locator("jolly-dock[side='left'] jolly-pane[key='left']")
    ).toHaveCount(1);
    await expect(page.locator("jolly-floating")).toHaveCount(1);
  });

  test("both docks fill the stage height", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/dock-resize",
      chrome: "off"
    });

    const stage = await boxOf(page.locator(".placement-stage"));
    for (const side of ["left", "right"]) {
      const dock = await boxOf(page.locator(`jolly-dock[side='${side}']`));
      // The stage adds a one pixel border on each edge.
      expect(dock.height).toBe(stage.height - 2);
    }
  });
});

test.describe("Dialog", () => {
  test("native Escape dismisses a declarative dialog", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/dialog",
      chrome: "off",
      theme: "dark"
    });

    await expect(page.locator("main > .chrome-row > jolly-button"))
      .toHaveCount(3);
    await page.getByRole("button", { name: "Open dialog" }).click();
    const dialog = page.locator("jolly-dialog dialog");
    await expect(dialog).toHaveAttribute("open");
    const host = page.locator("main jolly-dialog");
    await expect(host).toHaveAttribute("theme", "dark");
    await expect(host.locator(":scope > jolly-button"))
      .toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toHaveAttribute("open");
  });

  test("helpers settle, trim prompts, and remove themselves", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/dialog",
      chrome: "off",
      theme: "dark"
    });

    const example = page.locator("main > div");
    await page.locator("[data-action=prompt-helper]").click();
    const prompt = page.locator("body > jolly-dialog");
    await expect(prompt).toHaveAttribute("theme", "dark");
    await expect(prompt.locator("jolly-text")).toHaveCount(1);
    await expect(prompt.locator("jolly-button")).toHaveCount(2);
    await prompt.locator("input").fill("  Layer  ");
    await prompt.locator("jolly-button[data-action=confirm]").click();
    await expect(example).toHaveAttribute("data-result", "Layer");
    await expect(prompt).toHaveCount(0);

    await page.locator("[data-action=confirm-helper]").click();
    const confirm = page.locator("body > jolly-dialog");
    await page.keyboard.press("Escape");
    await expect(example).toHaveAttribute("data-result", "false");
    await expect(confirm).toHaveCount(0);
  });
});

/**
 * How far a colour separates its channels, which is how far it is from a grey.
 *
 * Measured by painting into a canvas rather than by parsing the computed
 * string: these colours come out of `color-mix` and `light-dark`, which the
 * browser is free to serialize as `color(srgb ...)` or `oklab(...)`, and no
 * one parser survives that. A canvas gives sRGB bytes whatever the notation,
 * and composites the alpha away against black while it is at it.
 */
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

/**
 * The chevron's settled rotation in degrees, read off the computed matrix so
 * the two containers are compared by what they paint rather than by how they
 * say it. Both chevrons transition, and the computed transform interpolates
 * while they do, so the running animation has to be waited out first.
 */
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
