// Import Internal Dependencies
import {
  test,
  expect
} from "../fixtures.ts";
import { fieldRow as row, openExample } from "../support/gallery.ts";
import {
  fieldChanges as changes,
  fieldInputCount,
  recordFieldChanges as recordChanges,
  recordFieldInputs
} from "../support/events.ts";
import { styleOf } from "../support/styles.ts";

test.describe("range", () => {
  test.use({
    example: "controls/range"
  });

  test.beforeEach(async({ page }) => {
    await recordChanges(page);
  });

  test("commits an evaluated expression for the focused endpoint", async({ page }) => {
    const input = row(page, "jolly-range", "default")
      .locator('input[data-end="from"]');
    await input.fill("2*3");
    await input.press("Enter");

    await expect.poll(() => changes(page)).toEqual([{ from: 6, to: 20 }]);
  });

  test("reports an invalid expression without committing", async({ page }) => {
    const field = row(page, "jolly-range", "default");
    const input = field.locator('input[data-end="from"]');
    await input.fill("alert(1)");
    await input.press("Enter");

    await expect(field).toHaveAttribute("invalid", "");
    await expect.poll(() => changes(page)).toEqual([]);
  });

  test("arrow keys step only the focused end", async({ page }) => {
    const from = row(page, "jolly-range", "default")
      .locator('input[data-end="from"]');
    await from.focus();
    await from.press("Alt+ArrowUp");
    await from.press("Shift+ArrowUp");

    await expect.poll(() => changes(page)).toEqual([
      { from: 5.05, to: 20 },
      { from: 10.05, to: 20 }
    ]);
  });

  test("a typed endpoint cannot cross the other one", async({ page }) => {
    const to = row(page, "jolly-range", "default")
      .locator('input[data-end="to"]');
    await to.fill("1");
    await to.press("Enter");

    await expect.poll(() => changes(page)).toEqual([{ from: 5, to: 5 }]);
  });
});

test.describe("text", () => {
  test.use({
    example: "controls/text"
  });

  test.beforeEach(async({ page }) => {
    await recordChanges(page);
  });

  test("Escape discards the draft and restores the value", async({ page }) => {
    const input = row(page, "jolly-text", "default").locator("input");
    await input.fill("Edited");
    await input.press("Escape");

    await expect(input).toHaveValue("Background");
    await expect.poll(() => changes(page)).toEqual([]);
  });

  test("blur commits, matching native change semantics", async({ page }) => {
    const input = row(page, "jolly-text", "default").locator("input");
    await input.fill("Edited");
    await input.blur();

    await expect.poll(() => changes(page)).toEqual(["Edited"]);
  });

  test("typing emits jolly-input per keystroke", async({ page }) => {
    await recordFieldInputs(page);

    const input = row(page, "jolly-text", "default").locator("input");
    await input.press("End");
    await input.pressSequentially("abc");

    await expect.poll(() => fieldInputCount(page)).toBe(3);
  });

  test("reverting a mixed field commits the default", async({ page }) => {
    await row(page, "jolly-text", "mixed+modified")
      .locator(".revert")
      .dispatchEvent("click");

    await expect.poll(() => changes(page)).toEqual(["Background"]);
  });
});

test.describe("slider", () => {
  test("the readout steps with the arrow keys", async({ page }) => {
    await openExample(page, "controls/slider");
    await recordChanges(page);

    const readout = row(page, "jolly-slider", "default").locator(".readout");
    await readout.focus();
    await readout.press("ArrowUp");

    await expect.poll(() => changes(page)).toEqual([0.45]);
  });

  test("progress follows input before any commit", async({ page }) => {
    await openExample(page, "scenarios/editor");
    await recordChanges(page);

    const slider = page.locator("jolly-slider").first();
    const lane = slider.locator(".lane");
    const before = await styleOf(lane, "--jolly-slider-progress");

    await slider.locator('input[type="range"]').evaluate(
      (node: HTMLInputElement) => {
        node.value = "3";
        node.dispatchEvent(new Event("input", {
          bubbles: true,
          composed: true
        }));
      }
    );

    await expect.poll(() => styleOf(lane, "--jolly-slider-progress"))
      .not.toBe(before);
    await expect.poll(() => changes(page)).toEqual([]);
  });
});

test.describe("select", () => {
  test.use({
    example: "controls/select"
  });

  test.beforeEach(async({ page }) => {
    await recordChanges(page);
  });

  test("commits the picked option", async({ page }) => {
    await row(page, "jolly-select", "default")
      .locator("select")
      .selectOption({ label: "Linear" });

    await expect.poll(() => changes(page)).toEqual(["linear"]);
  });

  test("a locked select puts the picked option back", async({ page }) => {
    const after = await row(page, "jolly-select", "locked").evaluate((field) => {
      const select = field.shadowRoot?.querySelector("select");
      if (!(select instanceof HTMLSelectElement)) {
        return null;
      }

      select.value = "1";
      select.dispatchEvent(new Event("change", { bubbles: true }));

      return select.value;
    });

    expect(after).toBe("0");
    await expect.poll(() => changes(page)).toEqual([]);
  });
});
