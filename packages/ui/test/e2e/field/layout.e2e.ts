// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator
} from "@playwright/test";
import { fieldRow, boxOf } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";

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

  await test.step("the lock stays clear of the value", async() => {
    const locked = row("unlabeled+locked");
    await expect(locked.locator(".gutter jolly-icon")).toBeVisible();
    expect((await insets(locked)).start).toBeGreaterThan(plain.start);
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
