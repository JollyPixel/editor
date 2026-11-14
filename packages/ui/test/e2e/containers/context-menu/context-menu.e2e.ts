// Import Internal Dependencies
import {
  test,
  expect,
  type Page
} from "../../fixtures.ts";

function row(
  page: Page,
  name: string
) {
  return page.locator("button.row", { hasText: name });
}

test.describe("Context menu", () => {
  test.use({
    example: "containers/context-menu"
  });

  test("opens at the pointer, runs the chosen item and returns focus", async({ page }) => {
    const arm = row(page, "Arm");
    const box = (await arm.boundingBox())!;
    const pointer = {
      x: box.x + 10,
      y: box.y + 5
    };
    await page.mouse.click(pointer.x, pointer.y, { button: "right" });

    const menu = page.getByRole("menu", { name: "Row actions" });
    await expect(menu).toBeVisible();
    await expect.poll(async() => (await menu.boundingBox())?.x).toBeCloseTo(pointer.x, 0);
    await expect.poll(async() => (await menu.boundingBox())?.y).toBeCloseTo(pointer.y, 0);
    await expect(page.getByRole("menuitem", { name: "Rename" })).toBeFocused();

    await page.getByRole("menuitem", { name: "Duplicate" }).click();

    await expect(menu).toBeHidden();
    await expect(page.locator("main > div")).toHaveAttribute("data-result", "duplicate:Arm");
    await expect(arm).toBeFocused();
  });

  test("the keyboard skips disabled items and Escape closes without a choice", async({ page }) => {
    const locked = row(page, "Locked leg");
    await locked.click({ button: "right" });

    const duplicate = page.getByRole("menuitem", { name: "Duplicate" });
    await expect(duplicate).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(duplicate).toBeFocused();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("menu")).toBeHidden();
    await expect(page.locator("main > div")).not.toHaveAttribute("data-result");
    await expect(locked).toBeFocused();

    await locked.click({ button: "right" });
    await page.keyboard.press("Enter");
    await expect(page.locator("main > div")).toHaveAttribute("data-result", "duplicate:Locked leg");
  });

  test("opened while a button is held, it waits for the release", async({ page }) => {
    const opened = await page.locator("#row-menu").evaluate((
      menu: HTMLElementTagNameMap["jolly-context-menu"]
    ) => {
      menu.items = [{ id: "one", label: "One" }];
      window.dispatchEvent(new PointerEvent("pointerdown"));
      menu.openAt(40, 40);
      const whilePressed = menu.shadowRoot!
        .querySelector(".menu")!
        .matches(":popover-open");
      window.dispatchEvent(new PointerEvent("pointerup"));

      return whilePressed;
    });

    expect(opened).toBe(false);
    await expect(page.getByRole("menuitem", { name: "One" })).toBeFocused();
  });

  test("arrows wrap and Enter chooses", async({ page }) => {
    await row(page, "Torso").click({ button: "right" });

    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.locator("main > div")).toHaveAttribute("data-result", "delete:Torso");
  });

  test("Shift+F10 on a focused row opens it from the keyboard", async({ page }) => {
    await row(page, "Torso").focus();
    await page.keyboard.press("Shift+F10");

    await expect(page.getByRole("menuitem", { name: "Rename" })).toBeFocused();
  });

  test("a click outside closes it without a choice", async({ page }) => {
    await row(page, "Torso").click({ button: "right" });
    await expect(page.getByRole("menu")).toBeVisible();

    await page.mouse.click(5, 5);

    await expect(page.getByRole("menu")).toBeHidden();
    await expect(page.locator("main > div")).not.toHaveAttribute("data-result");
  });

  test("is placed at the point in the task that opens it", async({ page }) => {
    const placed = await page.locator("#row-menu").evaluate((
      menu: HTMLElementTagNameMap["jolly-context-menu"]
    ) => {
      menu.items = [{ id: "one", label: "One" }];
      menu.openAt(40, 60);
      const rect = menu.shadowRoot!
        .querySelector(".menu")!
        .getBoundingClientRect();

      return {
        x: rect.x,
        y: rect.y
      };
    });

    expect(placed).toEqual({
      x: 40,
      y: 60
    });
  });

  test("stays inside the viewport near its corner", async({ page }) => {
    const viewport = page.viewportSize()!;
    await page.locator("#row-menu").evaluate((
      menu: HTMLElementTagNameMap["jolly-context-menu"],
      size
    ) => {
      menu.items = [{ id: "one", label: "One" }, { id: "two", label: "Two" }];
      menu.openAt(size.width - 2, size.height - 2);
    }, viewport);

    const menu = page.getByRole("menu");
    await expect.poll(async() => {
      const placed = await menu.boundingBox();

      return placed !== null &&
        placed.x + placed.width <= viewport.width &&
        placed.y + placed.height <= viewport.height &&
        placed.width > 100;
    }).toBe(true);
  });

  test("a trigger opens it below, aligned to the trigger's end", async({ page }) => {
    const trigger = page.locator("button.options");
    await trigger.click();

    const menu = page.getByRole("menu", { name: "Options" });
    const box = (await trigger.boundingBox())!;
    await expect(page.getByRole("menuitem", { name: "Export everything" })).toBeFocused();
    await expect.poll(async() => {
      const placed = await menu.boundingBox();

      return placed === null ? null : placed.x + placed.width;
    }).toBeCloseTo(box.x + box.width, 0);
    await expect.poll(async() => (await menu.boundingBox())?.y).toBeCloseTo(box.y + box.height, 0);
  });

  test("hover opens it without focus, and leaving it after hovering an item closes it", async({ page }) => {
    const trigger = page.locator("button.options");
    await trigger.hover();

    const menu = page.getByRole("menu", { name: "Options" });
    await expect(menu).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Export everything" })).not.toBeFocused();

    const settings = page.getByRole("menuitem", { name: "Settings" });
    await settings.hover();
    await expect(settings).toBeFocused();
    await page.mouse.move(5, 5);

    await expect(menu).toBeHidden();
    await expect(page.locator("main > div")).not.toHaveAttribute("data-result");
  });

  test("a click on the trigger keeps a hover-opened menu open", async({ page }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    const trigger = page.locator("button.options");
    await trigger.hover();
    await page.clock.runFor(200);

    const menu = page.getByRole("menu", { name: "Options" });
    await expect(menu).toBeVisible();
    await trigger.click();
    await page.mouse.move(5, 5);
    await page.clock.runFor(1000);

    await expect(menu).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Export everything" })).toBeFocused();
  });
});
