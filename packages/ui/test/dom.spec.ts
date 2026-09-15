// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { isButtonElement, originatesInButton } from "../src/dom.ts";

describe("Dom.isButtonElement", () => {
  test("is true for a button element", () => {
    assert.equal(isButtonElement(document.createElement("button")), true);
  });

  test("is false for a non-button element", () => {
    assert.equal(isButtonElement(document.createElement("div")), false);
  });

  test("is false for null", () => {
    assert.equal(isButtonElement(null), false);
  });
});

describe("Dom.originatesInButton", () => {
  test("is true for the button itself", () => {
    const button = document.createElement("button");

    assert.equal(originatesInButton(button), true);
  });

  test("is true for an icon nested inside a button", () => {
    const button = document.createElement("button");
    const icon = document.createElement("span");
    button.append(icon);

    assert.equal(originatesInButton(icon), true);
  });

  test("is false when nothing in the ancestor chain is a button", () => {
    const container = document.createElement("div");
    const child = document.createElement("span");
    container.append(child);

    assert.equal(originatesInButton(child), false);
  });

  test("is false for null", () => {
    assert.equal(originatesInButton(null), false);
  });
});
