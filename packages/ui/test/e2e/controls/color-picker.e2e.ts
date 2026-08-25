// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";
import {
  fieldChanges as changes,
  recordFieldChanges as recordChanges
} from "../support/events.ts";

function row(
  page: Page,
  state: string
): Locator {
  return page.locator(`[data-state="${state}"] jolly-color`);
}

async function lastChange(
  page: Page
): Promise<unknown> {
  const collected = await changes(page);

  return collected.at(-1);
}

async function openPicker(
  field: Locator
): Promise<Locator> {
  await field.locator("button.swatch").click();

  const popover = field.locator(".popover");
  await expect(popover).toBeVisible();

  return popover;
}

/**
 * Uses few drag steps to avoid test timeouts caused by high step counts.
 */
async function dragArea(
  page: Page,
  area: Locator,
  to: { x: number; y: number; }
): Promise<void> {
  const box = await area.boundingBox();
  if (box === null) {
    throw new Error("the saturation area has no layout box");
  }

  await page.mouse.move(
    box.x + (box.width / 2),
    box.y + (box.height / 2)
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + (box.width * to.x),
    box.y + (box.height * to.y),
    { steps: 3 }
  );
  await page.mouse.up();
}

test.describe("color: popup", () => {
  test("opens on the swatch and focuses the panel", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color",
      chrome: "off"
    });

    const field = row(page, "default");
    const popover = await openPicker(field);

    await expect(field.locator("button.swatch")).toHaveAttribute("aria-expanded", "true");
    await expect(
      popover.locator('input[aria-label="Saturation"]')
    ).toBeFocused();
  });

  test("dragging the area commits a colour", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color",
      chrome: "off"
    });
    await recordChanges(page);

    const popover = await openPicker(row(page, "default"));

    // Bottom-left is zero saturation and zero value, whatever the hue.
    await dragArea(page, popover.locator(".area"), {
      x: 0,
      y: 1
    });

    expect(await lastChange(page)).toBe("#000000");
  });

  test("Escape reverts to the colour held when the popup opened", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color",
      chrome: "off"
    });
    await recordChanges(page);

    const field = row(page, "default");
    const popover = await openPicker(field);

    await dragArea(page, popover.locator(".area"), {
      x: 0,
      y: 1
    });
    expect(await lastChange(page)).toBe("#000000");

    await page.keyboard.press("Escape");

    await expect(popover).toBeHidden();
    expect(await lastChange(page)).toBe("#4488ff");
    await expect(field.locator("button.swatch")).toBeFocused();
  });

  test("dismissing by clicking away accepts the committed colour", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color",
      chrome: "off"
    });
    await recordChanges(page);

    const popover = await openPicker(row(page, "default"));
    await dragArea(page, popover.locator(".area"), {
      x: 0,
      y: 1
    });

    await page.mouse.click(2, 2);

    await expect(popover).toBeHidden();
    expect(await lastChange(page)).toBe("#000000");
  });

  test("does not open from a disabled row", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color",
      chrome: "off"
    });

    const field = row(page, "disabled");
    await field.locator("button.swatch").click({ force: true });

    await expect(field.locator(".popover")).toBeHidden();
  });
});

test.describe("color: alpha", () => {
  test("emits six digits when alpha is off", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color",
      chrome: "off"
    });
    await recordChanges(page);

    const popover = await openPicker(row(page, "default"));
    await expect(popover.locator(".track.alpha")).toHaveCount(0);

    await popover.locator('input[aria-label="Hue"]').focus();
    await page.keyboard.press("ArrowRight");

    expect(await lastChange(page)).toMatch(/^#[0-9a-f]{6}$/);
  });

  test("emits eight digits and shows the track when alpha is on", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color-alpha",
      chrome: "off"
    });
    await recordChanges(page);

    const popover = await openPicker(row(page, "default"));
    await expect(popover.locator(".track.alpha")).toBeVisible();

    await popover.locator('input[aria-label="Alpha"]').focus();
    await page.keyboard.press("ArrowLeft");

    expect(await lastChange(page)).toMatch(/^#[0-9a-f]{8}$/);
  });

  test("reports alpha as a number and commits a typed one", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color-alpha",
      chrome: "off"
    });
    await recordChanges(page);

    const popover = await openPicker(row(page, "default"));
    const readout = popover.locator("input.readout");

    // The row opens on #4488ffcc, and 0xcc is 0.8.
    await expect(readout).toHaveValue("0.80");

    await readout.fill("0.5");
    await readout.press("Enter");

    expect(await lastChange(page)).toBe("#4488ff80");
  });

  test("evaluates an alpha expression before committing it", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color-alpha",
      chrome: "off"
    });
    await recordChanges(page);

    const popover = await openPicker(row(page, "default"));
    const readout = popover.locator("input.readout");

    await readout.fill("1 / 2");
    await readout.press("Enter");

    expect(await lastChange(page)).toBe("#4488ff80");
  });

  test("cancels an unparsable alpha instead of reporting an error", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color-alpha",
      chrome: "off"
    });
    await recordChanges(page);

    const popover = await openPicker(row(page, "default"));
    const readout = popover.locator("input.readout");

    await readout.fill("nope");
    await readout.press("Enter");

    await expect(readout).toHaveValue("0.80");
    expect(await changes(page)).toEqual([]);
  });

  test("accepts an eight digit value in the row's hex field", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color-alpha",
      chrome: "off"
    });
    await recordChanges(page);

    const input = row(page, "default").locator("input.hex");
    await input.fill("#ff660080");
    await input.press("Enter");

    expect(await lastChange(page)).toBe("#ff660080");
  });
});

test.describe("color picker: standalone panel", () => {
  test("commits a shorthand hex typed into the panel field", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color-picker",
      chrome: "off"
    });

    const panel = page.locator('[data-readout="default"]');
    const input = page.locator("jolly-color-picker").first().locator("input.hex");

    await input.fill("#f60");
    await input.press("Enter");

    await expect(panel).toHaveText("#ff6600");
  });

  test("marks an unparsable hex without committing it", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color-picker",
      chrome: "off"
    });

    const panel = page.locator('[data-readout="default"]');
    const input = page.locator("jolly-color-picker").first().locator("input.hex");

    await input.fill("not-a-color");
    await input.press("Enter");

    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(panel).toHaveText("#4488ff");
  });

  test("keeps hue and saturation across a trip through black", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color-picker",
      chrome: "off"
    });

    const panel = page.locator('[data-readout="default"]');
    const value = page.locator("jolly-color-picker")
      .first()
      .locator('input[aria-label="Value"]');

    // Hex loses hue at zero value. The held tuple must restore blue.
    await value.focus();
    await page.keyboard.press("Home");
    await expect(panel).toHaveText("#000000");

    await page.keyboard.press("End");
    await expect(panel).toHaveText("#4488ff");
  });

  test("drives a popup with no jolly-color row", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/color-popover",
      chrome: "off"
    });

    const trigger = page.locator("gallery-brush-swatch button.trigger");
    await trigger.click();

    const popup = page.locator("gallery-brush-swatch .popup");
    await expect(popup).toBeVisible();

    await dragArea(page, popup.locator(".area"), {
      x: 0,
      y: 1
    });

    await expect(
      page.locator('[data-readout="brush"]')
    ).toHaveText("#000000ff");
  });

  test("restores focus to the trigger when the popup closes", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/color-popover",
      chrome: "off"
    });

    const trigger = page.locator("gallery-brush-swatch button.trigger");
    await trigger.click();
    await expect(page.locator("gallery-brush-swatch .popup")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.locator("gallery-brush-swatch .popup")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("rejects edits on a readonly panel", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/color-picker",
      chrome: "off"
    });

    const panel = page.locator('[data-readout="readonly"]');
    const hue = page.locator("jolly-color-picker")
      .nth(3)
      .locator('input[aria-label="Hue"]');

    await hue.focus();
    await page.keyboard.press("ArrowRight");

    await expect(panel).toHaveText("#aa2255");
  });
});
