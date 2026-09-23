// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";
import { fieldRow as row, scrubBy } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import {
  fieldChanges as changes,
  fieldInputCount,
  recordFieldChanges as recordChanges,
  recordFieldInputs
} from "../support/events.ts";
import { styleOf } from "../support/styles.ts";

test.describe("number", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "controls/number");
    await recordChanges(page);
  });

  test("commits an evaluated, quantised and clamped expression", async({ page }) => {
    const input = row(page, "jolly-number", "default").locator("input");
    await input.fill("1920/2");
    await input.press("Enter");

    expect(await changes(page)).toEqual([1]);
  });

  test("a parse error blocks the commit until a valid value clears it", async({ page }) => {
    const field = row(page, "jolly-number", "default");
    const input = field.locator("input");

    await input.fill("alert(1)");
    await input.press("Enter");
    await expect(field).toHaveAttribute("invalid", "");
    await expect(field.locator(".error")).toBeVisible();
    expect(await changes(page)).toEqual([]);

    await input.fill("0.25");
    await input.press("Enter");
    await expect(field).not.toHaveAttribute("invalid", "");
    expect(await changes(page)).toEqual([0.25]);
  });

  test("a consumer set error is not cleared by the element", async({ page }) => {
    const field = row(page, "jolly-number", "error");
    const input = field.locator("input");
    await input.fill("0.25");
    await input.press("Enter");

    await expect(field.locator(".error")).toHaveText("Value is out of range");
  });

  test("typing emits no jolly-input before the commit", async({ page }) => {
    await recordFieldInputs(page);

    await row(page, "jolly-number", "default").locator("input")
      .pressSequentially("1920/2");

    expect(await fieldInputCount(page)).toBe(0);
  });

  test("arrow keys step, Shift coarsens from a refined value, Alt refines", async({ page }) => {
    const input = row(page, "jolly-number", "default").locator("input");
    await input.focus();
    await input.press("ArrowDown");
    await input.press("ArrowDown");
    await input.press("Alt+ArrowUp");
    await input.press("Shift+ArrowUp");

    expect(await changes(page)).toEqual([0.49, 0.48, 0.481, 0.581]);
  });

  test("dragging the scrub handle commits one stepped value", async({ page }) => {
    await scrubBy(
      page,
      row(page, "jolly-number", "default").locator(".scrub-handle"),
      40
    );

    expect(await changes(page)).toEqual([0.6]);
  });

  test("a scrub streams jolly-input and commits once", async({ page }) => {
    const seen = await row(page, "jolly-number", "default").evaluate((element) => {
      const handle = element.shadowRoot?.querySelector(".scrub-handle");
      if (!(handle instanceof HTMLElement)) {
        return null;
      }

      const events: string[] = [];
      element.addEventListener("jolly-input", () => events.push("input"));
      element.addEventListener("jolly-change", () => events.push("change"));

      const box = handle.getBoundingClientRect();
      const y = box.y + (box.height / 2);
      const from = box.x + (box.width / 2);
      const steps: Array<[string, number, number]> = [
        ["pointerdown", from, 1],
        ["pointermove", from + 20, 1],
        ["pointermove", from + 40, 1],
        ["pointerup", from + 40, 0]
      ];
      for (const [type, x, buttons] of steps) {
        handle.dispatchEvent(new PointerEvent(type, {
          bubbles: true,
          composed: true,
          cancelable: true,
          pointerId: 1,
          isPrimary: true,
          button: 0,
          buttons,
          clientX: x,
          clientY: y
        }));
      }

      return events;
    });

    expect(seen).toEqual(["input", "input", "change"]);
  });

  for (const state of ["mixed", "locked"]) {
    test(`a ${state} field refuses scrubbing and keyboard edits`, async({ page }) => {
      const field = row(page, "jolly-number", state);
      const input = field.locator("input");

      await scrubBy(page, field.locator(".scrub-handle"), 40);
      await input.focus();
      await input.press("ArrowUp");
      await input.press("Shift+ArrowDown");
      if (state === "locked") {
        await input.pressSequentially("5");
        await input.press("Enter");
      }

      expect(await changes(page)).toEqual([]);
    });
  }

  test("the revert gutter commits the default and then clears", async({ page }) => {
    const field = row(page, "jolly-number", "modified");

    await field.locator(".revert").dispatchEvent("click");

    expect(await changes(page)).toEqual([0.5]);
    await expect(field).not.toHaveAttribute("modified", "");
    await expect(field.locator(".revert")).toHaveCount(0);
  });
});

test.describe("range", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "controls/range");
    await recordChanges(page);
  });

  test("commits an evaluated expression for the focused endpoint", async({ page }) => {
    const input = row(page, "jolly-range", "default")
      .locator('input[data-end="from"]');
    await input.fill("2*3");
    await input.press("Enter");

    expect(await changes(page)).toEqual([{ from: 6, to: 20 }]);
  });

  test("reports an invalid expression without committing", async({ page }) => {
    const field = row(page, "jolly-range", "default");
    const input = field.locator('input[data-end="from"]');
    await input.fill("alert(1)");
    await input.press("Enter");

    await expect(field).toHaveAttribute("invalid", "");
    expect(await changes(page)).toEqual([]);
  });

  test("arrow keys step only the focused end", async({ page }) => {
    const from = row(page, "jolly-range", "default")
      .locator('input[data-end="from"]');
    await from.focus();
    await from.press("Alt+ArrowUp");
    await from.press("Shift+ArrowUp");

    expect(await changes(page)).toEqual([
      { from: 5.05, to: 20 },
      { from: 10.05, to: 20 }
    ]);
  });

  test("a typed endpoint cannot cross the other one", async({ page }) => {
    const to = row(page, "jolly-range", "default")
      .locator('input[data-end="to"]');
    await to.fill("1");
    await to.press("Enter");

    expect(await changes(page)).toEqual([{ from: 5, to: 5 }]);
  });
});

test.describe("text", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "controls/text");
    await recordChanges(page);
  });

  test("Escape discards the draft and restores the value", async({ page }) => {
    const input = row(page, "jolly-text", "default").locator("input");
    await input.fill("Edited");
    await input.press("Escape");

    await expect(input).toHaveValue("Background");
    expect(await changes(page)).toEqual([]);
  });

  test("blur commits, matching native change semantics", async({ page }) => {
    const input = row(page, "jolly-text", "default").locator("input");
    await input.fill("Edited");
    await input.blur();

    expect(await changes(page)).toEqual(["Edited"]);
  });

  test("typing emits jolly-input per keystroke", async({ page }) => {
    await recordFieldInputs(page);

    const input = row(page, "jolly-text", "default").locator("input");
    await input.press("End");
    await input.pressSequentially("abc");

    expect(await fieldInputCount(page)).toBe(3);
  });

  test("reverting a mixed field commits the default", async({ page }) => {
    await row(page, "jolly-text", "mixed+modified")
      .locator(".revert")
      .dispatchEvent("click");

    expect(await changes(page)).toEqual(["Background"]);
  });
});

test.describe("slider", () => {
  test("the readout steps with the arrow keys", async({ page }) => {
    await openExample(page, "controls/slider");
    await recordChanges(page);

    const readout = row(page, "jolly-slider", "default").locator(".readout");
    await readout.focus();
    await readout.press("ArrowUp");

    expect(await changes(page)).toEqual([0.45]);
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
    expect(await changes(page)).toEqual([]);
  });
});

test.describe("select", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "controls/select");
    await recordChanges(page);
  });

  test("commits the picked option", async({ page }) => {
    await row(page, "jolly-select", "default")
      .locator("select")
      .selectOption({ label: "Linear" });

    expect(await changes(page)).toEqual(["linear"]);
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
    expect(await changes(page)).toEqual([]);
  });
});
