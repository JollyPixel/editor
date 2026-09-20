// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { openExample } from "../../support/gallery.ts";

test.describe("Dialog", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "containers/dialog", { theme: "dark" });
  });

  test("native Escape dismisses a declarative themed dialog", async({ page }) => {
    const host = page.locator("#delete-dialog");
    const dialog = host.locator("dialog");

    await page.getByRole("button", { name: "Open dialog" }).click();
    await expect(dialog).toHaveAttribute("open");
    await expect(host).toHaveAttribute("theme", "dark");
    await expect(host.locator(":scope > jolly-button")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(dialog).not.toHaveAttribute("open");
  });

  test("Enter runs the default action from a field", async({ page }) => {
    const dialog = page.locator("#rename-dialog");
    const input = dialog.locator("input");

    await page.locator("[data-action=default-action]").click();
    await expect(input).toBeFocused();
    await input.fill("Ground");
    await input.press("Enter");

    await expect(page.locator("main > div"))
      .toHaveAttribute("data-result", "renamed:Ground");
    await expect(dialog.locator("dialog")).not.toHaveAttribute("open");
  });

  test("an editable heading commits on Enter and on blur", async({ page }) => {
    const result = page.locator("main > div");
    const dialog = page.locator("#title-dialog");
    const title = dialog.getByRole("textbox", { name: "Title" });

    await page.locator("[data-action=editable-heading]").click();
    await expect(title).not.toBeFocused();
    await expect(title).toHaveValue("Lantern");

    await title.fill("  Torch  ");
    await title.press("Enter");
    await expect(result).toHaveAttribute("data-result", "heading:Torch");
    await expect(dialog.locator("dialog")).toHaveAttribute("open");

    await title.fill("Sconce");
    await title.blur();
    await expect(result).toHaveAttribute("data-result", "heading:Sconce");
  });

  test("Escape reverts an editable heading and keeps the dialog open", async({ page }) => {
    const result = page.locator("main > div");
    const dialog = page.locator("#title-dialog");
    const title = dialog.getByRole("textbox", { name: "Title" });

    await page.locator("[data-action=editable-heading]").click();
    await title.fill("Draft");
    await title.press("Escape");

    await expect(title).toHaveValue("Lantern");
    await expect(dialog.locator("dialog")).toHaveAttribute("open");
    await expect(result).not.toHaveAttribute("data-result", /heading:/);

    await title.fill("   ");
    await title.press("Enter");
    await expect(result).not.toHaveAttribute("data-result", /heading:/);
  });

  test("prompt and confirm helpers settle, trim and remove themselves", async({ page }) => {
    const result = page.locator("main > div");
    const helper = page.locator("body > jolly-dialog");

    await page.locator("[data-action=prompt-helper]").click();
    await expect(helper).toHaveAttribute("theme", "dark");
    await expect(helper.locator("jolly-text")).toHaveCount(1);
    await expect(helper.locator("jolly-button")).toHaveCount(2);
    await helper.locator("input").fill("  Layer  ");
    await helper.locator("input").press("Enter");
    await expect(result).toHaveAttribute("data-result", "Layer");
    await expect(helper).toHaveCount(0);

    const opener = page.locator("[data-action=confirm-helper] button");
    for (const [key, expected] of [["Escape", "false"], ["Enter", "true"]]) {
      await opener.click();
      await expect(helper.locator("dialog")).toHaveAttribute("open");
      await page.keyboard.press(key);
      await expect(result).toHaveAttribute("data-result", expected);
      await expect(helper).toHaveCount(0);
      await expect(opener).toBeFocused();
    }
  });

  test("the choice helper resolves the picked action, or null on cancel", async({ page }) => {
    const result = page.locator("main > div");
    const dialog = page.locator("body > jolly-dialog");
    const open = page.locator("[data-action=choice-helper]");

    await open.click();
    await expect(dialog.locator("jolly-button"))
      .toHaveText(["Cancel", "Replace", "Add"]);
    await dialog.locator("jolly-button", { hasText: "Replace" }).click();
    await expect(result).toHaveAttribute("data-result", "replace");
    await expect(dialog).toHaveCount(0);

    await open.click();
    await page.keyboard.press("Enter");
    await expect(result).toHaveAttribute("data-result", "add");
    await expect(dialog).toHaveCount(0);

    await open.click();
    await dialog.locator("jolly-button", { hasText: "Cancel" }).click();
    await expect(result).toHaveAttribute("data-result", "null");
    await expect(dialog).toHaveCount(0);
  });

  test("a helper dialog stays mounted until its exit transition ends", async({ page }) => {
    const confirm = page.locator("body > jolly-dialog");

    await page.locator("[data-action=confirm-helper]").click();
    await expect(confirm.locator("dialog")).toHaveAttribute("open");
    await confirm.evaluate(
      (host: HTMLElement) => host.style.setProperty("--jolly-duration-exit", "60s")
    );

    await page.keyboard.press("Escape");
    await expect(page.locator("main > div")).toHaveAttribute("data-result", "false");
    await expect(confirm.locator("dialog")).not.toHaveAttribute("open");
    await expect(confirm).toHaveCount(1);

    await confirm.locator("dialog").evaluate((dialog) => {
      for (const animation of dialog.getAnimations({ subtree: true })) {
        animation.finish();
      }
    });
    await expect(confirm).toHaveCount(0);
  });
});

test("reduced motion opens a dialog without transitions", async({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openExample(page, "containers/dialog");

  await page.getByRole("button", { name: "Open dialog" }).click();
  const dialog = page.locator("#delete-dialog dialog");
  await expect(dialog).toHaveAttribute("open");
  expect(await dialog.evaluate(
    (element) => element.getAnimations({ subtree: true }).length
  )).toBe(0);
  await expect(dialog).toHaveCSS("opacity", "1");
});

test.describe("Input layers", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "scenarios/dialog-escape");
  });

  test("an open dialog claims keys from document listeners", async({ page }) => {
    const example = page.locator("main > .chrome-row");
    const dialog = example.locator("jolly-dialog dialog");

    await page.getByRole("button", { name: "Open dismissible dialog" }).click();
    await expect(dialog).toHaveAttribute("open");
    for (const key of ["KeyW", "Enter", "Tab", "Escape"]) {
      await page.keyboard.press(key);
    }
    await expect(dialog).not.toHaveAttribute("open");
    await expect(example).toHaveAttribute("data-viewport-keys", "");

    await page.keyboard.press("Escape");
    await expect(example).toHaveAttribute("data-viewport-keys", "Escape");
  });

  test("an open popover claims the Escape that closes it", async({ page }) => {
    const example = page.locator("main > .chrome-row");
    const field = example.locator("jolly-color");
    const popover = field.locator(".popover");

    await field.locator("button.swatch").click();
    await expect(popover).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(example).toHaveAttribute("data-viewport-keys", "");

    await page.keyboard.press("Escape");
    await expect(example).toHaveAttribute("data-viewport-keys", "Escape");
  });
});

test.describe("Dialog header", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "containers/dialog", { theme: "dark" });
  });

  test("a danger intent draws its icon and raises an alert dialog", async({ page }) => {
    await page.locator("[data-action=intent-danger]").click();

    const dialog = page.getByRole("alertdialog", {
      name: "A dialog with the danger intent"
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("header jolly-icon"))
      .toHaveAttribute("name", "warning");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("a toned dialog becomes an area and paints its header", async({ page }) => {
    const host = page.locator("#toned-dialog");

    await page.locator("[data-action=toned-dialog]").click();
    await expect(host.locator("dialog")).toHaveAttribute("open");
    await expect(host).toHaveAttribute("toned");

    const colours = await host.evaluate((element) => {
      const probe = document.createElement("div");
      probe.style.background = "var(--jolly-tone-teal-fill)";
      element.shadowRoot!.querySelector("dialog")!.append(probe);
      const header = element.shadowRoot!.querySelector("header")!;
      const result = {
        header: getComputedStyle(header).backgroundColor,
        fill: getComputedStyle(probe).backgroundColor
      };
      probe.remove();

      return result;
    });
    expect(colours.header).toBe(colours.fill);
  });
});
