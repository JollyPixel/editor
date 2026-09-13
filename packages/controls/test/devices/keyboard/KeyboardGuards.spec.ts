// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  Keyboard,
  KeyboardGuard
} from "../../../src/index.ts";
import {
  createConnectedKeyboardFixture,
  type KeyboardDocumentAdapter
} from "./Keyboard.fixture.ts";

class FakeGuard implements KeyboardGuard {
  blocking = false;
  listeners = new Set<() => void>();

  blocks(): boolean {
    return this.blocking;
  }

  onEngage(
    listener: () => void
  ): () => void {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  }

  engage(): void {
    this.blocking = true;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

describe("Controls.Keyboard guards", () => {
  let keyboard: Keyboard;
  let documentAdapter: KeyboardDocumentAdapter;
  let guard: FakeGuard;

  beforeEach(() => {
    ({
      keyboard,
      documentAdapter
    } = createConnectedKeyboardFixture());
    guard = new FakeGuard();
  });

  afterEach(() => {
    keyboard.disconnect();
  });

  test("a blocking guard stops keydown from emitting or tracking state", () => {
    keyboard.addGuard(guard);
    guard.blocking = true;
    const emitted: string[] = [];
    keyboard.on("Escape", () => emitted.push("Escape"));
    keyboard.on("down", () => emitted.push("down"));

    documentAdapter.dispatchEvent("keydown", { code: "Escape" });
    keyboard.update();

    assert.deepEqual(emitted, []);
    assert.equal(keyboard.isDown("Escape"), false);
    assert.equal(keyboard.wasJustPressed("Escape"), false);
  });

  test("a blocking guard stops keypress from producing characters", () => {
    keyboard.addGuard(guard);
    guard.blocking = true;

    documentAdapter.dispatchEvent("keypress", { code: "KeyA", key: "a" });
    keyboard.update();

    assert.equal(keyboard.char, "");
  });

  test("the guard receives the dispatched event", () => {
    const seen: KeyboardEvent[] = [];
    keyboard.addGuard({
      blocks(event) {
        seen.push(event);

        return false;
      }
    });

    const event = documentAdapter.dispatchEvent("keydown", { code: "KeyA" });

    assert.deepEqual(seen, [event]);
    assert.equal(keyboard.buttonsDown.has("KeyA"), true);
  });

  test("keyup is never guarded so held keys cannot stick", () => {
    keyboard.addGuard(guard);
    documentAdapter.dispatchEvent("keydown", { code: "KeyW" });
    keyboard.update();

    guard.blocking = true;
    const emitted: string[] = [];
    keyboard.on("up", () => emitted.push("up"));
    documentAdapter.dispatchEvent("keyup", { code: "KeyW" });
    keyboard.update();

    assert.deepEqual(emitted, ["up"]);
    assert.equal(keyboard.wasJustReleased("KeyW"), true);
  });

  test("engaging releases held keys so polling consumers see a release edge", () => {
    keyboard.addGuard(guard);
    documentAdapter.dispatchEvent("keydown", { code: "KeyW" });
    keyboard.update();
    keyboard.update();
    assert.equal(keyboard.isDown("KeyW"), true);

    guard.engage();
    keyboard.update();

    assert.equal(keyboard.isDown("KeyW"), false);
    assert.equal(keyboard.wasJustReleased("KeyW"), true);
  });

  test("the returned disposer removes the guard and its engage subscription", () => {
    const dispose = keyboard.addGuard(guard);
    guard.blocking = true;

    dispose();
    dispose();
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });

    assert.equal(keyboard.buttonsDown.has("KeyA"), true);
    assert.equal(guard.listeners.size, 0);
  });

  test("adding the same guard twice subscribes once", () => {
    keyboard.addGuard(guard);
    keyboard.addGuard(guard);

    assert.equal(guard.listeners.size, 1);
  });

  test("editable targets stay ignored alongside guards", () => {
    keyboard.addGuard(guard);
    const input = documentAdapter.dispatchEvent("keydown", {
      code: "KeyA",
      target: { tagName: "INPUT" }
    });

    assert.equal(input.defaultPrevented, false);
    assert.equal(keyboard.buttonsDown.has("KeyA"), false);
  });
});
