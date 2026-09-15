// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../../support/gallery.ts";

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

test.describe("Tab", () => {
  test("keeps a value assigned before its tabs are slotted", async({ page }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") {
        warnings.push(message.text());
      }
    });

    await gotoGallery(page, {
      example: "containers/tab",
      chrome: "off"
    });

    const tabs = page.locator("jolly-tabs [role=tab]");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");
    assert.deepEqual(
      warnings.filter((text) => text.includes("scheduled an update")),
      []
    );
  });
});

test.describe("Tabs (closable)", () => {
  test("emits jolly-tab-close from the close button and middle click", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/tabs-closable",
      chrome: "off"
    });

    const tabs = page.locator("jolly-tabs [role=tab]");
    const closeButtons = page.locator("jolly-tabs [part~=close]");
    await expect(tabs).toHaveCount(3);
    await expect(closeButtons).toHaveCount(3);
    await expect(closeButtons.first()).toHaveAttribute("aria-label", "Close grass");

    await closeButtons.nth(1).click();
    await expect(tabs).toHaveText(["grass", "water"]);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

    await tabs.first().click({ button: "middle" });
    await expect(tabs).toHaveText(["water"]);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  });

  test("a close click does not select the tab", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/tabs-closable",
      chrome: "off"
    });

    const events: string[] = [];
    await page.exposeFunction("recordTabChange", (value: string) => {
      events.push(value);
    });
    await page.locator("jolly-tabs").evaluate((element: HTMLElement) => {
      element.addEventListener(
        "jolly-tab-change",
        (event) => void Reflect.get(window, "recordTabChange")(event.detail.value)
      );
    });

    await page.locator("jolly-tabs [part~=close]").nth(2).click();
    await expect(page.locator("jolly-tabs [role=tab]")).toHaveCount(2);
    assert.deepEqual(events, []);
  });
});

test.describe("Tabs (closable layout)", () => {
  test("renders the close button inside the tab item", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/tabs-closable",
      chrome: "off"
    });

    const item = page.locator("jolly-tabs [part~=tab]").first();
    const close = page.locator("jolly-tabs [part~=close]").first();
    const itemBox = await item.boundingBox();
    const closeBox = await close.boundingBox();
    assert.ok(itemBox !== null && closeBox !== null);
    assert.ok(closeBox.x >= itemBox.x);
    assert.ok(closeBox.x + closeBox.width <= itemBox.x + itemBox.width);
    assert.ok(closeBox.y >= itemBox.y);
    assert.ok(closeBox.y + closeBox.height <= itemBox.y + itemBox.height);
  });

  test("hovering the close button keeps the whole tab highlighted", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/tabs-closable",
      chrome: "off"
    });

    const item = page.locator("jolly-tabs [part~=tab]").nth(1);
    const idle = await item.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    );
    await page.locator("jolly-tabs [part~=close]").nth(1).hover();
    await expect.poll(
      () => item.evaluate(
        (element) => getComputedStyle(element).backgroundColor
      )
    ).not.toBe(idle);
  });
});

test.describe("Tabs (dynamic)", () => {
  test("selects a tab appended in the same update", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/tabs-dynamic",
      chrome: "off"
    });

    const tabs = page.locator("jolly-tabs [role=tab]");
    await expect(tabs).toHaveCount(2);

    await page.locator("#tabs-dynamic-add").click();
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");

    await page.locator("#tabs-dynamic-add").click();
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");
  });
});
