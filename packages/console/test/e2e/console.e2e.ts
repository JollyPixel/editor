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

  test("search results follow a registry change while open", async({ page }) => {
    await page.keyboard.press("Control+k");
    await prompt(page).fill("brush.si");
    await expect(page.getByRole("option").first()).toContainText("brush.size");

    await page.evaluate(() => {
      document.querySelector("jolly-console")?.console?.registerNamespace("brush");
    });

    await expect(page.getByRole("option")).toHaveCount(0);
  });
});
