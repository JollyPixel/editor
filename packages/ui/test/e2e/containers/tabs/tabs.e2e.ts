// Import Third-party Dependencies
import {
  measureBox,
  measureCenter,
  hold
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect,
  type Page
} from "../../fixtures.ts";
import { openExample } from "../../support/gallery.ts";
import { readStyle } from "../../support/styles.ts";

function openTabs(
  page: Page,
  options: Record<string, boolean> = {}
): Promise<void> {
  return openExample(page, "containers/tabs", { options });
}

test.describe("Tabs", () => {
  test("arrows activate automatically and skip disabled tabs", async({ page }) => {
    await openTabs(page);

    const tabs = page.locator("jolly-tabs [role=tab]");
    await tabs.first().focus();
    await tabs.first().press("ArrowRight");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await tabs.nth(1).press("ArrowRight");
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await tabs.nth(2).press("ArrowRight");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  });

  test("keeps a value assigned before its tabs are slotted", async({ page }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" && message.text().includes("scheduled an update")) {
        warnings.push(message.text());
      }
    });

    await openTabs(page, { preselected: true });

    const tabs = page.locator("jolly-tabs [role=tab]");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");
    expect(warnings).toEqual([]);
  });

  test("selects a tab appended in the same update", async({ page }) => {
    await openTabs(page, { addButton: true });

    const tabs = page.locator("jolly-tabs [role=tab]");
    const add = page.getByRole("button", { name: "Add tab" });
    await expect(tabs).toHaveCount(4);

    await add.click();
    await expect(tabs).toHaveCount(5);
    await expect(tabs.nth(4)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");

    await add.click();
    await expect(tabs).toHaveCount(6);
    await expect(tabs.nth(5)).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("Tabs (badge, action, list-end)", () => {
  test("the action shows on the selected and disabled tabs and never selects", async({ page }) => {
    await openTabs(page, { badges: true, action: true });

    const host = page.locator("jolly-tabs");
    const tabs = host.locator("[role=tab]");
    const actions = host.locator("[part~=action]");

    await expect(host.locator("[part~=badge]")).toHaveText(["12", "3", "7", "0"]);
    await expect(actions.nth(0)).toBeVisible();
    await expect(actions.nth(1)).toBeHidden();
    await expect(actions.nth(3)).toBeVisible();
    await expect(actions.nth(0)).toHaveAttribute("aria-label", "Inspect grass");

    await actions.nth(3).click();
    await expect(host).toHaveAttribute("data-action", "lava");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

    await tabs.nth(1).click();
    await expect(actions.nth(0)).toBeHidden();
    await actions.nth(1).click();
    await expect(host).toHaveAttribute("data-action", "stone");
  });

  for (const variant of ["default", "skew"]) {
    test(`the list-end slot follows the ${variant} list, outside of it`, async({ page }) => {
      await openTabs(page, {
        addButton: true,
        skew: variant === "skew"
      });

      const host = page.locator("jolly-tabs");
      const [listBox, addBox] = await Promise.all([
        measureBox(host.locator("[part=list]")),
        measureBox(host.getByRole("button", { name: "Add tab" }))
      ]);
      const gap = addBox.x - (listBox.x + listBox.width);

      expect(Math.abs(gap)).toBeLessThanOrEqual(8);
    });
  }
});

test.describe("Tabs (closable)", () => {
  test.beforeEach(async({ page }) => {
    await openTabs(page, { closable: true });
  });

  test("the close button and a middle click close without selecting", async({ page }) => {
    const tabs = page.locator("jolly-tabs [role=tab]");
    const close = page.locator("jolly-tabs [part~=close]");
    await page.locator("jolly-tabs").evaluate((element) => {
      element.addEventListener("jolly-tab-change", () => {
        element.dataset.changes = `${Number(element.dataset.changes ?? 0) + 1}`;
      });
    });

    await expect(tabs).toHaveCount(4);
    await expect(close).toHaveCount(4);
    await expect(close.first()).toHaveAttribute("aria-label", "Close grass");
    await expect(close.nth(3)).toBeDisabled();

    await close.nth(1).click();
    await expect(tabs).toHaveText(["grass", "water", "lava"]);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("jolly-tabs")).not.toHaveAttribute("data-changes");

    await tabs.first().click({ button: "middle" });
    await expect(tabs).toHaveText(["water", "lava"]);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  });

  test("the close button sits inside its tab and keeps it highlighted", async({ page }) => {
    const item = page.locator("jolly-tabs [part~=tab]").nth(1);
    const close = page.locator("jolly-tabs [part~=close]").nth(1);
    const [itemBox, closeBox] = await Promise.all([
      measureBox(item),
      measureBox(close)
    ]);

    expect(closeBox.x).toBeGreaterThanOrEqual(itemBox.x);
    expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(itemBox.x + itemBox.width);
    expect(closeBox.y).toBeGreaterThanOrEqual(itemBox.y);
    expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(itemBox.y + itemBox.height);

    const idle = await readStyle(item, "background-color");
    await close.hover();
    await expect.poll(() => readStyle(item, "background-color")).not.toBe(idle);
  });
});

test.describe("Tabs (markers)", () => {
  const markers = [
    {
      part: "modified",
      index: 2,
      description: "Unsaved changes"
    },
    {
      part: "busy",
      index: 0,
      description: "Loading"
    },
    {
      part: "failed",
      index: 1,
      description: "Failed to load"
    }
  ];

  for (const { part, index, description } of markers) {
    test(`a ${part} tab shows its marker in place of its close glyph until hovered`, async({ page }) => {
      await openTabs(page, {
        closable: true,
        modified: true,
        status: true
      });

      const tabs = page.locator("jolly-tabs [role=tab]");
      const item = page.locator("jolly-tabs [part~=tab]").nth(index);
      const marker = item.locator(`[part~=${part}]`);
      const glyph = item.locator("[part~=close] jolly-icon[name=close]");

      await expect(page.locator(`jolly-tabs [part~=${part}]`)).toHaveCount(1);
      await expect(tabs.nth(index)).toHaveAttribute("aria-description", description);
      await page.mouse.move(0, 0);
      await expect(marker).toBeVisible();
      await expect(glyph).toBeHidden();

      await item.hover();
      await expect(marker).toBeHidden();
      await expect(glyph).toBeVisible();
    });
  }

  test("a busy tab is announced as busy", async({ page }) => {
    await openTabs(page, { status: true });

    const tabs = page.locator("jolly-tabs [role=tab]");
    await expect(tabs.first()).toHaveAttribute("aria-busy", "true");
    await expect(tabs.nth(1)).not.toHaveAttribute("aria-busy");
  });
});

test.describe("Tabs (reorder)", () => {
  test("a dragged tab slides its neighbours aside and lands where dropped", async({ page }) => {
    await openTabs(page, { reorderable: true });

    const tabs = page.locator("jolly-tabs [role=tab]");
    const stone = tabs.nth(1);
    const before = await measureBox(stone);
    const water = await measureBox(tabs.nth(2));
    const from = await measureCenter(tabs.first());
    await hold(page, from, {
      x: water.x + (water.width * 0.75),
      y: from.y
    });

    await expect.poll(async() => (await measureBox(stone)).x).toBeLessThan(before.x);
    await expect(page.locator(".jolly-drag-overlay")).toHaveCount(0);

    await page.mouse.up();
    await expect(tabs).toHaveText(["stone", "water", "grass", "lava"]);
    await expect(page.locator("jolly-tabs .item[data-lifted]")).toHaveCount(0);
  });

  test("a tab dropped back in its slot is not selected", async({ page }) => {
    await openTabs(page, { reorderable: true });

    const tabs = page.locator("jolly-tabs [role=tab]");
    const from = await measureCenter(tabs.nth(1));
    await hold(page, from, {
      x: from.x + 10,
      y: from.y
    });
    await page.mouse.up();

    await expect(tabs).toHaveText(["grass", "stone", "water", "lava"]);
    await expect(page.locator("jolly-tabs .item[data-lifted]")).toHaveCount(0);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  });

  test("Escape slides every tab back home", async({ page }) => {
    await openTabs(page, { reorderable: true });

    const tabs = page.locator("jolly-tabs [role=tab]");
    const stone = tabs.nth(1);
    const before = await measureBox(stone);
    const water = await measureBox(tabs.nth(2));
    const from = await measureCenter(tabs.first());
    await hold(page, from, {
      x: water.x + (water.width * 0.75),
      y: from.y
    });
    await expect.poll(async() => (await measureBox(stone)).x).toBeLessThan(before.x);

    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(tabs).toHaveText(["grass", "stone", "water", "lava"]);
    await expect.poll(async() => (await measureBox(stone)).x).toBeCloseTo(before.x, 0);
  });
});
