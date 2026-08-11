// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "./utils.ts";

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
    await page.reload();
    await page.waitForFunction(() => window.__galleryReady === true);
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
