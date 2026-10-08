// Import Internal Dependencies
import {
  test,
  expect
} from "../../fixtures.ts";
import { Dock } from "../../support/dock.ts";
import { FloatingWindow } from "../../support/floating.ts";
import { Pane } from "../../support/pane.ts";

test.describe("DockLayout keyboard", () => {
  test.use({
    example: "scenarios/dock-layout"
  });

  test("the grip steps a pane, announces it, and Escape or Space ends the move", async({ page }) => {
    const left = new Dock(page, "left");
    const hierarchy = new Pane(page, "hierarchy");
    const grip = hierarchy.grip;

    await grip.focus();
    await grip.press(" ");
    await expect(grip).toHaveAttribute("aria-pressed", "true");
    await grip.press("ArrowDown");
    await expect(left.paneKeys())
      .resolves.toEqual(["inspector", "hierarchy"]);
    await expect(hierarchy.liveRegion).toHaveText("Hierarchy, left dock, position 2 of 2");

    await grip.press("Escape");
    await expect(left.paneKeys())
      .resolves.toEqual(["hierarchy", "inspector"]);

    await grip.press(" ");
    await grip.press("ArrowDown");
    await grip.press(" ");
    await expect(grip).toHaveAttribute("aria-pressed", "false");
    await expect(left.paneKeys())
      .resolves.toEqual(["inspector", "hierarchy"]);
  });

  test("the right arrow sends a pane to the adjacent dock", async({ page }) => {
    const grip = new Pane(page, "hierarchy").grip;
    await grip.focus();
    await grip.press(" ");
    await grip.press("ArrowRight");

    await expect(new Dock(page, "left").paneKeys()).resolves.toEqual(["inspector"]);
    await expect(new Dock(page, "right").paneKeys())
      .resolves.toEqual(["hud", "hierarchy"]);
  });

  test("the keyboard docks a floating pane and it stays docked", async({ page }) => {
    const frame = new FloatingWindow(page);
    const grip = frame.pane("assets").grip;
    await grip.focus();
    await grip.press(" ");
    await grip.press("ArrowLeft");

    await expect(frame.root).toHaveCount(0);
    await expect(new Dock(page, "left").paneKeys())
      .resolves.toEqual(["hierarchy", "inspector", "assets"]);
  });
});
