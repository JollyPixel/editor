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

test("an edit above a reading peer keeps that peer's scroll position and caret", async({ page, peer }) => {
  const lines = Array.from({ length: 200 }, (_, index) => `const value${index} = ${index};`);
  const typed = "// peer\n";
  await placeCaretAtEnd(page);
  await page.keyboard.insertText(`${lines.join("\n")}\n`);
  await expect.poll(() => scriptText(peer)).toContain("value199");

  const scroller = page.locator("jolly-script-code .scroller");
  const source = page.getByRole("textbox", { name: "Script source" });
  const scrollTop = await scroller.evaluate((element) => element.scrollTop);
  const caret = await source.evaluate((element: HTMLTextAreaElement) => element.selectionStart);
  expect(scrollTop).toBeGreaterThan(0);

  await peer.getByRole("textbox", { name: "Script source" }).focus();
  await peer.keyboard.press("Control+Home");
  await peer.keyboard.type(typed);

  await expect.poll(() => scriptText(page)).toContain(typed);
  expect(await scroller.evaluate((element) => element.scrollTop)).toBe(scrollTop);
  const caretAfter = await source.evaluate((element: HTMLTextAreaElement) => element.selectionStart);
  expect(caretAfter).toBe(caret + typed.length);
});
