// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import {
  fieldRow as row,
  boxOf,
  widthOf
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import { styleOf } from "../support/styles.ts";

// CONSTANTS
const kTransparent = "rgba(0, 0, 0, 0)";
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

function control(
  field: Locator
): Locator {
  return field.locator('input:not([type="color"])').first();
}

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
  expect(await widthOf(field.locator(".label").first()))
    .toBeGreaterThanOrEqual(80);
}

async function expectStableLockedLabel(
  page: Page,
  tag: string
): Promise<void> {
  const [plain, locked] = await Promise.all([
    boxOf(row(page, tag, "default").locator(".label")),
    boxOf(row(page, tag, "locked").locator(".label"))
  ]);

  expect(locked.x).toBe(plain.x);
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
        await expectStableLockedLabel(page, tag);
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

      await test.step("lock glyph and peer chip tooltips", async() => {
        const gutter = row(page, tag, "locked").locator(".gutter");
        const chip = row(page, tag, "peers").locator(".chip").first();

        await expect(gutter.locator("jolly-icon"))
          .toHaveAttribute("name", "lock");
        await expect(gutter.locator(".revert")).toHaveCount(0);
        await expect(gutter).toHaveAttribute("data-tooltip", /Held by/);
        await expect(chip).toHaveAttribute("data-tooltip", "Linus");

        for (const target of [gutter, chip]) {
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
          .toBe(kTransparent);

        await input.focus();
        await expect(input).toBeFocused();
        await expect.poll(() => styleOf(tint, "background-color"))
          .not.toBe(kTransparent);

        await expect(locked).toHaveCSS("box-shadow", /inset/);
        await expect(locked).not.toHaveCSS("background-color", kTransparent);
        await expect(locked).toHaveCSS("padding-block-start", "2px");
        await expect(locked).toHaveCSS("padding-block-end", "2px");
        expect(await styleOf(locked, "--jolly-locked-ring")).not.toBe("");
        expect(
          await styleOf(locked.locator(".chip").first(), "background-color")
        ).not.toBe(kTransparent);

        const [field, inner, value] = await Promise.all([
          boxOf(locked),
          boxOf(tint),
          boxOf(input)
        ]);
        expect(inner.y - field.y).toBe(2);
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
      await expectStableLockedLabel(page, tag);
      await expect(row(page, tag, "mixed")).toHaveAttribute("mixed", "");
      await expect(row(page, tag, "modified")).toHaveAttribute("modified", "");
      await expect(row(page, tag, "locked")).toHaveAttribute("locked", "");
      await expect(row(page, tag, "locked"))
        .toHaveCSS("padding-block-start", "2px");
      await expectPeerChips(page, tag);
    });
  }
});

test.describe("controls: field painting", () => {
  test("step sizes share one stable label column", async({ page }) => {
    await openExample(page, "scenarios/step-sizes");

    const fields = page.locator(
      ".scenario-grid :is(jolly-number, jolly-slider, jolly-range)"
    );
    await expect(fields).toHaveCount(8);
    await expect(fields.first()).toHaveCSS("--jolly-label-width", "10ch");

    const widths = await fields.locator(".label").evaluateAll(
      (labels) => labels.map((label) => label.getBoundingClientRect().width)
    );
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBeGreaterThan(60);
  });

  test("range draws a decorative capped span between its ends", async({ page }) => {
    await openExample(page, "controls/range");

    const range = row(page, "jolly-range", "default");
    const separator = range.locator(".separator");
    const muted = await styleOf(range.locator(".label"), "color");

    await expect(separator).toHaveAttribute("aria-hidden", "true");
    await expect(separator).toHaveText("");
    await expect(separator).toHaveCSS("color", muted);
    await expect(separator).toHaveCSS("border-inline-start-style", "solid");
    await expect(separator).toHaveCSS("border-inline-end-style", "solid");
    expect(await styleOf(separator, "height", "::after")).toBe("1px");
    expect(await styleOf(separator, "background-color", "::after"))
      .toBe(muted);
  });

  test("slider hover recolours the handle without resizing the track", async({ page }) => {
    await openExample(page, "controls/slider");

    const lane = row(page, "jolly-slider", "colored").locator(".lane");
    const restingHeight = await styleOf(lane, "height", "::before");
    const restingFill = await styleOf(lane, "--jolly-slider-thumb-fill");
    const hoverFill = await styleOf(lane, "--jolly-accent-fill-hover");

    await lane.hover();
    await expect.poll(() => styleOf(lane, "--jolly-slider-thumb-fill"))
      .not.toBe(restingFill);
    expect(await styleOf(lane, "--jolly-slider-thumb-fill")).toBe(hoverFill);

    await lane.evaluate((element) => Promise.all(
      element.getAnimations({ subtree: true }).map(
        (animation) => animation.finished
      )
    ));
    expect(await styleOf(lane, "height", "::before")).toBe(restingHeight);
  });

  test("slider value edges stay aligned across field chrome", async({ page }) => {
    await openExample(page, "controls/slider");

    const states = [
      "default",
      "modified",
      "locked",
      "peers",
      "mixed+modified"
    ];
    const boxes = await Promise.all(states.map(
      (state) => boxOf(row(page, "jolly-slider", state).locator(".value"))
    ));
    const edges = boxes.map((box) => box.x + box.width);

    expect(new Set(edges).size).toBe(1);
  });

  test("revert sits flush with its field and hovers to the same fill", async({ page }) => {
    await openExample(page, "controls/number");

    const field = row(page, "jolly-number", "modified");
    const input = control(field);
    const revert = field.locator(".revert");
    const [inputBox, revertBox] = await Promise.all([
      boxOf(input),
      boxOf(revert)
    ]);

    expect(revertBox.height).toBe(inputBox.height);
    expect(revertBox.x).toBe(inputBox.x + inputBox.width);

    const fill = await styleOf(input, "background-color");
    await revert.hover();
    await expect.poll(() => styleOf(revert, "background-color")).toBe(fill);
  });
});

test.describe("controls: theming", () => {
  test("a token backed property follows the theme", async({ page }) => {
    await openExample(page, "controls/number");

    const input = control(page.locator("jolly-number").first());
    const light = await styleOf(input, "background-color");
    expect(light).not.toBe("");

    await page.locator("gallery-root").evaluate(
      (root) => root.setAttribute("theme", "dark")
    );
    await expect.poll(() => styleOf(input, "background-color"))
      .not.toBe(light);
  });

  test("focus overrides the resting control fill", async({ page }) => {
    await openExample(page, "controls/text");

    const input = control(page.locator("jolly-text").first());
    const rest = await styleOf(input, "background-color");
    expect(rest).not.toBe(kTransparent);

    await input.focus();
    await expect.poll(() => styleOf(input, "background-color"))
      .not.toBe(rest);
  });
});
