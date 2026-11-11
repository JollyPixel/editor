// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { marked } from "marked";

// Import Internal Dependencies
import { leavesElementsOpen } from "#src/markdown/rawHtml.ts";

function opensAcrossBlocks(
  markdown: string
): boolean {
  return marked.lexer(markdown).some(leavesElementsOpen);
}

describe("leavesElementsOpen", () => {
  test("accepts blocks whose raw HTML closes every element it opens", () => {
    for (const markdown of [
      "<p align=\"center\">\n  <img src=\"banner.png\">\n</p>",
      "Line<br>break and <span>inline</span>.",
      "A <custom-icon /> and <hr/>.",
      "Code `<b>` stays text.",
      "```html\n<div>\n```",
      "Hidden <!-- <div> --> comment."
    ]) {
      assert.equal(opensAcrossBlocks(markdown), false, markdown);
    }
  });

  test("flags blocks that leave an element or comment open for a later block", () => {
    for (const markdown of [
      "<details>\n\nInside.\n\n</details>",
      "Open <b>bold",
      "Crossed <b><i>tags</b></i>.",
      "Open <!-- comment\n\nstill open -->"
    ]) {
      assert.equal(opensAcrossBlocks(markdown), true, markdown);
    }
  });
});
