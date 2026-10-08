// Import Third-party Dependencies
import {
  boxOf,
  scrubBy
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect,
  type Locator,
  type Page
} from "../fixtures.ts";
import { fieldRow as row, openExample } from "../support/gallery.ts";
import {
  fieldChanges as changes,
  recordFieldChanges as recordChanges
} from "../support/events.ts";
import { styleOf } from "../support/styles.ts";

function axisTagColor(
  page: Page,
  tag: string,
  axis: string
): Promise<string> {
  return styleOf(
    row(page, tag, "default")
      .locator(`.axis-box[data-axis="${axis}"] .axis-tag`),
    "border-top-color"
  );
}

test.describe("vector3", () => {
  test.use({
    example: "math/vector3"
  });

  test.beforeEach(async({ page }) => {
    await recordChanges(page);
  });

  test("an axis scrub commits one stepped value, except when mixed", async({ page }) => {
    function handle(state: string): Locator {
      return row(page, "jolly-vector3", state)
        .locator('.axis-box[data-axis="x"] .scrub-handle');
    }

    await scrubBy(page, handle("mixed"), 40);
    await expect.poll(() => changes(page)).toEqual([]);

    await scrubBy(page, handle("default"), 40);
    await expect.poll(() => changes(page)).toEqual([{ x: 1, y: 1, z: 0 }]);
  });

  test("an axis parse error uses the field error presentation", async({ page }) => {
    const field = row(page, "jolly-vector3", "default");
    const input = field.locator('.axis-box[data-axis="x"] input');
    await input.fill("alert(1)");
    await input.press("Enter");

    await expect(field).toHaveAttribute("invalid", "");
    await expect(field.locator(".error")).toBeVisible();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect.poll(() => changes(page)).toEqual([]);

    await input.press("Escape");
    await expect(field).not.toHaveAttribute("invalid");
  });

  test("the row revert resets every axis together", async({ page }) => {
    await row(page, "jolly-vector3", "modified")
      .locator(".revert")
      .dispatchEvent("click");

    await expect.poll(() => changes(page)).toEqual([{ x: 0, y: 1, z: 0 }]);
  });
});

test("editing one axis of a multi-selection leaves a disagreeing axis mixed", async({ page }) => {
  await openExample(page, "scenarios/mixed-per-axis");

  const field = page.locator("jolly-vector3");
  const y = field.locator('.axis-box[data-axis="y"] input');
  const z = field.locator('.axis-box[data-axis="z"] input');
  await expect(y).toHaveValue("");
  await expect(z).toHaveValue("");

  await y.fill("3");
  await y.press("Enter");

  await expect(y).not.toHaveValue("");
  await expect(z).toHaveValue("");
  const readout = page.locator(".scenario-log li");
  await expect(readout.nth(0)).toHaveText("Crate A: 2, 3, -4");
  await expect(readout.nth(1)).toHaveText("Crate B: 2, 3, 8");
});

test.describe("axis markers", () => {
  function inputWidth(page: Page): Promise<number> {
    return row(page, "jolly-vector3", "default")
      .locator('.axis-box[data-axis="x"] input')
      .evaluate((input) => input.getBoundingClientRect().width);
  }

  test("a letter replaces the corner tag without changing the input width", async({ page }) => {
    await openExample(page, "math/vector3");
    const cornerWidth = await inputWidth(page);

    await openExample(page, "math/vector3", {
      options: { letterOnly: true }
    });
    await recordChanges(page);

    const box = row(page, "jolly-vector3", "default")
      .locator('.axis-box[data-axis="x"]');
    await expect(box.locator(".axis-tag")).toHaveCount(0);
    await expect(box.locator(".scrub-handle")).toHaveText("X");
    expect(await inputWidth(page)).toBe(cornerWidth);

    await scrubBy(page, box.locator(".scrub-handle"), 40);
    await expect.poll(() => changes(page)).toEqual([{ x: 1, y: 1, z: 0 }]);
  });

  test("a chip is as wide as the control is tall", async({ page }) => {
    await openExample(page, "math/vector3", {
      options: { axisLetters: true }
    });

    const chip = await boxOf(
      row(page, "jolly-vector3", "default")
        .locator('.axis-box[data-axis="y"] .scrub-handle')
    );
    expect(chip.width).toBe(chip.height);
  });

  test("a transform passes its axis style to every row", async({ page }) => {
    await openExample(page, "math/transform", {
      options: { axisLetters: true }
    });

    const rows = page.locator("jolly-transform")
      .locator("jolly-vector3, jolly-quaternion");
    await expect(rows).toHaveCount(3);
    for (const field of await rows.all()) {
      await expect(field).toHaveAttribute("axis-style", "chip");
    }
  });

  test("new fields read the class default", async({ page }) => {
    await openExample(page, "math/vector3");

    const style = await page.evaluate(async() => {
      const Vector3 = customElements.get("jolly-vector3") as unknown as {
        Defaults: { axisStyle: string; };
      };
      Vector3.Defaults.axisStyle = "letter";
      const field = document.createElement("jolly-vector3");
      Vector3.Defaults.axisStyle = "corner";
      document.body.append(field);
      await field.updateComplete;
      field.remove();

      return field.getAttribute("axis-style");
    });
    expect(style).toBe("letter");
  });
});

test.describe("quaternion", () => {
  test.use({
    example: "math/quaternion"
  });

  test("typing an axis in degrees commits the equivalent quaternion", async({ page }) => {
    await recordChanges(page);

    const input = row(page, "jolly-quaternion", "default")
      .locator('.axis-box[data-axis="y"] input');
    await input.fill("90");
    await input.press("Enter");

    const [value] = await changes(page);
    expect(value).toEqual({
      x: expect.closeTo(0, 9),
      y: expect.closeTo(Math.SQRT1_2, 6),
      z: expect.closeTo(0, 9),
      w: expect.closeTo(Math.SQRT1_2, 6)
    });
  });

  test("nudging one axis near a gimbal pole leaves the others still", async({ page }) => {
    const field = row(page, "jolly-quaternion", "default");
    const half = (89.99 * Math.PI) / 360;
    await field.evaluate(
      (element: HTMLElementTagNameMap["jolly-quaternion"], value) => {
        element.value = value;
      },
      {
        x: 0,
        y: Math.sin(half),
        z: 0,
        w: Math.cos(half)
      }
    );

    const x = field.locator('.axis-box[data-axis="x"] input');
    const z = field.locator('.axis-box[data-axis="z"] input');
    const [xBefore, zBefore] = await Promise.all([
      x.inputValue(),
      z.inputValue()
    ]);

    await field.locator('.axis-box[data-axis="y"] input').press("ArrowUp");

    await expect(x).toHaveValue(xBefore);
    await expect(z).toHaveValue(zBefore);
  });
});

test.describe("transform", () => {
  test("relays one sub-row commit as a single merged change", async({ page }) => {
    await openExample(page, "math/transform");

    const transform = page.locator("jolly-transform");
    await transform.evaluate((element) => {
      window.__changes = [];
      element.addEventListener("jolly-change", (event) => {
        if (event.composedPath()[0] === element && event instanceof CustomEvent) {
          window.__changes?.push(event.detail.value);
        }
      });
    });

    const scaleX = transform.locator("jolly-vector3[label='Scale']")
      .locator('.axis-box[data-axis="x"] input');
    await scaleX.fill("2");
    await scaleX.press("Enter");

    await expect.poll(() => changes(page)).toEqual([
      {
        position: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 2, y: 1, z: 1 }
      }
    ]);
  });

  test("stacked sub-fields put each label above its value", async({ page }) => {
    await openExample(page, "math/transform", {
      options: { stacked: true, lockedRotation: false }
    });

    const position = page.locator("jolly-vector3[label='Position']");
    await expect(position).toHaveAttribute("label-position", "top");

    const [label, value] = await Promise.all([
      boxOf(position.locator(".label").first()),
      boxOf(position.locator(".value").first())
    ]);
    expect(value.y).toBeGreaterThanOrEqual(label.y + label.height);
    expect(value.x).toBe(label.x);
  });
});

test("point2d commits a clamped point from a pad press", async({ page }) => {
  await openExample(page, "math/point2d");
  await recordChanges(page);

  const box = await boxOf(row(page, "jolly-point2d", "default").locator(".pad"));
  await page.mouse.move(box.x + box.width - 1, box.y + 1);
  await page.mouse.down();
  await page.mouse.up();

  await expect.poll(() => changes(page)).toEqual([{ x: 0.98, y: 0.02 }]);
});

test("vector2 edits an x/z pair painted with the z ramp", async({ page }) => {
  await openExample(page, "math/vector3");
  const zColor = await axisTagColor(page, "jolly-vector3", "z");

  await openExample(page, "math/vector2", {
    options: { xz: true }
  });
  await recordChanges(page);

  const field = row(page, "jolly-vector2", "default");
  await expect(field.locator('.axis-box[data-axis="y"]')).toHaveCount(0);
  expect(await axisTagColor(page, "jolly-vector2", "z")).toBe(zColor);
  expect(await axisTagColor(page, "jolly-vector2", "x")).not.toBe(zColor);

  const input = field.locator('.axis-box[data-axis="z"] input');
  await input.fill("9");
  await input.press("Enter");

  await expect.poll(() => changes(page)).toEqual([{ x: 4, z: 9 }]);
});
