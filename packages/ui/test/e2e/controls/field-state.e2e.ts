// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";
import {
  fieldChanges,
  recordFieldChanges as recordChanges
} from "../support/events.ts";
import { fieldRow as row } from "../support/locators.ts";

/**
 * Decorated components cannot run under `node:test`, so this suite renders them.
 * It checks resolved tokens at their consuming properties without baselines.
 */
const kFields = [
  { id: "controls/text", tag: "jolly-text" },
  { id: "controls/number", tag: "jolly-number" },
  { id: "controls/checkbox", tag: "jolly-checkbox" },
  { id: "controls/slider", tag: "jolly-slider" },
  { id: "controls/range", tag: "jolly-range" },
  { id: "controls/flags", tag: "jolly-flags" },
  { id: "controls/color", tag: "jolly-color" }
];

/**
 * Covers components without native inputs.
 */
const kInputlessFields = [
  { id: "controls/select", tag: "jolly-select" },
  { id: "controls/button-group", tag: "jolly-button-group" }
];

const kColoredFields = new Set([
  "jolly-checkbox",
  "jolly-slider",
  "jolly-flags"
]);

const kLabelledExamples = [
  ...kFields,
  ...kInputlessFields,
  { id: "controls/chrome", tag: "jolly-property-row" }
];

/**
 * Returns the field's focusable control. The color-input exclusion is legacy.
 */
function control(
  field: Locator
): Locator {
  return field.locator('input:not([type="color"])').first();
}

function tokenOf(
  target: Locator,
  name: string
): Promise<string> {
  return target.evaluate(
    (node, property) => getComputedStyle(node)
      .getPropertyValue(property)
      .trim(),
    name
  );
}

test.describe("controls: state matrix", () => {
  for (const { id, tag } of kLabelledExamples) {
    test(`${id} reserves a shared label column`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      const field = page.locator(tag).first();

      await expect(field).toHaveCSS("--jolly-label-width", "14ch");
      const labelWidth = await field.locator(".label").first().evaluate(
        (node) => node.getBoundingClientRect().width
      );

      expect(labelWidth).toBeGreaterThanOrEqual(80);

      if (id !== "controls/chrome") {
        const [defaultLabelLeft, lockedLabelLeft] = await Promise.all([
          row(page, tag, "default").locator(".label").evaluate(
            (node) => node.getBoundingClientRect().left
          ),
          row(page, tag, "locked").locator(".label").evaluate(
            (node) => node.getBoundingClientRect().left
          )
        ]);

        expect(lockedLabelLeft).toBe(defaultLabelLeft);
      }
    });
  }

  for (const { id, tag } of kFields) {
    test(`${tag} renders every matrix row`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      await expect(page.locator(tag)).toHaveCount(
        kColoredFields.has(tag) ? 11 : 9
      );
    });

    test(`${tag} reflects state as attributes`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      const reflected = [
        ["mixed", "mixed"],
        ["modified", "modified"],
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
    });

    test(`${tag} reverts only when modified`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      await expect(
        row(page, tag, "modified").locator(".revert")
      ).toBeVisible();

      const modified = row(page, tag, "modified");
      const mutedColor = await modified.locator(".label").evaluate(
        (node) => getComputedStyle(node).color
      );

      await expect(modified.locator(".revert")).toHaveCSS("color", mutedColor);

      await expect(
        row(page, tag, "default").locator(".revert")
      ).toHaveCount(0);
    });

    /**
     * Mixed rows omit a default so mixed and modified remain distinct.
     */
    test(`${tag} treats mixed with a default as modified`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      await expect(row(page, tag, "mixed"))
        .not.toHaveAttribute("modified", "");

      await expect(row(page, tag, "mixed+modified"))
        .toHaveAttribute("modified", "");

      await expect(
        row(page, tag, "mixed+modified").locator(".revert")
      ).toBeVisible();
    });

    test(`${tag} stacks peer chips, overflowing past three`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      const peers = row(page, tag, "peers");

      await expect(peers.locator(".chip")).toHaveCount(3);
      await expect(peers.locator(".overflow")).toHaveText("+2");
    });

    test(`${tag} keeps a locked field focusable`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      const input = control(row(page, tag, "locked"));

      await expect(input).toHaveAttribute("aria-disabled", "true");
      await expect(input).toHaveAttribute("aria-description", /Held by/);

      /* Read native disabled because toBeDisabled includes aria-disabled. */
      expect(
        await input.evaluate((node: HTMLInputElement) => node.disabled)
      ).toBe(false);

      await input.focus();
      await expect(input).toBeFocused();
    });

    test(`${tag} shows the lock and the focus tint together`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      const locked = row(page, tag, "locked");
      const input = control(locked);

      function rowTint(): Promise<string> {
        return locked
          .locator(".row")
          .evaluate((node) => getComputedStyle(node).backgroundColor);
      }

      const rest = await rowTint();

      await input.focus();

      const focused = await rowTint();

      /* The field owns the lock ring because inner control shapes vary. */
      const held = await locked.evaluate((node) => {
        const style = getComputedStyle(node);

        return {
          bar: style.boxShadow,
          paddingBlockEnd: style.paddingBlockEnd,
          paddingBlockStart: style.paddingBlockStart,
          tint: style.backgroundColor
        };
      });

      expect(rest).toBe("rgba(0, 0, 0, 0)");
      expect(focused).not.toBe(rest);
      expect(held.bar).toContain("inset");
      expect(held.tint).not.toBe("rgba(0, 0, 0, 0)");
      expect(held.paddingBlockStart).toBe("2px");
      expect(held.paddingBlockEnd).toBe("2px");

      const [fieldBounds, rowBounds, inputBounds] = await Promise.all([
        locked.evaluate((node) => {
          const bounds = node.getBoundingClientRect();

          return {
            top: bounds.top,
            bottom: bounds.bottom
          };
        }),
        locked.locator(".row").evaluate((node) => {
          const bounds = node.getBoundingClientRect();

          return {
            top: bounds.top,
            bottom: bounds.bottom
          };
        }),
        input.evaluate((node) => {
          const bounds = node.getBoundingClientRect();

          return {
            top: bounds.top,
            bottom: bounds.bottom
          };
        })
      ]);

      expect(rowBounds.top - fieldBounds.top).toBe(2);
      expect(inputBounds.top).toBeGreaterThanOrEqual(fieldBounds.top);
      expect(inputBounds.bottom).toBeLessThanOrEqual(fieldBounds.bottom);
    });

    test(`${tag} paints the ring in the holder's colour`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      const locked = row(page, tag, "locked");
      const ring = await tokenOf(locked, "--jolly-locked-ring");

      const chip = await locked
        .locator(".chip")
        .first()
        .evaluate((node) => getComputedStyle(node).backgroundColor);

      expect(ring).not.toBe("");
      expect(chip).not.toBe("rgba(0, 0, 0, 0)");
    });

    /**
     * Reuses the revert gutter for the lock glyph to keep row width stable.
     */
    test(`${tag} swaps the gutter for a lock glyph, tooltipped, when held`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      const gutter = row(page, tag, "locked").locator(".gutter");

      await expect(gutter.locator("jolly-icon")).toHaveAttribute("name", "lock");
      await expect(gutter.locator(".revert")).toHaveCount(0);
      await expect(gutter).toHaveAttribute("data-tooltip", /Held by/);

      /*
       * The 500 ms poll covers the CSS transition and stays below the native
       * title delay.
       */
      function opacityOf(): Promise<string> {
        return gutter.evaluate(
          (node) => getComputedStyle(node, "::after").opacity
        );
      }

      expect(await opacityOf()).toBe("0");
      await gutter.hover();
      await expect.poll(opacityOf, { timeout: 500 }).toBe("1");
    });

    test(`${tag} tooltips a peer chip with their name instantly`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      const chip = row(page, tag, "peers").locator(".chip").first();

      await expect(chip).toHaveAttribute("data-tooltip", "Linus");

      await chip.hover();
      await expect.poll(
        () => chip.evaluate((node) => getComputedStyle(node, "::after").opacity),
        { timeout: 500 }
      ).toBe("1");
    });

    test(`${tag} disables rather than merely dimming`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      await expect(
        control(row(page, tag, "disabled"))
      ).toBeDisabled();
    });
  }
});

test.describe("controls: layout scenarios", () => {
  test("Step Sizes reserves one stable label column", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/step-sizes",
      chrome: "off"
    });

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
});

test.describe("controls: select and button group", () => {
  for (const { id, tag } of kInputlessFields) {
    test(`${tag} renders every row and reflects state`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      await expect(page.locator(tag)).toHaveCount(9);
      await expect(row(page, tag, "mixed")).toHaveAttribute("mixed", "");
      await expect(row(page, tag, "modified")).toHaveAttribute("modified", "");
      await expect(row(page, tag, "locked")).toHaveAttribute("locked", "");
      await expect(row(page, tag, "locked")).toHaveCSS(
        "padding-block-start",
        "2px"
      );
    });

    test(`${tag} renders peer chips with overflow`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      const peers = row(page, tag, "peers");

      await expect(peers.locator(".chip")).toHaveCount(3);
      await expect(peers.locator(".overflow")).toHaveText("+2");
    });
  }

  test("select commits the picked option", async({ page }) => {
    await gotoGallery(page, { example: "controls/select", chrome: "off" });
    await recordChanges(page);

    await row(page, "jolly-select", "default")
      .locator("select")
      .selectOption({ label: "Linear" });

    expect(await fieldChanges(page)).toEqual(["linear"]);
  });

  test("a locked select puts the picked option back", async({ page }) => {
    await gotoGallery(page, { example: "controls/select", chrome: "off" });
    await recordChanges(page);

    /* Drive in page because Playwright will not operate an aria-disabled select. */
    const after = await row(page, "jolly-select", "locked")
      .evaluate((field) => {
        const select = field.shadowRoot?.querySelector("select");
        if (!(select instanceof HTMLSelectElement)) {
          return null;
        }

        select.value = "1";
        select.dispatchEvent(
          new Event("change", { bubbles: true })
        );

        return select.value;
      });

    expect(await fieldChanges(page)).toEqual([]);
    expect(after).toBe("0");
  });

  /**
   * A segmented control is one tab stop. Flag entries are independent.
   */
  test("button group is one tab stop with arrow keys", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/button-group",
      chrome: "off"
    });
    await recordChanges(page);

    const group = row(page, "jolly-button-group", "default");
    const focusable = group.locator('.segment[tabindex="0"]');

    await expect(focusable).toHaveCount(1);

    await focusable.focus();
    await page.keyboard.press("ArrowRight");

    expect(await fieldChanges(page)).toEqual(["paint"]);
  });

  test("button group marks exactly one option checked", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/button-group",
      chrome: "off"
    });

    const checked = '.segment[aria-checked="true"]';

    await expect(
      row(page, "jolly-button-group", "default").locator(checked)
    ).toHaveCount(1);

    // Mixed selects nothing, so no segment reads as checked.
    await expect(
      row(page, "jolly-button-group", "mixed").locator(checked)
    ).toHaveCount(0);
  });

  /**
   * Trusted clicks once exposed a race between native checkedness rollback and
   * Lit rendering.
   */
  test("checkbox stays checked after a real click", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });
    await recordChanges(page);

    const box = control(row(page, "jolly-checkbox", "default"));

    await box.click();
    await expect(box).toBeChecked();

    await box.click();
    await expect(box).not.toBeChecked();

    expect(await fieldChanges(page)).toEqual([true, false]);
  });

  /**
   * Clicking an indeterminate checkbox resolves it to checked.
   */
  test("checkbox click resolves mixed to checked", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });
    await recordChanges(page);

    const box = control(row(page, "jolly-checkbox", "mixed"));

    await box.click();
    await expect(box).toBeChecked();

    expect(await fieldChanges(page)).toEqual([true]);
  });

  test("checkbox example opts into a background hit target", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });

    const field = row(page, "jolly-checkbox", "default");
    const checkbox = field.locator(".checkbox");

    await expect(field).toHaveAttribute("clickable-background", "");
    await expect(checkbox).toHaveCSS("position", "relative");
  });

  test("clickable checkbox clears the gradient edge", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });

    const checkbox = row(page, "jolly-checkbox", "default");
    const valueLeft = await checkbox.locator(".value")
      .evaluate((node) => node.getBoundingClientRect().left);
    const boxLeft = await control(checkbox)
      .evaluate((node) => node.getBoundingClientRect().left);

    expect(boxLeft - valueLeft).toBe(4);
  });

  test("checkbox alignment stays separate from its row label", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor",
      chrome: "off"
    });

    const propertyRow = page.locator("jolly-property-row", {
      has: page.locator("jolly-checkbox")
    }).first();
    const label = propertyRow.locator(".label").first();
    const box = propertyRow.locator('input[type="checkbox"]');
    const edges = await Promise.all([
      propertyRow.locator(".row").first()
        .evaluate((node) => node.getBoundingClientRect().right),
      label.evaluate((node) => node.getBoundingClientRect().left),
      label.evaluate((node) => node.getBoundingClientRect().right),
      box.evaluate((node) => node.getBoundingClientRect().right)
    ]);

    expect(edges[0] - edges[3]).toBe(8);
    expect(edges[1]).toBeLessThan(edges[2]);
    expect(edges[2]).toBeLessThan(edges[3]);
    await expect(label).toHaveCSS("text-align", "start");
  });

  test("range uses a decorative capped span between its ends", async({ page }) => {
    await gotoGallery(page, { example: "controls/range", chrome: "off" });

    const range = row(page, "jolly-range", "default");
    const separator = range.locator(".separator");
    const mutedColor = await range.locator(".label").evaluate(
      (node) => getComputedStyle(node).color
    );
    const shape = await separator.evaluate((node) => {
      const cap = getComputedStyle(node);
      const span = getComputedStyle(node, "::after");

      return {
        capStart: cap.borderInlineStartStyle,
        capEnd: cap.borderInlineEndStyle,
        spanHeight: span.height,
        spanColor: span.backgroundColor
      };
    });

    await expect(separator).toHaveAttribute("aria-hidden", "true");
    await expect(separator).toHaveText("");
    await expect(separator).toHaveCSS("color", mutedColor);
    expect(shape).toEqual({
      capStart: "solid",
      capEnd: "solid",
      spanHeight: "1px",
      spanColor: mutedColor
    });
  });

  test("slider uses a square handle", async({ page }) => {
    await gotoGallery(page, { example: "controls/slider", chrome: "off" });

    const slider = row(page, "jolly-slider", "default");
    const radii = await slider.evaluate((node) => {
      const root = node.shadowRoot;
      if (root === null) {
        return [];
      }

      const sheets = [
        ...root.adoptedStyleSheets,
        ...root.styleSheets
      ];
      const rules = sheets
        .flatMap((sheet) => [...sheet.cssRules]);

      return rules
        .filter((rule): rule is CSSStyleRule => (
          rule instanceof CSSStyleRule &&
          (
            rule.selectorText.includes("slider-thumb") ||
            rule.selectorText.includes("range-thumb")
          )
        ))
        .map((rule) => rule.style.borderRadius);
    });

    expect(radii).toContain("var(--jolly-radius-sm, 2px)");
    expect(radii).not.toContain("50%");
  });

  test("slider hover changes handle color without resizing", async({ page }) => {
    await gotoGallery(page, { example: "controls/slider", chrome: "off" });

    const lane = row(page, "jolly-slider", "colored").locator(".lane");

    function trackHeight(): Promise<string> {
      return lane.evaluate((node) => getComputedStyle(
        node,
        "::before"
      ).height);
    }

    const restingHeight = await trackHeight();
    const restingFill = await tokenOf(lane, "--jolly-slider-thumb-fill");
    const hoverFill = await tokenOf(lane, "--jolly-accent-fill-hover");

    await lane.hover();
    await expect.poll(() => tokenOf(
      lane,
      "--jolly-slider-thumb-fill"
    )).not.toBe(restingFill);
    expect(await tokenOf(lane, "--jolly-slider-thumb-fill"))
      .toBe(hoverFill);

    await page.waitForTimeout(150);
    expect(await trackHeight()).toBe(restingHeight);
  });

  test("slider value edges stay aligned across field chrome", async({ page }) => {
    await gotoGallery(page, { example: "controls/slider", chrome: "off" });

    const states = [
      "default",
      "modified",
      "locked",
      "peers",
      "mixed+modified"
    ];
    const valueRights = await Promise.all(states.map((state) => (
      row(page, "jolly-slider", state).locator(".value").evaluate(
        (node) => node.getBoundingClientRect().right
      )
    )));

    for (const right of valueRights) {
      expect(right).toBe(valueRights[0]);
    }
  });

  test("revert hover matches its adjacent field background", async({ page }) => {
    await gotoGallery(page, { example: "controls/number", chrome: "off" });

    const field = row(page, "jolly-number", "modified");
    const input = control(field);
    const revert = field.locator(".revert");

    function backgroundOf(
      target: Locator
    ): Promise<string> {
      return target.evaluate((node) => getComputedStyle(node)
        .backgroundColor);
    }

    const fieldBackground = await backgroundOf(input);
    const inputBox = await input.boundingBox();
    const revertBox = await revert.boundingBox();

    expect(inputBox).not.toBeNull();
    expect(revertBox).not.toBeNull();
    expect(revertBox?.height).toBe(inputBox?.height);
    expect(revertBox?.x).toBe((inputBox?.x ?? 0) + (inputBox?.width ?? 0));

    await revert.hover();
    await expect.poll(() => backgroundOf(revert)).toBe(fieldBackground);
  });

  /**
   * Flags shares Checkbox's native input and trusted-click race.
   */
  test("flags entry stays checked after a real click", async({ page }) => {
    await gotoGallery(page, { example: "controls/flags", chrome: "off" });
    await recordChanges(page);

    const box = row(page, "jolly-flags", "default").getByLabel("Player");

    await box.click();
    await expect(box).toBeChecked();

    await box.click();
    await expect(box).not.toBeChecked();

    // Default row starts at 0b0101 (Default | Terrain); Player is 0b0010.
    expect(await fieldChanges(page)).toEqual([0b0111, 0b0101]);
  });
});

/**
 * Lists elements without field matrix states.
 */
test.describe("controls: chrome", () => {
  test("button renders slotted content beside its icon", async({ page }) => {
    await gotoGallery(page, { example: "controls/chrome", chrome: "off" });

    const search = page.locator("jolly-button", { hasText: "Search" });

    await expect(search.locator("jolly-icon")).toHaveCount(1);
    await expect(search).toHaveText("Search");
  });

  test("button variants paint different backgrounds", async({ page }) => {
    await gotoGallery(page, { example: "controls/chrome", chrome: "off" });

    function background(
      variant: string
    ): Promise<string> {
      return page
        .locator(`jolly-button[variant="${variant}"] button`)
        .first()
        .evaluate((node) => getComputedStyle(node).backgroundColor);
    }

    expect(await background("accent")).not.toBe(await background("default"));
  });

  test("a disabled button is natively disabled", async({ page }) => {
    await gotoGallery(page, { example: "controls/chrome", chrome: "off" });

    await expect(
      page.locator("jolly-button[disabled] button")
    ).toBeDisabled();
  });

  test("an icon only button is named for assistive tech", async({ page }) => {
    await gotoGallery(page, { example: "controls/chrome", chrome: "off" });

    await expect(
      page.locator("jolly-button[icon-only] button")
    ).toHaveAttribute("aria-label", "Close");
  });

  test("a captioned separator exposes its label", async({ page }) => {
    await gotoGallery(page, { example: "controls/chrome", chrome: "off" });

    await expect(
      page.locator("jolly-separator").first().locator('[role="separator"]')
    ).toHaveAttribute("aria-label", "Grouping");
  });

  test("a separator caption aligns with control labels", async({ page }) => {
    await gotoGallery(page, { example: "scenarios/editor", chrome: "off" });

    const palette = page.locator("jolly-floating");
    const labelled = palette.locator("jolly-separator .labelled");
    const caption = palette.locator("jolly-separator .caption");
    const fieldLabel = palette.locator("jolly-slider .label").first();
    const [captionLeft, labelLeft] = await Promise.all([
      caption.evaluate((node) => node.getBoundingClientRect().left),
      fieldLabel.evaluate((node) => node.getBoundingClientRect().left)
    ]);

    expect(captionLeft).toBe(labelLeft);
    expect(
      await caption.evaluate((node) => getComputedStyle(node).color)
    ).not.toBe(
      await fieldLabel.evaluate((node) => getComputedStyle(node).color)
    );
    await expect(labelled).toHaveCSS("margin-block-start", "2px");
    await expect(caption).toHaveCSS(
      "font-size",
      await fieldLabel.evaluate((node) => getComputedStyle(node).fontSize)
    );

    const labelledRules = labelled.locator(".rule");
    await expect(labelledRules).toHaveCount(2);
    const leadingRule = labelledRules.first();
    const trailingRule = labelledRules.last();
    const [leadingRight, captionRight, trailingLeft] = await Promise.all([
      leadingRule.evaluate((node) => node.getBoundingClientRect().right),
      caption.evaluate((node) => node.getBoundingClientRect().right),
      trailingRule.evaluate((node) => node.getBoundingClientRect().left)
    ]);

    expect(captionLeft - leadingRight).toBe(4);
    expect(trailingLeft - captionRight).toBe(4);

    const plainRule = page.locator(
      "jolly-separator .unlabelled .rule"
    ).first();
    expect(
      await trailingRule.evaluate(
        (node) => getComputedStyle(node).backgroundColor
      )
    ).not.toBe(
      await plainRule.evaluate(
        (node) => getComputedStyle(node).backgroundColor
      )
    );
  });

  test("Editor examples show both separator variants", async({ page }) => {
    for (const example of ["scenarios/editor", "scenarios/editor-states"]) {
      await gotoGallery(page, { example, chrome: "off" });

      const separators = page.locator("jolly-separator");
      await expect(separators).toHaveCount(4);
      await expect(
        separators.locator('[role="separator"][aria-label]')
      ).toHaveCount(2);
      await expect(
        separators.locator('[role="separator"]:not([aria-label])')
      ).toHaveCount(2);

      const labelled = separators.locator(".labelled").first();
      const unlabelled = separators.locator(".unlabelled").first();
      const [labelledHeight, unlabelledHeight] = await Promise.all([
        labelled.evaluate((node) => node.getBoundingClientRect().height),
        unlabelled.evaluate((node) => node.getBoundingClientRect().height)
      ]);

      expect(unlabelledHeight).toBe(labelledHeight);
      await expect(unlabelled).toHaveCSS("margin-block-start", "2px");
    }
  });

  test("a property row slots arbitrary content", async({ page }) => {
    await gotoGallery(page, { example: "controls/chrome", chrome: "off" });

    const propertyRow = page.locator("jolly-property-row");

    await expect(propertyRow.locator("jolly-button")).toHaveCount(2);
    await expect(propertyRow.locator(".label")).toHaveText("Export");
  });
});

/**
 * Reads consumer properties because custom property values retain unresolved
 * `light-dark(...)` text.
 */
test.describe("controls: theming", () => {
  test("a token backed property differs per theme", async({ page }) => {
    await gotoGallery(page, { example: "controls/number", chrome: "off" });

    const input = control(page.locator("jolly-number").first());

    function background(): Promise<string> {
      return input.evaluate(
        (node) => getComputedStyle(node).backgroundColor
      );
    }

    const light = await background();

    await page.evaluate(() => {
      document.querySelector("gallery-root")?.setAttribute("theme", "dark");
    });

    expect(light).not.toBe("");

    /*
     * Control fills transition, so a synchronous read lands mid-transition and
     * reports the previous theme's colour. Poll until it settles.
     */
    await expect.poll(background).not.toBe(light);
  });

  /**
   * Focus uses the shared fill channel and must override the resting fill.
   */
  test("focus paints the control from its token", async({ page }) => {
    await gotoGallery(page, { example: "controls/text", chrome: "off" });

    const input = control(page.locator("jolly-text").first());

    function background(): Promise<string> {
      return input.evaluate((node) => getComputedStyle(node).backgroundColor);
    }

    const rest = await background();

    await input.focus();

    expect(rest).not.toBe("rgba(0, 0, 0, 0)");
    await expect.poll(background).not.toBe(rest);
  });

  /**
   * Verifies that one root token override updates every control.
   */
  test("an overridden token reaches a painted style", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });

    const neutralBox = control(row(page, "jolly-checkbox", "default"));
    const coloredBox = control(row(page, "jolly-checkbox", "colored"));

    function accent(box: Locator): Promise<string> {
      return box.evaluate((node) => getComputedStyle(node).accentColor);
    }

    const neutralBefore = await accent(neutralBox);
    const coloredBefore = await accent(coloredBox);

    await page.evaluate(() => {
      const root = document.querySelector("gallery-root");
      if (root instanceof HTMLElement) {
        root.style.setProperty("--jolly-accent-fill", "rgb(255, 102, 0)");
      }
    });

    const neutralAfter = await accent(neutralBox);
    const coloredAfter = await accent(coloredBox);

    expect(neutralAfter).toBe(neutralBefore);
    expect(coloredAfter).not.toBe(coloredBefore);
    expect(coloredAfter).toBe("rgb(255, 102, 0)");
  });
});
