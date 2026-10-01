// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";

function consoleDialog(
  page: Page
) {
  return page.locator("jolly-console dialog");
}

function prompt(
  page: Page
) {
  return page.getByRole("combobox", { name: "Command" });
}

test.describe("jolly-console", () => {
  test.beforeEach(async({ page }) => {
    await page.goto("/");
    await expect(page.locator("#brush-size")).toHaveText("1");
  });

  test("Ctrl+K toggles the console and Escape closes it", async({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(consoleDialog(page)).toHaveAttribute("open");
    await expect(prompt(page)).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(consoleDialog(page)).not.toHaveAttribute("open");

    await page.keyboard.press("Control+k");
    await expect(consoleDialog(page)).toHaveAttribute("open");
    await page.keyboard.press("Control+k");
    await expect(consoleDialog(page)).not.toHaveAttribute("open");
  });

  test("reopening starts from an empty prompt", async({ page }) => {
    await page.keyboard.press("Control+k");
    await prompt(page).fill("brush.si");
    await expect(page.getByRole("option").first()).toContainText("brush.size");
    await page.keyboard.press("Escape");
    await expect(consoleDialog(page)).not.toHaveAttribute("open");

    await page.keyboard.press("Control+k");

    await expect(prompt(page)).toHaveValue("");
    await expect(page.getByRole("group", { name: "Namespaces" })).toContainText("brush");
    await expect(page.locator("[role=option][aria-selected=true]")).toHaveCount(0);
  });

  test("the empty prompt lists entries and flips a toggle", async({ page }) => {
    await page.keyboard.press("Control+k");
    const toggles = page.getByRole("group", { name: "Toggles" });
    const ghost = toggles.getByRole("option", { name: "brush.ghost" });
    await expect(ghost).toHaveAttribute("aria-checked", "true");

    await ghost.click();

    await expect(page.locator("#brush-ghost")).toHaveText("false");
    await expect(ghost).toHaveAttribute("aria-checked", "false");
    await expect(prompt(page)).toBeFocused();
    await expect(page.getByRole("group", { name: "Recent" }))
      .toContainText("brush.ghost false");
  });

  test("the highlighted suggestion shows its usage", async({ page }) => {
    const usage = page.locator("jolly-console .usage");
    await page.keyboard.press("Control+k");
    await prompt(page).fill("/brush.gr");
    await expect(usage).toBeHidden();

    await page.keyboard.press("ArrowDown");

    await expect(usage).toContainText("/brush.grow <delta:number>");
    await expect(prompt(page)).toHaveAttribute("aria-describedby", "usage");
  });

  test("long output folds until expanded", async({ page }) => {
    await page.evaluate(() => {
      document.querySelector("jolly-console")?.console?.registerCommand("lines", {
        description: "Print twenty lines",
        args: [],
        execute: (_, ctx) => ctx.print(
          Array.from({ length: 20 }, (_line, index) => `line ${index + 1}`).join("\n")
        )
      });
    });
    await page.keyboard.press("Control+k");
    await prompt(page).fill("/lines");
    await page.keyboard.press("Enter");

    const entry = page.getByRole("log").locator(".entry").last();
    await expect(entry).toContainText("line 6");
    await expect(entry).not.toContainText("line 7");

    await entry.getByRole("button", { name: "Show 14 more lines" }).click();

    await expect(entry).toContainText("line 20");
    await expect(prompt(page)).toBeFocused();
  });

  test("closing returns focus to the element that held it", async({ page }) => {
    const notes = page.getByRole("textbox", { name: "Notes" });
    await notes.click();

    await page.keyboard.press("Control+k");
    await expect(prompt(page)).toBeFocused();
    await page.keyboard.press("Escape");

    await expect(notes).toBeFocused();
  });

  test("Ctrl+K dismisses an open dialog before opening", async({ page }) => {
    const dialog = page.locator("#dialog dialog");
    await page.getByRole("button", { name: "Open dialog", exact: true }).click();
    await expect(dialog).toHaveAttribute("open");

    await page.keyboard.press("Control+k");

    await expect(dialog).not.toHaveAttribute("open");
    await expect(consoleDialog(page)).toHaveAttribute("open");
    await expect(prompt(page)).toBeFocused();
  });

  test("a non-dismissible dialog blocks Ctrl+K", async({ page }) => {
    const locked = page.locator("#locked-dialog dialog");
    await page.getByRole("button", { name: "Open locked dialog" }).click();
    await expect(locked).toHaveAttribute("open");

    await page.keyboard.press("Control+k");

    await expect(locked).toHaveAttribute("open");
    await expect(consoleDialog(page)).not.toHaveAttribute("open");
  });

  test("search, Enter, Enter reads a variable", async({ page }) => {
    await page.keyboard.press("Control+k");
    await prompt(page).fill("brush.si");
    await expect(page.getByRole("option").first()).toContainText("brush.size");

    await page.keyboard.press("Enter");
    await expect(prompt(page)).toHaveValue("brush.size");

    await page.keyboard.press("Enter");
    const log = page.getByRole("log");
    await expect(log).toContainText("brush.size");
    await expect(log.locator(".entry").last()).toHaveText("1");
    await expect(prompt(page)).toHaveValue("");
  });

  test("the gray suffix completes with Tab or Right at the end of the line", async({ page }) => {
    const suffix = page.locator("jolly-console .ghost .suffix");
    await page.keyboard.press("Control+k");
    await prompt(page).fill("brush.si");
    await expect(suffix).toHaveText("ze");

    await page.keyboard.press("Tab");
    await expect(prompt(page)).toHaveValue("brush.size");
    await expect(suffix).toBeHidden();

    await prompt(page).fill("/brush.gr");
    await expect(suffix).toHaveText("ow");
    await page.keyboard.press("ArrowLeft");
    await expect(suffix).toBeHidden();
    await page.keyboard.press("End");
    await expect(suffix).toHaveText("ow");

    await page.keyboard.press("ArrowRight");
    await expect(prompt(page)).toHaveValue("/brush.grow");
  });

  test("search results follow a registry change while open", async({ page }) => {
    await page.keyboard.press("Control+k");
    await prompt(page).fill("brush.si");
    await expect(page.getByRole("option").first()).toContainText("brush.size");

    await page.evaluate(() => {
      document.querySelector("jolly-console")?.console?.registerNamespace("brush");
    });

    await expect(page.getByRole("option")).toHaveCount(0);
  });

  test("the open console follows the page theme through auto", async({ page }) => {
    const element = page.locator("jolly-console");
    await page.keyboard.press("Control+k");
    await expect(element).toHaveAttribute("theme", "dark");

    await prompt(page).fill("theme auto");
    await page.keyboard.press("Enter");
    await expect(page.locator("#theme")).toHaveText("auto");
    await expect(element).not.toHaveAttribute("theme");

    await prompt(page).fill("theme light");
    await page.keyboard.press("Enter");
    await expect(element).toHaveAttribute("theme", "light");
  });
});
