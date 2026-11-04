// Import Internal Dependencies
import {
  SCRIPT_SOURCE,
  expect,
  scriptText,
  test,
  typeAtEnd
} from "./fixtures.ts";

test("two peers typing at the same time end with the same script", async({ page, peer }) => {
  await Promise.all([
    typeAtEnd(page, "// first\n"),
    typeAtEnd(peer, "// second\n")
  ]);

  await expect.poll(() => scriptText(page)).toContain("// first");
  await expect.poll(() => scriptText(page)).toContain("// second");
  const text = await scriptText(page);
  await expect.poll(() => scriptText(peer)).toBe(text);
  expect(text.startsWith(SCRIPT_SOURCE)).toBe(true);
  await expect(peer.locator("jolly-script-code .line").filter({ hasText: "// first" })).toBeVisible();
});

test("a peer follows the caret and the selection without any typing", async({ page, peer }) => {
  const lineEnd = SCRIPT_SOURCE.indexOf("\n");
  const source = page.getByRole("textbox", { name: "Script source" });
  await source.focus();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("End");

  const code = peer.locator("jolly-script-code");
  await expect(code.locator(".caret")).toHaveAttribute("style", new RegExp(`left: ?${lineEnd}ch`));
  await expect(code.locator(".selection")).toHaveCount(0);

  await page.keyboard.press("Shift+Home");
  await expect(code.locator(".selection")).toHaveAttribute("style", new RegExp(`width: ?${lineEnd}ch`));
});

test("a peer follows the caret that Tab and undo move", async({ page, peer }) => {
  await page.getByRole("textbox", { name: "Script source" }).focus();
  await page.keyboard.press("Control+Home");
  const caret = peer.locator("jolly-script-code .caret");
  await expect(caret).toHaveAttribute("style", /left: ?0ch/);

  await page.keyboard.press("Tab");
  await expect(caret).toHaveAttribute("style", /left: ?2ch/);

  await page.keyboard.press("Control+z");
  await expect(caret).toHaveAttribute("style", /left: ?0ch/);
});
