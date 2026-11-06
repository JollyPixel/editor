// Import Internal Dependencies
import {
  SCRIPT_SOURCE,
  expect,
  placeCaretAtEnd,
  scriptText,
  test
} from "./fixtures.ts";

test("two peers typing at the same time end with the same script", async({ page, peer }) => {
  const first = "// first\n";
  const second = "// second\n";
  await Promise.all([
    placeCaretAtEnd(page),
    placeCaretAtEnd(peer)
  ]);
  await Promise.all([
    page.keyboard.type(first),
    peer.keyboard.type(second)
  ]);

  await expect.poll(() => scriptText(page))
    .toHaveLength(SCRIPT_SOURCE.length + first.length + second.length);
  const text = await scriptText(page);
  await expect.poll(() => scriptText(peer)).toBe(text);
  expect(text.startsWith(SCRIPT_SOURCE)).toBe(true);
  expect(text).toContain(first);
  expect(text).toContain(second);
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
