// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

test.describe("scene controls", () => {
  test("renders a positioned controls card with declarative entries", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/scene-controls",
      chrome: "off"
    });

    const controls = page.locator("jolly-controls");
    await expect(controls).toBeVisible();
    await expect(controls).toHaveAttribute("position", "bottom-left");
    await expect(controls.locator("jolly-control")).toHaveCount(5);
    await expect(controls.locator("kbd").first()).toHaveText("W");

    const bounds = await controls.locator("jolly-control").evaluateAll(
      (entries) => entries.map((entry) => {
        const box = entry.getBoundingClientRect();

        return {
          top: box.top,
          bottom: box.bottom
        };
      })
    );

    expect(bounds[0]?.top).toBe(bounds[1]?.top);
    expect(bounds[1]?.top).toBe(bounds[2]?.top);
    expect(bounds[3]?.top).toBeGreaterThan(bounds[0]?.bottom ?? 0);
  });

  test("reveals an entry description from the information icon", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/scene-controls",
      chrome: "off"
    });

    const control = page.locator("jolly-control").first();
    await control.locator(".details-button").hover();

    await expect.poll(
      () => control.locator(".details").evaluate(
        (element) => element.matches(":popover-open")
      )
    ).toBe(true);

    const [button, details] = await Promise.all([
      control.locator(".details-button").boundingBox(),
      control.locator(".details").boundingBox()
    ]);
    if (button === null || details === null) {
      throw new Error("Information button and tooltip must have layout boxes");
    }

    expect(details.y + details.height).toBeLessThanOrEqual(button.y);
    expect(Math.abs(
      (details.x + (details.width / 2)) - (button.x + (button.width / 2))
    )).toBeLessThanOrEqual(1);
  });

  test("opens an entry description on click", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/scene-controls",
      chrome: "off"
    });

    const control = page.locator("jolly-control").first();
    await control.locator(".details-button").click();

    await expect.poll(
      () => control.locator(".details").evaluate(
        (element) => element.matches(":popover-open")
      )
    ).toBe(true);
  });
});
