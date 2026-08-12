// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

test.describe("checkbox background activation", () => {
  test("clicking away from the native box activates it", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });

    const field = page.locator(
      '[data-state="default"] jolly-checkbox'
    );
    const target = field.locator(".checkbox");
    const input = field.locator('input[type="checkbox"]');
    const [targetBox, inputBox] = await Promise.all([
      target.boundingBox(),
      input.boundingBox()
    ]);
    if (targetBox === null || inputBox === null) {
      throw new Error("Checkbox hit targets must have layout boxes");
    }

    expect(targetBox.width).toBeGreaterThan(inputBox.width);
    const checkbox = field.locator(".checkbox");
    const resting = await checkbox.evaluate(
      (element) => getComputedStyle(element, "::before").backgroundImage
    );
    await target.hover();
    await expect.poll(
      () => checkbox.evaluate(
        (element) => getComputedStyle(element, "::before").backgroundImage
      )
    ).not.toBe(resting);
    await target.click({
      position: {
        x: targetBox.width - 2,
        y: targetBox.height / 2
      }
    });

    await expect(input).toBeChecked();
  });

  test("the expanded background remains opt-in", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });

    const field = page.locator(
      '[data-state="default"] jolly-checkbox'
    );
    expect(
      await field.evaluate(
        () => document.createElement("jolly-checkbox").clickableBackground
      )
    ).toBe(false);

    await field.evaluate((element) => {
      element.removeAttribute("clickable-background");
    });
    await expect(field.locator(".checkbox"))
      .not.toHaveCSS("position", "relative");
    const [valueLeft, inputLeft] = await Promise.all([
      field.locator(".value")
        .evaluate((element) => element.getBoundingClientRect().left),
      field.locator('input[type="checkbox"]')
        .evaluate((element) => element.getBoundingClientRect().left)
    ]);

    expect(inputLeft).toBe(valueLeft);
  });

  test("alignment reverses one consistently sized gradient", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });

    const field = page.locator(
      '[data-state="default"] jolly-checkbox'
    );
    const value = field.locator(".value");
    const start = await value.evaluate((element) => {
      const input = element.querySelector('input[type="checkbox"]');

      return {
        background: getComputedStyle(
          element.querySelector(".checkbox")!,
          "::before"
        ).backgroundImage,
        inputLeft: input?.getBoundingClientRect().left ?? 0,
        left: element.getBoundingClientRect().left,
        width: element.getBoundingClientRect().width
      };
    });

    await field.evaluate((element) => {
      element.setAttribute("align", "end");
    });
    const end = await value.evaluate((element) => {
      const input = element.querySelector('input[type="checkbox"]');

      return {
        background: getComputedStyle(
          element.querySelector(".checkbox")!,
          "::before"
        ).backgroundImage,
        inputRight: input?.getBoundingClientRect().right ?? 0,
        right: element.getBoundingClientRect().right,
        width: element.getBoundingClientRect().width
      };
    });

    expect(end.width).toBe(start.width);
    expect(end.background).not.toBe(start.background);
    expect(start.inputLeft - start.left).toBe(4);
    expect(end.right - end.inputRight).toBe(4);
  });

  test("the gradient leaves a vertical inset", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });

    const checkbox = page.locator(
      '[data-state="default"] jolly-checkbox .checkbox'
    );

    const inset = await checkbox.evaluate((element) => {
      const style = getComputedStyle(element, "::before");

      return {
        bottom: style.bottom,
        top: style.top
      };
    });

    expect(inset).toEqual({ bottom: "2px", top: "2px" });
  });

  test("the strong gradient edge is rounded", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });

    const field = page.locator(
      '[data-state="default"] jolly-checkbox'
    );
    const checkbox = field.locator(".checkbox");
    function radii() {
      return checkbox.evaluate((element) => {
        const style = getComputedStyle(element, "::before");

        return {
          bottomLeft: style.borderBottomLeftRadius,
          bottomRight: style.borderBottomRightRadius,
          topLeft: style.borderTopLeftRadius,
          topRight: style.borderTopRightRadius
        };
      });
    }

    await expect.poll(radii).toEqual({
      bottomLeft: "2px",
      bottomRight: "0px",
      topLeft: "2px",
      topRight: "0px"
    });

    await field.evaluate((element) => element.setAttribute("align", "end"));
    await expect.poll(radii).toEqual({
      bottomLeft: "0px",
      bottomRight: "2px",
      topLeft: "0px",
      topRight: "2px"
    });
  });

  test("Editors scenarios opt every checkbox into the expanded target", async({
    page
  }) => {
    for (const example of ["scenarios/editor", "scenarios/editor-states"]) {
      await gotoGallery(page, { example, chrome: "off" });

      const fields = page.locator("jolly-checkbox");
      await expect(fields.first()).toBeVisible();
      await expect(fields).toHaveCount(example.endsWith("-states") ? 6 : 5);
      for (const field of await fields.all()) {
        await expect(field).toHaveAttribute("clickable-background", "");
      }
    }
  });

  test("an end-aligned Editors gradient extends across its value column", async({
    page
  }) => {
    await gotoGallery(page, { example: "scenarios/editor", chrome: "off" });

    const propertyRow = page.locator("jolly-property-row", {
      has: page.locator("jolly-checkbox")
    }).first();
    const value = propertyRow.locator(".value").first();
    const checkbox = propertyRow.locator("jolly-checkbox .checkbox");
    const input = propertyRow.locator('input[type="checkbox"]');
    const [valueBox, checkboxBox, inputBox] = await Promise.all([
      value.boundingBox(),
      checkbox.boundingBox(),
      input.boundingBox()
    ]);
    if (valueBox === null || checkboxBox === null || inputBox === null) {
      throw new Error("Editors checkbox layout boxes must exist");
    }

    expect(checkboxBox.width).toBeGreaterThan(inputBox.width * 3);
    expect(inputBox.x - checkboxBox.x).toBeGreaterThan(valueBox.width / 2);
  });

  test("background activation respects inert states", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });

    for (const state of ["disabled", "readonly", "locked"]) {
      const field = page.locator(
        `[data-state="${state}"] jolly-checkbox`
      );
      const input = field.locator('input[type="checkbox"]');

      await field.locator(".checkbox").click({ force: true });
      await expect(input).not.toBeChecked();
    }
  });
});
