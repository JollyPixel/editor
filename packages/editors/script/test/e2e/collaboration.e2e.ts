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
