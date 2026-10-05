// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import {
  boxOf,
  widthOf
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  TRANSPARENT,
  fieldControl as control
} from "../support/field.ts";
import { fieldRow as row, openExample } from "../support/gallery.ts";
import { styleOf } from "../support/styles.ts";

// CONSTANTS
const kFields = [
  { id: "controls/text", tag: "jolly-text", colored: false },
  { id: "controls/number", tag: "jolly-number", colored: false },
  { id: "controls/checkbox", tag: "jolly-checkbox", colored: true },
  { id: "controls/slider", tag: "jolly-slider", colored: true },
  { id: "controls/range", tag: "jolly-range", colored: false },
  { id: "controls/flags", tag: "jolly-flags", colored: true },
  { id: "controls/color", tag: "jolly-color", colored: false }
];
const kInputlessFields = [
  { id: "controls/select", tag: "jolly-select" },
  { id: "controls/button-group", tag: "jolly-button-group" }
];

function paintOf(
  field: Locator,
  tag: string
): Promise<string> {
  return tag === "jolly-slider" ?
    styleOf(field.locator(".lane"), "background-image", "::before") :
    styleOf(control(field), "accent-color");
}

async function expectLabelColumn(
  page: Page,
  tag: string
): Promise<void> {
  const field = page.locator(tag).first();

  await expect(field).toHaveCSS("--jolly-label-width", "14ch");
  expect(await widthOf(field.locator(".label-cell").first()))
    .toBeGreaterThanOrEqual(80);
}

async function expectStableLockedLayout(
  page: Page,
  tag: string
): Promise<void> {
  const plain = row(page, tag, "default");
  const locked = row(page, tag, "locked");
  const [plainLabel, lockedLabel, plainValue, lockedValue, plainRow, lockedRow] =
    await Promise.all([
      boxOf(plain.locator(".label")),
      boxOf(locked.locator(".label")),
      boxOf(plain.locator(".value")),
      boxOf(locked.locator(".value")),
      boxOf(plain),
      boxOf(locked)
    ]);

  expect(lockedLabel.x).toBe(plainLabel.x);
  expect(lockedValue.x).toBe(plainValue.x);
  expect(lockedValue.width).toBe(plainValue.width);
  expect(lockedRow.height).toBe(plainRow.height);
}

async function expectPeerChips(
  page: Page,
  tag: string
): Promise<void> {
  const peers = row(page, tag, "peers");

  await expect(peers.locator(".chip")).toHaveCount(3);
  await expect(peers.locator(".overflow")).toHaveText("+2");
}

test.describe("controls: state matrix", () => {
  for (const { id, tag, colored } of kFields) {
    test(`${tag} renders every matrix state`, async({ page }) => {
      await openExample(page, id);

      await test.step("rows and label column", async() => {
        await expect(page.locator(tag)).toHaveCount(colored ? 11 : 9);
        await expectLabelColumn(page, tag);
        await expectStableLockedLayout(page, tag);
      });

      await test.step("state attributes", async() => {
        const reflected = [
          ["mixed", "mixed"],
          ["modified", "modified"],
          ["mixed+modified", "modified"],
          ["error", "invalid"],
          ["disabled", "disabled"],
          ["readonly", "readonly"],
          ["locked", "locked"]
        ];
        for (const [state, flag] of reflected) {
          await expect(row(page, tag, state)).toHaveAttribute(flag, "");
        }

        await expect(row(page, tag, "default"))
          .not.toHaveAttribute("modified", "");
        await expect(row(page, tag, "mixed"))
          .not.toHaveAttribute("modified", "");
        await expect(control(row(page, tag, "disabled"))).toBeDisabled();
      });

      await test.step("revert gutter only when modified", async() => {
        const modified = row(page, tag, "modified");
        const revert = modified.locator(".revert");

        await expect(revert).toBeVisible();
        await expect(revert).toHaveCSS(
          "color",
          await styleOf(modified.locator(".label"), "color")
        );
        await expect(
          row(page, tag, "mixed+modified").locator(".revert")
        ).toBeVisible();
        await expect(
          row(page, tag, "default").locator(".revert")
        ).toHaveCount(0);
      });

      await test.step("peer chips overflow past three", async() => {
        await expectPeerChips(page, tag);
      });

      if (colored) {
        await test.step("accent paint is opt-in", async() => {
          const neutral = row(page, tag, "default");
          const accented = row(page, tag, "colored");

          await expect(neutral).toHaveJSProperty("colored", false);
          await expect(neutral).not.toHaveAttribute("colored", "");
          await expect(accented).toHaveJSProperty("colored", true);
          await expect(accented).toHaveAttribute("colored", "");
          expect(await paintOf(neutral, tag))
            .not.toBe(await paintOf(accented, tag));
        });
      }

      await test.step("lock and peer chip tooltips", async() => {
        const locked = row(page, tag, "locked");
        const tint = locked.locator(".row");
        const chip = row(page, tag, "peers").locator(".chip").first();

        await expect(locked.locator(".gutter jolly-icon")).toHaveCount(0);
        await expect(locked.locator(".chip")).toHaveCount(0);
        await expect(tint).toHaveAttribute("data-tooltip", /Held by/);
        await expect(chip).toHaveAttribute("data-tooltip", "Linus");

        for (const target of [tint, chip]) {
          await expect.poll(
            () => styleOf(target, "opacity", "::after")
          ).toBe("0");
          await target.hover();
          await expect.poll(
            () => styleOf(target, "opacity", "::after"),
            { timeout: 500 }
          ).toBe("1");
        }

        await page.mouse.move(0, 0);
      });

      await test.step("a locked field stays focusable inside its ring", async() => {
        const locked = row(page, tag, "locked");
        const input = control(locked);
        const tint = locked.locator(".row");

        await expect(input).toHaveAttribute("aria-disabled", "true");
        await expect(input).toHaveAttribute("aria-description", /Held by/);
        expect(
          await input.evaluate((node: HTMLInputElement) => node.disabled)
        ).toBe(false);
        await expect.poll(() => styleOf(tint, "background-color"))
          .toBe(TRANSPARENT);

        await input.focus();
        await expect(input).toBeFocused();
        await expect.poll(() => styleOf(tint, "background-color"))
          .not.toBe(TRANSPARENT);

        await expect(locked).toHaveCSS("box-shadow", /inset/);
        await expect(locked).not.toHaveCSS("background-color", TRANSPARENT);
        await expect(locked).toHaveCSS("padding-block-start", "0px");
        expect(await styleOf(locked, "--jolly-locked-ring")).not.toBe("");

        const [field, inner, value] = await Promise.all([
          boxOf(locked),
          boxOf(tint),
          boxOf(input)
        ]);
        expect(inner.y).toBe(field.y);
        expect(value.y).toBeGreaterThanOrEqual(field.y);
        expect(value.y + value.height)
          .toBeLessThanOrEqual(field.y + field.height);
      });
    });
  }

  for (const { id, tag } of kInputlessFields) {
    test(`${tag} renders every matrix state`, async({ page }) => {
      await openExample(page, id);

      await expect(page.locator(tag)).toHaveCount(9);
      await expectLabelColumn(page, tag);
      await expectStableLockedLayout(page, tag);
      await expect(row(page, tag, "mixed")).toHaveAttribute("mixed", "");
      await expect(row(page, tag, "modified")).toHaveAttribute("modified", "");
      await expect(row(page, tag, "locked")).toHaveAttribute("locked", "");
      await expect(row(page, tag, "locked"))
        .toHaveCSS("padding-block-start", "0px");
      await expectPeerChips(page, tag);
    });
  }
});
