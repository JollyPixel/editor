// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { emitComposedEvent } from "../src/events.ts";

describe("emitComposedEvent", () => {
  test("dispatches a bubbling, composed custom event carrying the detail", () => {
    const target = new EventTarget();
    const received: Array<CustomEvent<{ id: string; }>> = [];
    target.addEventListener("jolly-probe", (event) => {
      if (event instanceof CustomEvent) {
        received.push(event);
      }
    });

    emitComposedEvent(target, "jolly-probe", { id: "a" });

    assert.equal(received.length, 1);
    assert.deepEqual(received[0].detail, { id: "a" });
    assert.equal(received[0].bubbles, true);
    assert.equal(received[0].composed, true);
  });
});
