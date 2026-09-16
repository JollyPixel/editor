// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { openExample } from "../../support/gallery.ts";
import { boxOf } from "../../support/pointer.ts";
import { styleOf } from "../../support/styles.ts";

test.describe("Tabs", () => {
  test("arrows activate automatically and skip disabled tabs", async({ page }) => {
    await openExample(page, "containers/tabs");

    const tabs = page.locator("jolly-tabs [role=tab]");
    await tabs.first().focus();
    await tabs.first().press("ArrowRight");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await tabs.nth(1).press("ArrowRight");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  });

  test("keeps a value assigned before its tabs are slotted", async({ page }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" && message.text().includes("scheduled an update")) {
        warnings.push(message.text());
      }
    });

    await openExample(page, "containers/tab");

    const tabs = page.locator("jolly-tabs [role=tab]");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");
    expect(warnings).toEqual([]);
  });

  test("selects a tab appended in the same update", async({ page }) => {
    await openExample(page, "containers/tabs-dynamic");

    const tabs = page.locator("jolly-tabs [role=tab]");
    const add = page.locator("#tabs-dynamic-add");
    await expect(tabs).toHaveCount(2);

    await add.click();
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");

    await add.click();
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("Tabs (closable)", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "containers/tabs-closable");
  });

  test("the close button and a middle click close without selecting", async({ page }) => {
    const tabs = page.locator("jolly-tabs [role=tab]");
    const close = page.locator("jolly-tabs [part~=close]");
    await page.locator("jolly-tabs").evaluate((element) => {
      element.addEventListener("jolly-tab-change", () => {
        element.dataset.changes = `${Number(element.dataset.changes ?? 0) + 1}`;
      });
    });

    await expect(tabs).toHaveCount(3);
    await expect(close).toHaveCount(3);
    await expect(close.first()).toHaveAttribute("aria-label", "Close grass");

    await close.nth(1).click();
    await expect(tabs).toHaveText(["grass", "water"]);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("jolly-tabs")).not.toHaveAttribute("data-changes");

    await tabs.first().click({ button: "middle" });
    await expect(tabs).toHaveText(["water"]);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  });

  test("the close button sits inside its tab and keeps it highlighted", async({ page }) => {
    const item = page.locator("jolly-tabs [part~=tab]").nth(1);
    const close = page.locator("jolly-tabs [part~=close]").nth(1);
    const [itemBox, closeBox] = await Promise.all([
      boxOf(item),
      boxOf(close)
    ]);

    expect(closeBox.x).toBeGreaterThanOrEqual(itemBox.x);
    expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(itemBox.x + itemBox.width);
    expect(closeBox.y).toBeGreaterThanOrEqual(itemBox.y);
    expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(itemBox.y + itemBox.height);

    const idle = await styleOf(item, "background-color");
    await close.hover();
    await expect.poll(() => styleOf(item, "background-color")).not.toBe(idle);
  });
});
