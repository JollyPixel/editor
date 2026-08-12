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

test.describe("number: expression input", () => {
  test("commits an evaluated expression", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/number",
      chrome: "off"
    });
    await recordChanges(page);

    const input = row(page, "jolly-number", "default").locator("input");
    await input.fill("1920/2");
    await input.press("Enter");

    // Quantised onto the 0.01 step and clamped to the field's max of 1.
    expect(await changes(page)).toEqual([1]);
  });

  test("reports a parse failure without emitting a change", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/number",
      chrome: "off"
    });
    await recordChanges(page);

    const field = row(page, "jolly-number", "default");
    const input = field.locator("input");
    await input.fill("alert(1)");
    await input.press("Enter");

    await expect(field).toHaveAttribute("invalid", "");
    await expect(field.locator(".error")).toBeVisible();
    expect(await changes(page)).toEqual([]);
  });

  /**
   * A local parse error is view state and must not survive the edit that
   * caused it.
   */
  test("clears the parse error once a valid value commits", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/number",
      chrome: "off"
    });

    const field = row(page, "jolly-number", "default");
    const input = field.locator("input");
    await input.fill("1..2");
    await input.press("Enter");
    await expect(field).toHaveAttribute("invalid", "");

    await input.fill("0.25");
    await input.press("Enter");
    await expect(field).not.toHaveAttribute("invalid", "");
  });

  test("a consumer set error is not cleared by the element", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/number",
      chrome: "off"
    });

    const field = row(page, "jolly-number", "error");
    const input = field.locator("input");
    await input.fill("0.25");
    await input.press("Enter");

    await expect(field.locator(".error")).toHaveText("Value is out of range");
  });
});

test.describe("range: expression input", () => {
  test("commits an evaluated expression for the focused endpoint", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/range",
      chrome: "off"
    });
    await recordChanges(page);

    const input = row(page, "jolly-range", "default")
      .locator('input[data-end="from"]');
    await input.fill("2*3");
    await input.press("Enter");

    expect(await changes(page)).toEqual([{ from: 6, to: 20 }]);
  });

  test("reports an invalid expression without committing", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/range",
      chrome: "off"
    });
    await recordChanges(page);

    const field = row(page, "jolly-range", "default");
    const input = field.locator('input[data-end="from"]');
    await input.fill("alert(1)");
    await input.press("Enter");

    await expect(field).toHaveAttribute("invalid", "");
    expect(await changes(page)).toEqual([]);
  });
});

test.describe("draft lifecycle", () => {
  test("Escape discards the draft and restores the value", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/text",
      chrome: "off"
    });
    await recordChanges(page);

    const input = row(page, "jolly-text", "default").locator("input");
    await input.fill("Edited");
    await input.press("Escape");

    await expect(input).toHaveValue("Background");
    expect(await changes(page)).toEqual([]);
  });

  test("blur commits, matching native change semantics", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/text",
      chrome: "off"
    });
    await recordChanges(page);

    const input = row(page, "jolly-text", "default").locator("input");
    await input.fill("Edited");
    await input.blur();

    expect(await changes(page)).toEqual(["Edited"]);
  });

  test("typing in a text field emits jolly-input per keystroke", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/text",
      chrome: "off"
    });
    await page.evaluate(() => {
      window.__inputs = 0;
      document.addEventListener("jolly-input", () => {
        window.__inputs = (window.__inputs ?? 0) + 1;
      });
    });

    const input = row(page, "jolly-text", "default").locator("input");
    await input.press("End");
    await input.pressSequentially("abc");

    expect(await page.evaluate(() => window.__inputs)).toBe(3);
  });

  /**
   * Streaming 1, 19, 192 as committed numbers while someone types 1920/2 is
   * what this prevents.
   */
  test("typing in a number field emits no jolly-input", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/number",
      chrome: "off"
    });
    await page.evaluate(() => {
      window.__inputs = 0;
      document.addEventListener("jolly-input", () => {
        window.__inputs = (window.__inputs ?? 0) + 1;
      });
    });

    const input = row(page, "jolly-number", "default").locator("input");
    await input.pressSequentially("1920/2");

    expect(await page.evaluate(() => window.__inputs)).toBe(0);
  });
});

test.describe("drag scrub", () => {
  /**
   * A small fixed step count, asserting the committed value rather than
   * intermediate frames: pixel-art's spurious e2e timeouts traced to large
   * step counts on drags.
   */
  test("dragging the handle commits a stepped value", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/number",
      chrome: "off"
    });
    await recordChanges(page);

    const handle = row(page, "jolly-number", "default").locator(".scrub-handle");
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();

    const y = box!.y + (box!.height / 2);
    await page.mouse.move(box!.x + (box!.width / 2), y);
    await page.mouse.down();
    await page.mouse.move(box!.x + (box!.width / 2) + 40, y, { steps: 4 });
    await page.mouse.up();

    // 40px over 4px per step is 10 steps of 0.01, from 0.5.
    expect(await changes(page)).toEqual([0.6]);
  });

  /**
   * Dispatched rather than driven by the mouse. A real drag's intermediate
   * moves are coalesced by the browser, so counting them is timing
   * dependent; what this asserts is the controller's own contract, that a
   * scrub streams jolly-input and finishes with exactly one jolly-change.
   */
  test("a scrub streams jolly-input and commits once", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/number",
      chrome: "off"
    });

    const field = row(page, "jolly-number", "default");

    const seen = await field.evaluate((element) => {
      const handle = element.shadowRoot?.querySelector(".scrub-handle");
      if (!(handle instanceof HTMLElement)) {
        return null;
      }

      const scrubHandle = handle;

      const events: string[] = [];
      element.addEventListener("jolly-input", () => events.push("input"));
      element.addEventListener("jolly-change", () => events.push("change"));

      const box = scrubHandle.getBoundingClientRect();
      const y = box.y + (box.height / 2);
      const from = box.x + (box.width / 2);

      function send(
        type: string,
        x: number,
        buttons: number
      ): void {
        scrubHandle.dispatchEvent(new PointerEvent(type, {
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

      send("pointerdown", from, 1);
      send("pointermove", from + 20, 1);
      send("pointermove", from + 40, 1);
      send("pointerup", from + 40, 0);

      return events;
    });

    expect(seen).toEqual(["input", "input", "change"]);
  });

  /**
   * No honest start value exists, so the gesture is refused rather than
   * synthesising one.
   */
  test("a mixed field does not scrub", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/number",
      chrome: "off"
    });
    await recordChanges(page);

    const handle = row(page, "jolly-number", "mixed").locator(".scrub-handle");
    const box = await handle.boundingBox();
    const y = box!.y + (box!.height / 2);

    await page.mouse.move(box!.x + (box!.width / 2), y);
    await page.mouse.down();
    await page.mouse.move(box!.x + (box!.width / 2) + 40, y, { steps: 4 });
    await page.mouse.up();

    expect(await changes(page)).toEqual([]);
  });

  test("a locked field does not scrub", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/number",
      chrome: "off"
    });
    await recordChanges(page);

    const handle = row(page, "jolly-number", "locked").locator(".scrub-handle");
    const box = await handle.boundingBox();
    const y = box!.y + (box!.height / 2);

    await page.mouse.move(box!.x + (box!.width / 2), y);
    await page.mouse.down();
    await page.mouse.move(box!.x + (box!.width / 2) + 40, y, { steps: 4 });
    await page.mouse.up();

    expect(await changes(page)).toEqual([]);
  });
});

test.describe("slider", () => {
  test("the Editor updates slider progress before commit", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor",
      chrome: "off"
    });
    await recordChanges(page);

    const slider = page.locator("jolly-slider").first();
    const range = slider.locator('input[type="range"]');
    const lane = slider.locator(".lane");

    function progress(): Promise<string> {
      return lane.evaluate((node) => getComputedStyle(node)
        .getPropertyValue("--jolly-slider-progress"));
    }

    const before = await progress();

    await range.evaluate((node) => {
      if (node instanceof HTMLInputElement) {
        node.value = "3";
        node.dispatchEvent(new Event("input", {
          bubbles: true,
          composed: true
        }));
      }
    });

    await expect.poll(progress).not.toBe(before);
    expect(await changes(page)).toEqual([]);
  });
});

test.describe("arrow-key stepping", () => {
  test("ArrowUp/ArrowDown step jolly-number by step, Shift coarsens and Alt refines", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/number",
      chrome: "off"
    });
    await recordChanges(page);

    const input = row(page, "jolly-number", "default").locator("input");
    await input.focus();
    await input.press("ArrowDown");
    await input.press("ArrowDown");
    await input.press("Alt+ArrowUp");
    // Regression case: a coarse step from a value an Alt press just refined must land relative to
    // that value (0.481 + 0.1), not snap to the nearest whole multiple of the coarse step (0.6).
    await input.press("Shift+ArrowUp");

    expect(await changes(page)).toEqual([0.49, 0.48, 0.481, 0.581]);
  });

  test("a mixed number field ignores arrow keys", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/number",
      chrome: "off"
    });
    await recordChanges(page);

    const input = row(page, "jolly-number", "mixed").locator("input");
    await input.focus();
    await input.press("ArrowUp");

    expect(await changes(page)).toEqual([]);
  });

  test("arrow keys on jolly-range step only the focused end, clamped against the other", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/range",
      chrome: "off"
    });
    await recordChanges(page);

    const from = row(page, "jolly-range", "default").locator('input[data-end="from"]');
    await from.focus();
    await from.press("Alt+ArrowUp");
    await from.press("Shift+ArrowUp");

    // step is 0.5: Alt refines to 0.05 (5 -> 5.05), Shift then coarsens to 5 (5.05 -> 10.05).
    expect(await changes(page)).toEqual([
      { from: 5.05, to: 20 },
      { from: 10.05, to: 20 }
    ]);
  });
});

/**
 * Dispatched rather than clicked. Reverting makes the field equal its
 * default, so the gutter button removes itself in the same tick; Playwright's
 * actionability retry then races the detach and can spend the whole timeout
 * looking for an element that correctly no longer exists.
 */
test.describe("revert", () => {
  test("the gutter commits the default", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/number",
      chrome: "off"
    });
    await recordChanges(page);

    await row(page, "jolly-number", "modified").locator(".revert").dispatchEvent("click");

    expect(await changes(page)).toEqual([0.5]);
  });

  test("reverting a mixed field commits the default too", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/text",
      chrome: "off"
    });
    await recordChanges(page);

    await row(page, "jolly-text", "mixed+modified")
      .locator(".revert")
      .dispatchEvent("click");

    expect(await changes(page)).toEqual(["Background"]);
  });

  /**
   * The gutter is the affordance, so it must disappear once there is nothing
   * left to revert.
   */
  test("the gutter clears once the value matches its default again", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/number",
      chrome: "off"
    });

    const field = row(page, "jolly-number", "modified");
    await field.locator(".revert").dispatchEvent("click");

    await expect(field).not.toHaveAttribute("modified", "");
    await expect(field.locator(".revert")).toHaveCount(0);
  });
});

test.describe("checkbox", () => {
  test("a mixed checkbox is indeterminate and resolves to true", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/checkbox",
      chrome: "off"
    });
    await recordChanges(page);

    const input = row(page, "jolly-checkbox", "mixed").locator("input");
    expect(
      await input.evaluate((node: HTMLInputElement) => node.indeterminate)
    ).toBe(true);

    await input.click();
    expect(await changes(page)).toEqual([true]);
  });

  test("a locked checkbox refuses the click but stays focusable", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/checkbox",
      chrome: "off"
    });
    await recordChanges(page);

    const input = row(page, "jolly-checkbox", "locked").locator("input");

    // Forced: Playwright reads aria-disabled as not operable, which is
    // exactly the point of it.
    await input.click({ force: true });

    expect(await changes(page)).toEqual([]);
    await input.focus();
    await expect(input).toBeFocused();
  });
});
