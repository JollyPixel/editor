// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";
import { fieldRow as row } from "../support/locators.ts";

/**
 * The label column and its width cap, for a group packed on a shared line.
 */
function labelRatio(
  group: Locator
): Promise<number> {
  return group.evaluate(
    (node) => {
      const label = node.shadowRoot?.querySelector(".label");
      if (label === null || label === undefined) {
        throw new Error("Labelled field must render a label");
      }

      return label.getBoundingClientRect().width /
        node.getBoundingClientRect().width;
    }
  );
}

test.describe("controls: button group naming and width", () => {
  test("names its radio group from aria-label when unlabeled", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/button-group",
      chrome: "off"
    });

    const group = row(page, "jolly-button-group", "default");

    await expect(group.locator(".group")).toHaveAttribute("aria-label", "Tool");

    await group.evaluate((node) => {
      node.setAttribute("aria-label", "Rotation");
      (node as HTMLElement & { label: string; }).label = "";
    });

    await expect(group).toHaveAttribute("unlabeled", "");
    await expect(group.locator(".group")).toHaveAttribute(
      "aria-label",
      "Rotation"
    );
  });

  test("lifts the label cap for a field packed beside another", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/button-group",
      chrome: "off"
    });

    const group = row(page, "jolly-button-group", "default");

    await group.evaluate((node) => {
      (node as HTMLElement & { label: string; }).label = "Rotation mode";
      node.style.setProperty("--jolly-label-width", "auto");
      node.style.width = "120px";
    });

    expect(await labelRatio(group)).toBeLessThanOrEqual(0.46);

    await group.evaluate(
      (node) => node.style.setProperty("--jolly-label-max-width", "none")
    );

    expect(await labelRatio(group)).toBeGreaterThan(0.46);
  });
});
