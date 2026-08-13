// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import {
  open,
  paneKeysOf
} from "../support/dockLayoutFixture.ts";

/*
 * Keyboard-driven moves across `scenarios/dock-layout`: the grip's own
 * grabbed/step/commit cycle, and docking a floating pane by keyboard alone.
 * Pointer-driven reordering lives in `dock-layout-drag.e2e.ts`.
 */
test.describe("DockLayout keyboard", () => {
  test("the keyboard docks a floating pane and it stays docked", async({ page }) => {
    await open(page);

    const grip = page.locator("jolly-floating jolly-pane[key='assets'] .grip");
    await grip.focus();
    await grip.press(" ");
    await grip.press("ArrowLeft");

    // Discarding the emptied window re-runs the host slot change. The sync
    // behind it must see the move, or it reconciles the pane straight back
    // out into a fresh window.
    await expect(page.locator("jolly-floating")).toHaveCount(0);
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "hierarchy",
      "inspector",
      "assets"
    ]);
  });

  test("the grip moves a pane with the keyboard and announces it", async({ page }) => {
    await open(page);

    const grip = page.locator("jolly-pane[key='hierarchy'] .grip");
    await grip.focus();
    await grip.press(" ");
    await expect(grip).toHaveAttribute("aria-pressed", "true");

    await grip.press("ArrowDown");
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "inspector",
      "hierarchy"
    ]);
    await expect(
      page.locator("jolly-pane[key='hierarchy'] .live-region")
    ).toHaveText("Hierarchy, left dock, position 2 of 2");

    await grip.press(" ");
    await expect(grip).toHaveAttribute("aria-pressed", "false");
  });

  test("Escape restores the order a keyboard move started from", async({ page }) => {
    await open(page);

    const grip = page.locator("jolly-pane[key='hierarchy'] .grip");
    await grip.focus();
    await grip.press(" ");
    await grip.press("ArrowDown");
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "inspector",
      "hierarchy"
    ]);

    await grip.press("Escape");
    await expect(paneKeysOf(page, "left")).resolves.toEqual([
      "hierarchy",
      "inspector"
    ]);
  });

  test("the right arrow sends a pane to the adjacent dock", async({ page }) => {
    await open(page);

    const grip = page.locator("jolly-pane[key='hierarchy'] .grip");
    await grip.focus();
    await grip.press(" ");
    await grip.press("ArrowRight");

    await expect(paneKeysOf(page, "left")).resolves.toEqual(["inspector"]);
    await expect(paneKeysOf(page, "right")).resolves.toEqual([
      "hud",
      "hierarchy"
    ]);
  });
});
