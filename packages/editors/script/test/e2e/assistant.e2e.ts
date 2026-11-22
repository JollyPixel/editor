// Import Internal Dependencies
import {
  expect,
  placeCaretAtEnd,
  scriptText,
  test
} from "./fixtures.ts";

// CONSTANTS
const kScript = [
  "import { Behavior } from \"@jolly-pixel/ecs\";",
  "",
  "export class Player extends Behavior {",
  "  speed: number = \"fast\";",
  "}",
  "",
  "debugger;",
  "new Player().actor.add"
].join("\n");

test("a script shows type and lint problems and completes engine members", async({ page }) => {
  const code = page.locator("jolly-script-code");
  await placeCaretAtEnd(page);
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(kScript);

  await expect(code.locator(".number.error", { hasText: /^4$/ })).toBeVisible();
  await expect(code.locator(".number.warning", { hasText: /^7$/ })).toBeVisible();

  await page.keyboard.type("Co");
  await expect(code.getByRole("option").first()).toHaveText(/addComponent/);
  await page.keyboard.press("Enter");

  await expect.poll(() => scriptText(page)).toMatch(/\.actor\.addComponent$/);
  await expect(code.getByRole("listbox")).toHaveCount(0);
});
