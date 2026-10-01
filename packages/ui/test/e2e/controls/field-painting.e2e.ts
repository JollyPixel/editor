// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";
import {
  fieldRow as row,
  boxOf
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  TRANSPARENT,
  fieldControl as control
} from "../support/field.ts";
import { openExample } from "../support/gallery.ts";
import { styleOf } from "../support/styles.ts";

test.describe("controls: field painting", () => {
  test("step sizes share one stable label column", async({ page }) => {
    await openExample(page, "scenarios/step-sizes");

    const fields = page.locator(
      ".scenario-grid :is(jolly-number, jolly-slider, jolly-range)"
    );
    await expect(fields).toHaveCount(8);
    await expect(fields.first()).toHaveCSS("--jolly-label-width", "10ch");

    const widths = await fields.locator(".label").evaluateAll(
      (labels) => labels.map((label) => label.getBoundingClientRect().width)
    );
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBeGreaterThan(60);
  });

  test("range draws a decorative capped span between its ends", async({ page }) => {
    await openExample(page, "controls/range");

    const range = row(page, "jolly-range", "default");
    const separator = range.locator(".separator");
    const muted = await styleOf(range.locator(".label"), "color");

    await expect(separator).toHaveAttribute("aria-hidden", "true");
    await expect(separator).toHaveText("");
    await expect(separator).toHaveCSS("color", muted);
    await expect(separator).toHaveCSS("border-inline-start-style", "solid");
    await expect(separator).toHaveCSS("border-inline-end-style", "solid");
    expect(await styleOf(separator, "height", "::after")).toBe("1px");
    expect(await styleOf(separator, "background-color", "::after"))
      .toBe(muted);
  });

  test("slider hover recolours the handle without resizing the track", async({ page }) => {
    await openExample(page, "controls/slider");

    const lane = row(page, "jolly-slider", "colored").locator(".lane");
    const restingHeight = await styleOf(lane, "height", "::before");
    const restingFill = await styleOf(lane, "--jolly-slider-thumb-fill");
    const hoverFill = await styleOf(lane, "--jolly-accent-fill-hover");

    await lane.hover();
    await expect.poll(() => styleOf(lane, "--jolly-slider-thumb-fill"))
      .not.toBe(restingFill);
    expect(await styleOf(lane, "--jolly-slider-thumb-fill")).toBe(hoverFill);

    await lane.evaluate((element) => Promise.all(
      element.getAnimations({ subtree: true }).map(
        (animation) => animation.finished
      )
    ));
    expect(await styleOf(lane, "height", "::before")).toBe(restingHeight);
  });

  test("slider value edges stay aligned across field chrome", async({ page }) => {
    await openExample(page, "controls/slider");

    const states = [
      "default",
      "modified",
      "locked",
      "peers",
      "mixed+modified"
    ];
    const boxes = await Promise.all(states.map(
      (state) => boxOf(row(page, "jolly-slider", state).locator(".value"))
    ));
    const edges = boxes.map((box) => box.x + box.width);

    expect(new Set(edges).size).toBe(1);
  });

  test("revert sits flush with its field and hovers to the same fill", async({ page }) => {
    await openExample(page, "controls/number");

    const field = row(page, "jolly-number", "modified");
    const input = control(field);
    const revert = field.locator(".revert");
    const [inputBox, revertBox] = await Promise.all([
      boxOf(input),
      boxOf(revert)
    ]);

    expect(revertBox.height).toBe(inputBox.height);
    expect(revertBox.x).toBe(inputBox.x + inputBox.width);

    const fill = await styleOf(input, "background-color");
    await revert.hover();
    await expect.poll(() => styleOf(revert, "background-color")).toBe(fill);
  });
});

test.describe("controls: theming", () => {
  test("a token backed property follows the theme", async({ page }) => {
    await openExample(page, "controls/number");

    const input = control(page.locator("jolly-number").first());
    const light = await styleOf(input, "background-color");
    expect(light).not.toBe("");

    await page.locator("gallery-root").evaluate(
      (root) => root.setAttribute("theme", "dark")
    );
    await expect.poll(() => styleOf(input, "background-color"))
      .not.toBe(light);
  });

  test("focus overrides the resting control fill", async({ page }) => {
    await openExample(page, "controls/text");

    const input = control(page.locator("jolly-text").first());
    const rest = await styleOf(input, "background-color");
    expect(rest).not.toBe(TRANSPARENT);

    await input.focus();
    await expect.poll(() => styleOf(input, "background-color"))
      .not.toBe(rest);
  });
});
