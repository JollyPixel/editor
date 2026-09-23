// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import {
  fieldRow,
  boxOf,
  centerOf,
  hold
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import {
  fieldChanges,
  recordFieldChanges
} from "../support/events.ts";

function row(
  page: Page,
  state: string
): Locator {
  return fieldRow(page, "jolly-color", state);
}

async function lastChange(
  page: Page
): Promise<unknown> {
  return (await fieldChanges(page)).at(-1);
}

async function openPicker(
  field: Locator
): Promise<Locator> {
  await field.locator("button.swatch").click();

  const popover = field.locator(".popover");
  await expect(popover).toBeVisible();
  await popover.evaluate((element) => Promise.all(
    element.getAnimations().map((animation) => animation.finished)
  ));

  return popover;
}

async function dragAreaToBlack(
  page: Page,
  area: Locator
): Promise<void> {
  const box = await boxOf(area);
  await hold(page, await centerOf(area), {
    x: box.x,
    y: box.y + box.height
  }, 3);
  await page.mouse.up();
}

function channel(
  picker: Locator,
  name: string
): Locator {
  return picker.locator(`input[data-channel="${name}"]`);
}

test.describe("color: popup", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "controls/color");
    await recordFieldChanges(page);
  });

  test("opens on the swatch and focuses the panel", async({ page }) => {
    const field = row(page, "default");
    const popover = await openPicker(field);

    await expect(field.locator("button.swatch"))
      .toHaveAttribute("aria-expanded", "true");
    await expect(popover.locator('input[aria-label="Saturation"]'))
      .toBeFocused();
  });

  test("Escape reverts to the colour held when the popup opened", async({ page }) => {
    const field = row(page, "default");
    const popover = await openPicker(field);

    await dragAreaToBlack(page, popover.locator(".area"));
    expect(await lastChange(page)).toBe("#000000");

    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    expect(await lastChange(page)).toBe("#4488ff");
    await expect(field.locator("button.swatch")).toBeFocused();
  });

  test("clicking away accepts the committed colour", async({ page }) => {
    const popover = await openPicker(row(page, "default"));

    await dragAreaToBlack(page, popover.locator(".area"));
    await page.mouse.click(2, 2);

    await expect(popover).toBeHidden();
    expect(await lastChange(page)).toBe("#000000");
  });

  test("does not open from a disabled row", async({ page }) => {
    const field = row(page, "disabled");
    await field.locator("button.swatch").click({ force: true });

    await expect(field.locator(".popover")).toBeHidden();
  });

  test("emits six digits and hides the alpha track when alpha is off", async({ page }) => {
    const popover = await openPicker(row(page, "default"));
    await expect(popover.locator(".track.alpha")).toHaveCount(0);

    await popover.locator('input[aria-label="Hue"]').focus();
    await page.keyboard.press("ArrowRight");

    expect(await lastChange(page)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

test.describe("color: alpha", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "controls/color", {
      options: { alpha: true }
    });
    await recordFieldChanges(page);
  });

  test("emits eight digits from the alpha track", async({ page }) => {
    const popover = await openPicker(row(page, "default"));
    await expect(popover.locator(".track.alpha")).toBeVisible();

    await popover.locator('input[aria-label="Alpha"]').focus();
    await page.keyboard.press("ArrowLeft");

    expect(await lastChange(page)).toMatch(/^#[0-9a-f]{8}$/);
  });

  test("the alpha readout cancels garbage and evaluates expressions", async({ page }) => {
    const popover = await openPicker(row(page, "default"));
    const readout = popover.locator("input.readout");
    await expect(readout).toHaveValue("0.80");

    await readout.fill("nope");
    await readout.press("Enter");
    await expect(readout).toHaveValue("0.80");
    expect(await fieldChanges(page)).toEqual([]);

    await readout.fill("0.5");
    await readout.press("Enter");
    expect(await lastChange(page)).toBe("#4488ff80");

    await readout.fill("1 / 4");
    await readout.press("Enter");
    expect(await lastChange(page)).toBe("#4488ff40");
  });

  test("the row's hex field accepts eight digits", async({ page }) => {
    const input = row(page, "default").locator("input.hex");
    await input.fill("#ff660080");
    await input.press("Enter");

    expect(await lastChange(page)).toBe("#ff660080");
  });
});

test.describe("color picker: standalone panel", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "controls/color-picker");
  });

  test("the hex field rejects garbage and expands shorthand", async({ page }) => {
    const readout = page.locator('[data-readout="default"]');
    const input = page.locator("jolly-color-picker").first().locator("input.hex");

    await input.fill("not-a-color");
    await input.press("Enter");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(readout).toHaveText("#4488ff");

    await input.fill("#f60");
    await input.press("Enter");
    await expect(readout).toHaveText("#ff6600");
  });

  test("keeps hue and saturation across a trip through black", async({ page }) => {
    const readout = page.locator('[data-readout="default"]');
    const value = page.locator("jolly-color-picker").first()
      .locator('input[aria-label="Value"]');

    await value.focus();
    await page.keyboard.press("Home");
    await expect(readout).toHaveText("#000000");
    await page.keyboard.press("End");
    await expect(readout).toHaveText("#4488ff");
  });

  test("rejects edits on a readonly panel", async({ page }) => {
    const hue = page.locator("jolly-color-picker").nth(3)
      .locator('input[aria-label="Hue"]');

    await hue.focus();
    await page.keyboard.press("ArrowRight");

    await expect(page.locator('[data-readout="readonly"]'))
      .toHaveText("#aa2255");
  });
});

test.describe("color picker: wide layout", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "controls/color-picker");
  });

  test("a channel field rejects garbage and commits a typed value", async({ page }) => {
    const readout = page.locator('[data-readout="wide"]');
    const picker = page.locator('jolly-color-picker[layout="wide"]').first();
    const green = channel(picker, "g");
    const red = channel(picker, "r");

    await green.fill("1 +");
    await green.press("Enter");
    await expect(green).toHaveAttribute("aria-invalid", "true");
    await expect(readout).toHaveText("#c39d7f");

    await expect(red).toHaveValue("195");
    await red.fill("255");
    await red.press("Enter");
    await expect(readout).toHaveText("#ff9d7f");
  });

  test("keeps the hue channel when HSL saturation reaches gray", async({ page }) => {
    const picker = page.locator('jolly-color-picker[layout="wide"]').first();
    const hue = channel(picker, "h");
    const saturation = channel(picker, "s");
    const before = await hue.inputValue();

    await saturation.fill("0");
    await saturation.press("Enter");

    await expect(channel(picker, "r"))
      .toHaveValue(await channel(picker, "g").inputValue());
    await expect(hue).toHaveValue(before);
  });

  test("lays the hue track out vertically with its maximum on top", async({ page }) => {
    const picker = page.locator('jolly-color-picker[layout="wide"]').first();
    const track = picker.locator(".track.hue");
    await track.scrollIntoViewIfNeeded();
    const box = await boxOf(track);
    expect(box.height).toBeGreaterThan(box.width);

    await page.mouse.click(
      box.x + (box.width / 2),
      box.y + (box.height * 0.1)
    );

    expect(Number(await channel(picker, "h").inputValue()))
      .toBeGreaterThan(300);
  });

  test("commits a typed alpha percentage", async({ page }) => {
    const picker = page.locator('jolly-color-picker[layout="wide"]').nth(1);
    const alpha = channel(picker, "a");

    await expect(picker.locator(".track.alpha")).toBeVisible();
    await alpha.fill("25");
    await alpha.press("Enter");

    await expect(page.locator('[data-readout="wide alpha"]'))
      .toHaveText("#ff660040");
  });
});

test.describe("color picker: host-owned popup", () => {
  test("drives a popup with no jolly-color row and restores focus", async({ page }) => {
    await openExample(page, "scenarios/color-popover");

    const trigger = page.locator("gallery-brush-swatch button.trigger");
    const popup = page.locator("gallery-brush-swatch .popup");
    await trigger.click();
    await expect(popup).toBeVisible();

    await dragAreaToBlack(page, popup.locator(".area"));
    await expect(page.locator('[data-readout="brush"]'))
      .toHaveText("#000000ff");

    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
