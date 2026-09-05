// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";
import {
  fieldChanges as changes,
  recordFieldChanges as recordChanges
} from "../support/events.ts";
import { fieldRow as row } from "../support/locators.ts";

test.describe("vector: axis drag scrub", () => {
  test("dragging one axis commits a stepped value", async({ page }) => {
    await gotoGallery(page, {
      example: "math/vector3",
      chrome: "off"
    });
    await recordChanges(page);

    const handle = row(page, "jolly-vector3", "default")
      .locator('.axis-box[data-axis="x"] .scrub-handle');
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();

    const y = box!.y + (box!.height / 2);
    await page.mouse.move(box!.x + (box!.width / 2), y);
    await page.mouse.down();
    await page.mouse.move(box!.x + (box!.width / 2) + 40, y, { steps: 4 });
    await page.mouse.up();

    // 40 px at 4 px per step adds 10 increments of 0.1.
    expect(await changes(page)).toEqual([{ x: 1, y: 1, z: 0 }]);
  });

  test("a mixed vector does not scrub", async({ page }) => {
    await gotoGallery(page, {
      example: "math/vector3",
      chrome: "off"
    });
    await recordChanges(page);

    const handle = row(page, "jolly-vector3", "mixed")
      .locator('.axis-box[data-axis="x"] .scrub-handle');
    const box = await handle.boundingBox();
    const y = box!.y + (box!.height / 2);

    await page.mouse.move(box!.x + (box!.width / 2), y);
    await page.mouse.down();
    await page.mouse.move(box!.x + (box!.width / 2) + 40, y, { steps: 4 });
    await page.mouse.up();

    expect(await changes(page)).toEqual([]);
  });
});

test.describe("vector: whole-row revert", () => {
  test("resets every axis together", async({ page }) => {
    await gotoGallery(page, {
      example: "math/vector3",
      chrome: "off"
    });
    await recordChanges(page);

    await row(page, "jolly-vector3", "modified").locator(".revert").dispatchEvent("click");

    expect(await changes(page)).toEqual([{ x: 0, y: 1, z: 0 }]);
  });
});

test.describe("vector: per-axis Mixed in a multi-selection", () => {
  test("editing one axis commits it and leaves a disagreeing axis Mixed", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/mixed-per-axis",
      chrome: "off"
    });

    const field = page.locator("jolly-vector3");
    const y = field.locator('.axis-box[data-axis="y"] input');
    const z = field.locator('.axis-box[data-axis="z"] input');

    // Only x agrees across the selection.
    await expect(y).toHaveValue("");
    await expect(z).toHaveValue("");

    await y.fill("3");
    await y.press("Enter");

    await expect(y).not.toHaveValue("");
    // Untouched z remains Mixed.
    await expect(z).toHaveValue("");

    const readout = page.locator(".scenario-log");
    await expect(readout.locator("li").first()).toHaveText("Crate A: 2, 3, -4");
    await expect(readout.locator("li").nth(1)).toHaveText("Crate B: 2, 3, 8");
  });
});

test.describe("quaternion: Euler entry", () => {
  test("typing an axis in degrees commits the equivalent quaternion", async({ page }) => {
    await gotoGallery(page, {
      example: "math/quaternion",
      chrome: "off"
    });
    await recordChanges(page);

    const input = row(page, "jolly-quaternion", "default")
      .locator('.axis-box[data-axis="y"] input');
    await input.fill("90");
    await input.press("Enter");

    const [value] = await changes(page) as { x: number; y: number; z: number; w: number; }[];
    expect(Math.abs(value.y - Math.SQRT1_2)).toBeLessThan(1e-6);
    expect(Math.abs(value.w - Math.SQRT1_2)).toBeLessThan(1e-6);
    expect(Math.abs(value.x)).toBeLessThan(1e-9);
    expect(Math.abs(value.z)).toBeLessThan(1e-9);
  });

  test("nudging one axis near a gimbal pole does not visibly move the others", async({ page }) => {
    await gotoGallery(page, {
      example: "math/quaternion",
      chrome: "off"
    });

    const field = row(page, "jolly-quaternion", "default");
    // Stay just below the Y-axis pole.
    await field.evaluate((element, quaternion) => {
      (element as unknown as { value: unknown; }).value = quaternion;
    }, {
      x: 0,
      y: Math.sin((89.99 * Math.PI) / 360),
      z: 0,
      w: Math.cos((89.99 * Math.PI) / 360)
    });

    const x = field.locator('.axis-box[data-axis="x"] input');
    const z = field.locator('.axis-box[data-axis="z"] input');
    const xBefore = await x.inputValue();
    const zBefore = await z.inputValue();

    const yInput = field.locator('.axis-box[data-axis="y"] input');
    await yInput.press("ArrowUp");

    await expect(x).toHaveValue(xBefore);
    await expect(z).toHaveValue(zBefore);
  });
});

test.describe("transform: independent sub-rows", () => {
  test("relays scale's own commit as one merged change, untouched by position or rotation", async({ page }) => {
    await gotoGallery(page, {
      example: "math/transform",
      chrome: "off"
    });

    // Count only the transform's re-dispatched event.
    await page.evaluate(() => {
      function deepQuerySelector(
        root: ParentNode,
        selector: string
      ): Element | null {
        const direct = root.querySelector(selector);
        if (direct !== null) {
          return direct;
        }

        for (const host of root.querySelectorAll("*")) {
          const found = host.shadowRoot === null || host.shadowRoot === undefined
            ? null
            : deepQuerySelector(host.shadowRoot, selector);
          if (found !== null) {
            return found;
          }
        }

        return null;
      }

      const transform = deepQuerySelector(document, "jolly-transform");
      window.__changes = [];
      transform?.addEventListener("jolly-change", (event) => {
        // composedPath()[0] preserves the origin across the shadow boundary.
        if (event.composedPath()[0] === transform) {
          window.__changes?.push((event as CustomEvent).detail.value);
        }
      });
    });

    const scaleX = page.locator("jolly-transform jolly-vector3[label='Scale']")
      .locator('.axis-box[data-axis="x"] input');
    await scaleX.fill("2");
    await scaleX.press("Enter");

    expect(await changes(page)).toEqual([
      {
        position: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 2, y: 1, z: 1 }
      }
    ]);
  });
});

test.describe("transform: stacked label position", () => {
  test("puts each sub-field's label above its value instead of beside it", async({ page }) => {
    await gotoGallery(page, {
      example: "math/transform-stacked",
      chrome: "off"
    });

    const position = page.locator("jolly-vector3[label='Position']");
    await expect(position).toHaveAttribute("label-position", "top");

    const label = position.locator(".label").first();
    const value = position.locator(".value").first();
    const [labelBox, valueBox] = await Promise.all([
      label.evaluate((node) => node.getBoundingClientRect()),
      value.evaluate((node) => node.getBoundingClientRect())
    ]);

    expect(valueBox.top).toBeGreaterThanOrEqual(labelBox.bottom);
    expect(valueBox.left).toBe(labelBox.left);
  });

  test("does not reserve a shared label column across sub-fields", async({ page }) => {
    await gotoGallery(page, {
      example: "math/transform-stacked",
      chrome: "off"
    });

    const transform = page.locator("jolly-transform");
    const inlineLabelWidth = await transform.evaluate(
      (node) => node.style.getPropertyValue("--jolly-label-width")
    );

    expect(inlineLabelWidth).toBe("");
  });
});

test.describe("point2d: pad drag", () => {
  test("dragging the pad commits a clamped point", async({ page }) => {
    await gotoGallery(page, {
      example: "math/point2d",
      chrome: "off"
    });
    await recordChanges(page);

    const pad = row(page, "jolly-point2d", "default").locator(".pad");
    const box = await pad.boundingBox();
    expect(box).not.toBeNull();

    // Stay one pixel inside the top-right hit-test boundary.
    await page.mouse.move(box!.x + box!.width - 1, box!.y + 1);
    await page.mouse.down();
    await page.mouse.up();

    expect(await changes(page)).toEqual([{ x: 0.98, y: 0.02 }]);
  });
});

test.describe("vector2: axis pair", () => {
  test("edits the z axis and commits x and z", async({ page }) => {
    await gotoGallery(page, {
      example: "math/vector2-xz",
      chrome: "off"
    });
    await recordChanges(page);

    const field = row(page, "jolly-vector2", "default");
    await expect(field.locator('.axis-box[data-axis="y"]')).toHaveCount(0);

    const input = field.locator('.axis-box[data-axis="z"] input');
    await input.fill("9");
    await input.press("Enter");

    expect(await changes(page)).toEqual([{ x: 4, z: 9 }]);
  });

  test("paints the z axis with the z ramp colour", async({ page }) => {
    function tagColor(
      tag: string,
      axis: string
    ): Promise<string> {
      return row(page, tag, "default")
        .locator(`.axis-box[data-axis="${axis}"] .axis-tag`)
        .evaluate((element) => getComputedStyle(element).borderTopColor);
    }

    await gotoGallery(page, {
      example: "math/vector3",
      chrome: "off"
    });
    const reference = await tagColor("jolly-vector3", "z");

    await gotoGallery(page, {
      example: "math/vector2-xz",
      chrome: "off"
    });

    expect(await tagColor("jolly-vector2", "z")).toEqual(reference);
    expect(await tagColor("jolly-vector2", "x")).not.toEqual(reference);
  });
});
