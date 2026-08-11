// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "./utils.ts";

/**
 * Components are unreachable from `node:test`, since a decorator is not
 * erasable syntax, so this is the only tier that sees one rendered.
 *
 * It asserts resolved tokens against the properties consuming them rather
 * than pixels: that catches a control reading the wrong token, a state
 * channel not painting, and `light-dark()` failing to resolve, with no per
 * platform baselines.
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
 * These two render no `input`, so they sit out the shared table above and
 * carry their own cases below.
 */
const kInputlessFields = [
  { id: "controls/select", tag: "jolly-select" },
  { id: "controls/button-group", tag: "jolly-button-group" }
];

const kLabelledExamples = [
  ...kFields,
  ...kInputlessFields,
  { id: "controls/chrome", tag: "jolly-property-row" }
];

function row(
  page: Page,
  tag: string,
  state: string
): Locator {
  return page.locator(`[data-state="${state}"] ${tag}`);
}

/**
 * The control a field puts in the tab order. Skips the native colour swatch,
 * which jolly-color disables rather than making read only.
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

/** Collects committed values, which a controlled element never shows itself. */
async function recordChanges(
  page: Page
): Promise<void> {
  await page.evaluate(() => {
    window.__changes = [];
    document.addEventListener("jolly-change", (event) => {
      if (event instanceof CustomEvent) {
        window.__changes?.push(event.detail.value);
      }
    });
  });
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

      await expect(page.locator(tag)).toHaveCount(9);
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
     * Mixed is modified whenever a default exists, since differing values
     * cannot all equal one default. The matrix drops the default on the
     * `mixed` row, so the two stay distinguishable.
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

      /*
       * The native property, not toBeDisabled(): Playwright counts
       * aria-disabled as disabled, which is the announcement section 8
       * wants. What must stay true is that the control is still in the tab
       * order, so its value can be read and copied.
       */
      expect(
        await input.evaluate((node: HTMLInputElement) => node.disabled)
      ).toBe(false);

      await input.focus();
      await expect(input).toBeFocused();
    });

    /**
     * The combination section 4 exists for: the lock paints the field while
     * focus tints the row, so a locked field that is also focused shows both,
     * and focus is never suppressed.
     *
     * The row is what carries focus here rather than the control, because a
     * third of the catalog has no fill of its own to tint.
     */
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

      /*
       * The lock is drawn on the field itself, not on the control inside it:
       * a ring drawn within a control has to know that control's shape, and
       * a third of the catalog has none to know.
       */
      const held = await locked.evaluate((node) => {
        const style = getComputedStyle(node);

        return {
          bar: style.boxShadow,
          tint: style.backgroundColor
        };
      });

      expect(rest).toBe("rgba(0, 0, 0, 0)");
      expect(focused).not.toBe(rest);
      expect(held.bar).toContain("inset");
      expect(held.tint).not.toBe("rgba(0, 0, 0, 0)");
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
     * The lock glyph replaces the revert button in the gutter rather than
     * adding a column beside it: `editable` is false whenever a field is
     * held, so the two can never both want the slot, and the row's width
     * stays constant across every state.
     */
    test(`${tag} swaps the gutter for a lock glyph, tooltipped, when held`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      const gutter = row(page, tag, "locked").locator(".gutter");

      await expect(gutter.locator("jolly-icon")).toHaveAttribute("name", "lock");
      await expect(gutter.locator(".revert")).toHaveCount(0);
      await expect(gutter).toHaveAttribute("data-tooltip", /Held by/);

      /*
       * A native title attribute plays no part in computed style at all, so this proves the reveal
       * is the CSS one. The 500ms poll budget, well under a browser's own hover delay, is there for
       * the reveal's own 100ms transition to settle, not to wait out anything slow.
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

test.describe("controls: select and button group", () => {
  for (const { id, tag } of kInputlessFields) {
    test(`${tag} renders every row and reflects state`, async({ page }) => {
      await gotoGallery(page, { example: id, chrome: "off" });

      await expect(page.locator(tag)).toHaveCount(9);
      await expect(row(page, tag, "mixed")).toHaveAttribute("mixed", "");
      await expect(row(page, tag, "modified")).toHaveAttribute("modified", "");
      await expect(row(page, tag, "locked")).toHaveAttribute("locked", "");
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

    expect(await page.evaluate(() => window.__changes)).toEqual(["linear"]);
  });

  test("a locked select puts the picked option back", async({ page }) => {
    await gotoGallery(page, { example: "controls/select", chrome: "off" });
    await recordChanges(page);

    /*
     * Driven in page rather than through selectOption. Playwright reads
     * aria-disabled as not operable, which is exactly what a locked field
     * declares, so it will not drive the control at all. What matters here
     * is that the change handler puts the option back.
     */
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

    expect(await page.evaluate(() => window.__changes)).toEqual([]);
    expect(after).toBe("0");
  });

  /**
   * A segmented control is one tab stop, unlike jolly-flags, whose entries
   * really are independent.
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

    expect(await page.evaluate(() => window.__changes)).toEqual(["paint"]);
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
   * A trusted click, unlike a scripted `.click()` on the element from within the page, races the
   * browser's own checkedness revert against Lit's re-render. `preventDefault()`-then-recompute
   * used to lose that race, leaving the box visually stuck unchecked.
   */
  test("checkbox stays checked after a real click", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });
    await recordChanges(page);

    const box = control(row(page, "jolly-checkbox", "default"));

    await box.click();
    await expect(box).toBeChecked();

    await box.click();
    await expect(box).not.toBeChecked();

    expect(await page.evaluate(() => window.__changes)).toEqual([true, false]);
  });

  /** Clicking an indeterminate checkbox resolves it to checked, per the tri-state convention. */
  test("checkbox click resolves mixed to checked", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });
    await recordChanges(page);

    const box = control(row(page, "jolly-checkbox", "mixed"));

    await box.click();
    await expect(box).toBeChecked();

    expect(await page.evaluate(() => window.__changes)).toEqual([true]);
  });

  test("checkbox has no background fill", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });

    const checkbox = row(page, "jolly-checkbox", "default")
      .locator(".checkbox");

    await expect(checkbox).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)"
    );

    await checkbox.hover();
    await expect(checkbox).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)"
    );
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

    expect(edges[0] - edges[3]).toBe(4);
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

    const lane = row(page, "jolly-slider", "default").locator(".lane");

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

  test("Editor sliders share a value edge with presence", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor-states",
      chrome: "off"
    });

    const sliders = page.locator("jolly-slider");
    const metalness = sliders.filter({ hasText: "Metalness" });
    const emission = sliders.filter({ hasText: "Emission" });
    const [metalnessRight, emissionRight] = await Promise.all([
      metalness.locator(".value").evaluate(
        (node) => node.getBoundingClientRect().right
      ),
      emission.locator(".value").evaluate(
        (node) => node.getBoundingClientRect().right
      )
    ]);

    expect(metalnessRight).toBe(emissionRight);
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

  /** Flags shares Checkbox's native input, and the same trusted-click race. */
  test("flags entry stays checked after a real click", async({ page }) => {
    await gotoGallery(page, { example: "controls/flags", chrome: "off" });
    await recordChanges(page);

    const box = row(page, "jolly-flags", "default").getByLabel("Player");

    await box.click();
    await expect(box).toBeChecked();

    await box.click();
    await expect(box).not.toBeChecked();

    // Default row starts at 0b0101 (Default | Terrain); Player is 0b0010.
    expect(await page.evaluate(() => window.__changes)).toEqual([0b0111, 0b0101]);
  });
});

/** The three elements that are not fields, so no matrix state applies. */
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

  test("a property row slots arbitrary content", async({ page }) => {
    await gotoGallery(page, { example: "controls/chrome", chrome: "off" });

    const propertyRow = page.locator("jolly-property-row");

    await expect(propertyRow.locator("jolly-button")).toHaveCount(2);
    await expect(propertyRow.locator(".label")).toHaveText("Export");
  });
});

/**
 * Assertions here read properties that consume a token, never the token
 * itself. A custom property computes to its unresolved token stream, so
 * `getPropertyValue("--jolly-surface")` returns the literal `light-dark(...)`
 * text and reads identically in both themes.
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
   * Focus is a fill step rather than an outline, so it has to beat the rest
   * stop it shares a channel with.
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
   * P1's done-when: overriding one token on the gallery root visibly changes
   * every control.
   */
  test("an overridden token reaches a painted style", async({ page }) => {
    await gotoGallery(page, { example: "controls/checkbox", chrome: "off" });

    const box = control(page.locator("jolly-checkbox").first());

    function accent(): Promise<string> {
      return box.evaluate((node) => getComputedStyle(node).accentColor);
    }

    const before = await accent();

    await page.evaluate(() => {
      const root = document.querySelector("gallery-root");
      if (root instanceof HTMLElement) {
        root.style.setProperty("--jolly-accent-fill", "rgb(255, 102, 0)");
      }
    });

    const after = await accent();

    expect(after).not.toBe(before);
    expect(after).toBe("rgb(255, 102, 0)");
  });
});
