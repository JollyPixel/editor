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
