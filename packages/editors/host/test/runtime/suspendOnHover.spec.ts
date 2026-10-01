// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  suspendOnHover,
  type Suspendable
} from "#src/runtime/suspendOnHover.ts";

// CONSTANTS
const kHoverEvent = "canvas-hover-change";

class FakeKeyboard implements Suspendable {
  holders = 0;

  suspend(): () => void {
    this.holders++;

    return () => {
      this.holders--;
    };
  }
}

function hover(
  target: EventTarget,
  hovering: boolean
): void {
  target.dispatchEvent(new CustomEvent(kHoverEvent, {
    detail: { hovering }
  }));
}

describe("suspendOnHover", () => {
  test("suspends the keyboard once while hovering", () => {
    const target = new EventTarget();
    const keyboard = new FakeKeyboard();
    suspendOnHover(keyboard, target, kHoverEvent);

    hover(target, true);
    hover(target, true);
    assert.equal(keyboard.holders, 1);

    hover(target, false);
    hover(target, false);
    assert.equal(keyboard.holders, 0);
  });

  test("stopping during hover releases the keyboard and is idempotent", () => {
    const target = new EventTarget();
    const keyboard = new FakeKeyboard();
    const stop = suspendOnHover(keyboard, target, kHoverEvent);

    hover(target, true);
    stop();
    stop();
    assert.equal(keyboard.holders, 0);

    hover(target, true);
    assert.equal(keyboard.holders, 0);
  });

  test("ignores events without a hovering detail", () => {
    const target = new EventTarget();
    const keyboard = new FakeKeyboard();
    suspendOnHover(keyboard, target, kHoverEvent);

    target.dispatchEvent(new Event(kHoverEvent));
    target.dispatchEvent(new CustomEvent(kHoverEvent, { detail: "over" }));
    target.dispatchEvent(new CustomEvent(kHoverEvent, {
      detail: { hovering: "true" }
    }));

    assert.equal(keyboard.holders, 0);
  });
});
