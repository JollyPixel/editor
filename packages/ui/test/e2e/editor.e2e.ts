// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "./utils.ts";

test.describe("editor examples", () => {
  test("Inspector sliders share a value edge with presence", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor-states",
      chrome: "off"
    });

    const sliders = page.locator("jolly-slider");
    const metalness = sliders.filter({ hasText: "Metalness" });
    const emission = sliders.filter({ hasText: "Emission" });
    const valueRights = await Promise.all([
      metalness.locator(".value").evaluate(
        (node) => node.getBoundingClientRect().right
      ),
      emission.locator(".value").evaluate(
        (node) => node.getBoundingClientRect().right
      )
    ]);

    expect(valueRights[0]).toBe(valueRights[1]);
  });

  test("Floating sliders align across optional revert chrome", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor",
      chrome: "off"
    });

    const sliders = page.locator("jolly-floating jolly-slider");
    const valueRights = await sliders.locator(".value").evaluateAll(
      (nodes) => nodes.map((node) => node.getBoundingClientRect().right)
    );

    await expect(sliders.first().locator(".revert")).toHaveCount(1);
    await expect(sliders.last().locator(".revert")).toHaveCount(0);
    expect(valueRights[0]).toBe(valueRights[1]);
  });

  test("Brush Primary color exposes transparency", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor",
      chrome: "off"
    });

    const primary = page.locator("jolly-floating jolly-color");

    await expect(primary).toHaveJSProperty("alpha", true);
    await expect(primary).toHaveJSProperty("value", "#e2b33ccc");
    await expect(primary.locator(".hex")).toHaveValue("#e2b33ccc");
  });
});
