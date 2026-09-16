// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import {
  openDockLayout,
  paneKeysOf
} from "../../support/dock.ts";

test.describe("DockLayout keyboard", () => {
  test.beforeEach(async({ page }) => {
    await openDockLayout(page);
  });

  test("the grip steps a pane, announces it, and Escape or Space ends the move", async({ page }) => {
    const grip = page.locator("jolly-pane[key='hierarchy'] .grip");
    const announcer = page.locator("jolly-pane[key='hierarchy'] .live-region");

    await grip.focus();
    await grip.press(" ");
    await expect(grip).toHaveAttribute("aria-pressed", "true");
    await grip.press("ArrowDown");
    await expect(paneKeysOf(page, "left"))
      .resolves.toEqual(["inspector", "hierarchy"]);
    await expect(announcer).toHaveText("Hierarchy, left dock, position 2 of 2");

    await grip.press("Escape");
    await expect(paneKeysOf(page, "left"))
      .resolves.toEqual(["hierarchy", "inspector"]);

    await grip.press(" ");
    await grip.press("ArrowDown");
    await grip.press(" ");
    await expect(grip).toHaveAttribute("aria-pressed", "false");
    await expect(paneKeysOf(page, "left"))
      .resolves.toEqual(["inspector", "hierarchy"]);
  });

  test("the right arrow sends a pane to the adjacent dock", async({ page }) => {
    const grip = page.locator("jolly-pane[key='hierarchy'] .grip");
    await grip.focus();
    await grip.press(" ");
    await grip.press("ArrowRight");

    await expect(paneKeysOf(page, "left")).resolves.toEqual(["inspector"]);
    await expect(paneKeysOf(page, "right"))
      .resolves.toEqual(["hud", "hierarchy"]);
  });

  test("the keyboard docks a floating pane and it stays docked", async({ page }) => {
    const grip = page.locator("jolly-floating jolly-pane[key='assets'] .grip");
    await grip.focus();
    await grip.press(" ");
    await grip.press("ArrowLeft");

    await expect(page.locator("jolly-floating")).toHaveCount(0);
    await expect(paneKeysOf(page, "left"))
      .resolves.toEqual(["hierarchy", "inspector", "assets"]);
  });
});
