// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";

function prompt(
  page: Page
) {
  return page.getByRole("combobox", { name: "Command" });
}

function editor(
  page: Page
) {
  return page.getByRole("textbox", { name: "Variables script" });
}

function scriptStatus(
  page: Page
) {
  return page.locator("jolly-console-script").getByRole("status");
}

async function openScript(
  page: Page,
  line: string
): Promise<string> {
  await page.keyboard.press("Control+k");
  await prompt(page).fill(line);
  await page.keyboard.press("Enter");
  await expect(editor(page)).toBeFocused();

  return editor(page).inputValue();
}

test.describe("jolly-console script", () => {
  test.beforeEach(async({ page }) => {
    await page.goto("/");
    await expect(page.locator("#brush-size")).toHaveText("1");
  });

  test("Ctrl+S applies every edited variable and returns to the prompt", async({ page }) => {
    const text = await openScript(page, "/script brush");
    expect(text).toContain("size = 1");

    await editor(page).fill(
      text.replace("size = 1", "size = 4").replace("ghost = true", "ghost = off")
    );
    await expect(scriptStatus(page)).toHaveText("2 changes");

    const [textarea, overlay] = await page.locator("jolly-console-script").evaluate((host) => {
      function rect(
        selector: string
      ) {
        const { x, y, width, height } = host.shadowRoot?.querySelector(selector)
          ?.getBoundingClientRect() ?? new DOMRect();

        return { x, y, width, height };
      }

      return [rect("textarea"), rect("pre")];
    });
    expect(overlay).toEqual(textarea);

    await page.keyboard.press("Control+s");

    await expect(prompt(page)).toBeFocused();
    await expect(page.locator("#brush-size")).toHaveText("4");
    await expect(page.locator("#brush-ghost")).toHaveText("false");
    await expect(page.locator("jolly-console-log")).toContainText("brush.size 4");
  });

  test("an invalid value blocks saving and Escape cancels back to the prompt", async({ page }) => {
    const text = await openScript(page, "/script");

    await editor(page).fill(text.replace("size = 1", "size = big"));
    await expect(scriptStatus(page)).toContainText("Expected a number, got \"big\"");
    await page.keyboard.press("Control+s");

    await expect(editor(page)).toBeFocused();
    await expect(page.locator("#brush-size")).toHaveText("1");

    await page.keyboard.press("Escape");

    await expect(prompt(page)).toBeFocused();
    await expect(page.locator("jolly-console dialog")).toHaveAttribute("open");
    await expect(page.locator("#brush-size")).toHaveText("1");
  });
});
