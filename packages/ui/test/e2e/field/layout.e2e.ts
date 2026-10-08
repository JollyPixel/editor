// Import Third-party Dependencies
import { boxOf } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect,
  type Locator
} from "../fixtures.ts";
import { fieldRow, openExample } from "../support/gallery.ts";

async function insets(
  field: Locator
): Promise<{ start: number; end: number; }> {
  const [outer, inner] = await Promise.all([
    boxOf(field),
    boxOf(field.locator("input"))
  ]);

  return {
    start: Math.round(inner.x - outer.x),
    end: Math.round((outer.x + outer.width) - (inner.x + inner.width))
  };
}

test("label-less fields inset their value symmetrically", async({ page }) => {
  await openExample(page, "scenarios/unlabeled-fields");

  function row(state: string): Locator {
    return fieldRow(page, "jolly-text", state);
  }
  const plain = await insets(row("unlabeled"));

  await test.step("both edges match without a label", async() => {
    expect(plain.start).toBe(plain.end);
  });

  await test.step("a label keeps its column", async() => {
    expect((await insets(row("labelled"))).start)
      .toBeGreaterThan(plain.start);
  });

  await test.step("a lock leaves the value where it is", async() => {
    const locked = row("unlabeled+locked");
    await expect(locked).toHaveAttribute("locked", "");
    expect(await insets(locked)).toEqual(plain);
  });

  await test.step("stacked layout drops the empty label line", async() => {
    const stacked = row("unlabeled+top");
    await expect(stacked.locator(".leading")).toBeHidden();

    const { start, end } = await insets(stacked);
    expect(start).toBe(end);
  });

  await test.step("help text aligns with the value", async() => {
    const field = row("unlabeled+description");
    const [outer, description] = await Promise.all([
      boxOf(field),
      boxOf(field.locator(".description"))
    ]);

    expect(Math.round(description.x - outer.x))
      .toBe((await insets(field)).start);
  });
});

test.describe("field layout", () => {
  test.use({
    example: "scenarios/field-layout"
  });

  test("a modified row keeps the value column of its neighbours", async({ page }) => {
    const section = page.locator("[data-state=\"revert\"]");
    const modified = section.locator("jolly-number[data-role=\"modified\"]");
    const plain = section.locator("jolly-number[data-role=\"default\"]");
    await expect(modified.locator(".revert")).toBeVisible();
    await expect(plain.locator(".revert")).toHaveCount(0);

    const [modifiedValue, plainValue] = await Promise.all([
      boxOf(modified.locator(".value")),
      boxOf(plain.locator(".value"))
    ]);
    expect(modifiedValue.x).toBe(plainValue.x);
    expect(modifiedValue.width).toBe(plainValue.width);
  });

  test("a tooltip description keeps its row one row tall", async({ page }) => {
    const block = page.locator("[data-display=\"block\"] jolly-number");
    const field = page.locator("[data-display=\"tooltip\"] jolly-number");
    const hint = field.locator(".hint");
    const tooltip = field.getByRole("tooltip", { includeHidden: true });

    await expect(field.locator(".description")).toHaveCount(0);
    expect((await boxOf(field)).height)
      .toBeLessThan((await boxOf(block)).height);
    await expect(hint).toHaveAccessibleName("More information about Speed");

    await test.step("hover shows the description", async() => {
      await hint.hover();
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toHaveText(
        "Units per second, before the sprint multiplier"
      );
      await page.mouse.move(0, 0);
      await expect(tooltip).toBeHidden();
    });

    await test.step("keyboard focus shows it and Escape hides it", async() => {
      await field.locator("input").focus();
      await page.keyboard.press("Shift+Tab");
      await expect(hint).toBeFocused();
      await expect(tooltip).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(tooltip).toBeHidden();
    });
  });

  test("auto labels stack while the row is narrower than stack-below", async({ page }) => {
    const box = page.locator("[data-role=\"auto-stack\"]");
    const rows = box.locator(
      ":scope > :is(jolly-text, jolly-vector3, jolly-property-row)"
    );
    const text = box.locator("jolly-text");

    async function labelAboveValue(): Promise<boolean> {
      const [label, value] = await Promise.all([
        boxOf(text.locator(".label")),
        boxOf(text.locator("input"))
      ]);

      return label.y + label.height <= value.y;
    }

    await expect(rows).toHaveCount(3);
    for (const row of await rows.all()) {
      await expect(row).not.toHaveAttribute("stacked");
    }
    expect(await labelAboveValue()).toBe(false);

    await box.evaluate((element) => {
      element.style.width = "220px";
    });
    for (const row of await rows.all()) {
      await expect(row).toHaveAttribute("stacked", "");
    }
    expect(await labelAboveValue()).toBe(true);

    await box.evaluate((element) => {
      element.style.width = "420px";
    });
    await expect(text).not.toHaveAttribute("stacked");
  });

  test("a transform stacks its three rows together", async({ page }) => {
    const box = page.locator("[data-role=\"auto-stack-transform\"]");
    const transform = box.locator("jolly-transform");
    const rows = transform.locator(":is(jolly-vector3, jolly-quaternion)");
    await expect(rows).toHaveCount(3);
    await expect(transform).not.toHaveAttribute("stacked");

    await box.evaluate((element) => {
      element.style.width = "220px";
    });
    await expect(transform).toHaveAttribute("stacked", "");
    for (const row of await rows.all()) {
      await expect(row).toHaveAttribute("label-position", "top");
    }
  });

  test("a property row shares the label and value columns of fields", async({ page }) => {
    const column = page.locator("[data-display=\"block\"]");
    const field = column.locator("jolly-number");
    const row = column.locator("jolly-property-row");
    const [fieldLabel, rowLabel, fieldValue, rowValue] = await Promise.all([
      boxOf(field.locator(".label")),
      boxOf(row.locator(".label")),
      boxOf(field.locator(".value")),
      boxOf(row.locator(".value"))
    ]);

    expect(rowLabel.x).toBe(fieldLabel.x);
    expect(rowValue.x).toBe(fieldValue.x);
  });
});
