// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { suspendOnHover } from "#src/runtime/suspendOnHover.ts";

// CONSTANTS
const kHoverEvent = "canvas-hover-change";

function hover(
  target: EventTarget,
  hovering: boolean
): void {
  target.dispatchEvent(new CustomEvent(kHoverEvent, {
    detail: { hovering }
  }));
}

describe("suspendOnHover", () => {
  test("stopping during hover restores input and is idempotent", () => {
    const target = new EventTarget();
    const keyboard = { enabled: true };
    const stop = suspendOnHover(keyboard, target, kHoverEvent);
    hover(target, true);
    hover(target, true);
    stop();
    stop();
    assert.equal(keyboard.enabled, true);
    hover(target, true);
    assert.equal(keyboard.enabled, true);
  });

  test("preserves an initially disabled target", () => {
    const target = new EventTarget();
    const keyboard = { enabled: false };
    const stop = suspendOnHover(keyboard, target, kHoverEvent);
    hover(target, false);
    assert.equal(keyboard.enabled, false);
    hover(target, true);
    hover(target, false);
    assert.equal(keyboard.enabled, false);
    hover(target, true);
    stop();
    assert.equal(keyboard.enabled, false);
  });

  test("keeps input suspended until every hovering binding releases it", () => {
    const first = new EventTarget();
    const second = new EventTarget();
    const keyboard = { enabled: true };
    const stopFirst = suspendOnHover(keyboard, first, kHoverEvent);
    const stopSecond = suspendOnHover(keyboard, second, kHoverEvent);
    hover(first, true);
    hover(second, true);
    hover(first, false);
    assert.equal(keyboard.enabled, false);
    stopFirst();
    assert.equal(keyboard.enabled, false);
    stopSecond();
    assert.equal(keyboard.enabled, true);

    const stop = suspendOnHover(keyboard, first, kHoverEvent);
    hover(first, true);
    assert.equal(keyboard.enabled, false);
    stop();
    assert.equal(keyboard.enabled, true);
  });

  test("disables the target while hovering, until stopped", () => {
    const target = new EventTarget();
    const keyboard = { enabled: true };
    const stop = suspendOnHover(keyboard, target, kHoverEvent);

    hover(target, true);
    assert.equal(keyboard.enabled, false);
    hover(target, false);
    assert.equal(keyboard.enabled, true);

    stop();
    hover(target, true);
    assert.equal(keyboard.enabled, true);
  });

  test("ignores events without a hovering detail", () => {
    const target = new EventTarget();
    const keyboard = { enabled: true };
    suspendOnHover(keyboard, target, kHoverEvent);

    target.dispatchEvent(new Event(kHoverEvent));
    target.dispatchEvent(new CustomEvent(kHoverEvent, { detail: "over" }));
    target.dispatchEvent(new CustomEvent(kHoverEvent, {
      detail: { hovering: "true" }
    }));

    assert.equal(keyboard.enabled, true);
  });
});
