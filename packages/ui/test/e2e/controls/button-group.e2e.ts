// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator
} from "@playwright/test";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import {
  fieldChanges,
  recordFieldChanges
} from "../support/events.ts";
import { fieldRow as row } from "../support/locators.ts";

// CONSTANTS
const kChecked = '.segment[aria-checked="true"]';

function labelRatio(
  group: Locator
): Promise<number> {
  return group.evaluate((node) => {
    const label = node.shadowRoot?.querySelector(".label");
    if (label === null || label === undefined) {
      throw new Error("Labelled field must render a label");
    }

    return label.getBoundingClientRect().width /
      node.getBoundingClientRect().width;
  });
}

test.describe("controls: button group", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "controls/button-group");
  });

  test("is one tab stop that arrow keys commit through", async({ page }) => {
    await recordFieldChanges(page);

    const group = row(page, "jolly-button-group", "default");
    const focusable = group.locator('.segment[tabindex="0"]');
    await expect(focusable).toHaveCount(1);
    await expect(group.locator(kChecked)).toHaveCount(1);
    await expect(
      row(page, "jolly-button-group", "mixed").locator(kChecked)
    ).toHaveCount(0);

    await focusable.focus();
    await page.keyboard.press("ArrowRight");

    expect(await fieldChanges(page)).toEqual(["paint"]);
  });

  test("names its radio group from aria-label when unlabeled", async({ page }) => {
    const group = row(page, "jolly-button-group", "default");
    await expect(group.locator(".group")).toHaveAttribute("aria-label", "Tool");

    await group.evaluate((node: HTMLElementTagNameMap["jolly-button-group"]) => {
      node.setAttribute("aria-label", "Rotation");
      node.label = "";
    });

    await expect(group).toHaveAttribute("unlabeled", "");
    await expect(group.locator(".group"))
      .toHaveAttribute("aria-label", "Rotation");
  });

  test("hides segment labels but keeps their names when icon-only", async({ page }) => {
    await recordFieldChanges(page);

    const group = row(page, "jolly-button-group", "default");
    const paint = group.getByRole("radio", { name: "Paint" });
    const label = paint.locator(".segment-label");
    await expect(label).toHaveCSS("position", "static");

    await group.evaluate((node: HTMLElementTagNameMap["jolly-button-group"]) => {
      node.iconOnly = true;
    });

    await expect(group).toHaveAttribute("icon-only", "");
    await expect(label).toHaveCSS("position", "absolute");
    expect(await label.evaluate((node) => node.getBoundingClientRect().width))
      .toBeLessThanOrEqual(1);
    await expect(paint.locator("jolly-icon")).toBeVisible();
    await expect(paint).toHaveAttribute("title", "Paint");

    await paint.click();

    expect(await fieldChanges(page)).toEqual(["paint"]);
  });

  test("lifts the label cap for a field packed beside another", async({ page }) => {
    const group = row(page, "jolly-button-group", "default");

    await group.evaluate((node: HTMLElementTagNameMap["jolly-button-group"]) => {
      node.label = "Rotation mode";
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
