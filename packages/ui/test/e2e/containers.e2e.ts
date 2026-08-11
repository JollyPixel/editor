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

    const resting = await handle.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    );
    await handle.hover();
    await expect.poll(
      () => handle.evaluate((element) => getComputedStyle(element).backgroundColor)
    ).not.toBe(resting);
  });
});

test.describe("Folder", () => {
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
