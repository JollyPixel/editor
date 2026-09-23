// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator
} from "@playwright/test";
import { boxOf } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";

function isOpen(
  details: Locator
): Promise<boolean> {
  return details.evaluate((element) => element.matches(":popover-open"));
}

test.describe("scene controls", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "controls/scene-controls");
  });

  test("renders a positioned card of declarative entries", async({ page }) => {
    const controls = page.locator("jolly-controls");
    const entries = controls.locator("jolly-control");

    await expect(controls).toBeVisible();
    await expect(controls).toHaveAttribute("position", "bottom-left");
    await expect(entries).toHaveCount(5);
    await expect(controls.locator("kbd").first()).toHaveText("W");

    const boxes = await Promise.all(
      [0, 1, 2, 3].map((index) => boxOf(entries.nth(index)))
    );
    expect(boxes[1].y).toBe(boxes[0].y);
    expect(boxes[2].y).toBe(boxes[0].y);
    expect(boxes[3].y).toBeGreaterThan(boxes[0].y + boxes[0].height);
  });

  test("hovering the information icon reveals the description above it", async({ page }) => {
    const control = page.locator("jolly-control").first();
    const button = control.locator(".details-button");
    const details = control.locator(".details");

    await button.hover();
    await expect.poll(() => isOpen(details)).toBe(true);

    const [buttonBox, detailsBox] = await Promise.all([
      boxOf(button),
      boxOf(details)
    ]);
    expect(detailsBox.y + detailsBox.height).toBeLessThanOrEqual(buttonBox.y);
    expect(Math.abs(
      (detailsBox.x + (detailsBox.width / 2)) -
      (buttonBox.x + (buttonBox.width / 2))
    )).toBeLessThanOrEqual(1);
  });

  test("clicking the information icon opens the description", async({ page }) => {
    const control = page.locator("jolly-control").first();

    await control.locator(".details-button").click();
    await expect.poll(() => isOpen(control.locator(".details"))).toBe(true);
  });
});
