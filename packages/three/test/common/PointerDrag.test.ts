// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { PointerDrag } from "#src/common/PointerDrag.ts";
import { createPointerTarget } from "../fixtures/pointer.ts";

interface Harness {
  drag: PointerDrag;
  element: HTMLElement;
  calls: string[];
  send: (type: string, pointerId?: number) => PointerEvent;
}

function createHarness(): Harness {
  const calls: string[] = [];
  const element = createPointerTarget();
  const drag = new PointerDrag({
    press: () => calls.push("press"),
    hover: () => calls.push("hover"),
    drag: () => calls.push("drag"),
    release: () => calls.push("release")
  });
  drag.connect(element);

  return {
    drag,
    element,
    calls,
    send: (type, pointerId = 1) => {
      const event = new window.PointerEvent(type, {
        pointerId,
        clientX: 50,
        clientY: 150,
        bubbles: true
      });
      element.dispatchEvent(event);

      return event;
    }
  };
}

describe("PointerDrag", () => {
  test("reports presses without starting a drag on its own", () => {
    const { drag, calls, send } = createHarness();

    send("pointerdown");

    assert.deepEqual(calls, ["press"]);
    assert.equal(drag.active, false);
  });

  test("routes motion to hover until a drag begins", () => {
    const { drag, calls, send } = createHarness();

    send("pointermove");
    drag.begin(send("pointerdown"));
    send("pointermove");

    assert.deepEqual(calls, ["hover", "press", "drag"]);
    assert.equal(drag.active, true);
  });

  test("ignores the motion and release of another pointer", () => {
    const { drag, calls, send } = createHarness();

    drag.begin(send("pointerdown", 1));
    send("pointermove", 2);
    send("pointerup", 2);

    assert.deepEqual(calls, ["press"]);
    assert.equal(drag.active, true);
  });

  test("releases on pointerup and on pointercancel", () => {
    for (const type of ["pointerup", "pointercancel"]) {
      const { drag, calls, send } = createHarness();

      drag.begin(send("pointerdown"));
      send(type);

      assert.deepEqual(calls, ["press", "release"]);
      assert.equal(drag.active, false);
    }
  });

  test("releases once when ended by the owner", () => {
    const { drag, calls, send } = createHarness();

    drag.begin(send("pointerdown"));
    drag.end();
    drag.end();

    assert.deepEqual(calls, ["press", "release"]);
  });

  test("releases a running drag on disconnect and stops listening", () => {
    const { drag, calls, send } = createHarness();

    drag.begin(send("pointerdown"));
    drag.disconnect();
    send("pointerdown");
    send("pointermove");

    assert.deepEqual(calls, ["press", "release"]);
    assert.equal(drag.element, null);
  });

  test("listens once when connected twice to the same element", () => {
    const { drag, element, calls, send } = createHarness();

    drag.connect(element);
    send("pointerdown");

    assert.deepEqual(calls, ["press"]);
  });

  test("moves its listeners to a newly connected element", () => {
    const { drag, calls, send } = createHarness();
    const next = createPointerTarget();

    drag.connect(next);
    send("pointerdown");
    next.dispatchEvent(
      new window.PointerEvent("pointerdown", { pointerId: 1 })
    );

    assert.deepEqual(calls, ["press"]);
  });

  describe("toNdc", () => {
    test("maps client coordinates to normalized device coordinates", () => {
      const { drag, send } = createHarness();
      const ndc = new THREE.Vector2();

      assert.equal(drag.toNdc(send("pointermove"), ndc), true);
      assert.deepEqual(ndc.toArray(), [-0.5, -0.5]);
    });

    test("fails without an element or on a collapsed one", () => {
      const ndc = new THREE.Vector2();
      const { drag, send } = createHarness();
      const event = send("pointermove");

      drag.connect(createPointerTarget(0));
      assert.equal(drag.toNdc(event, ndc), false);

      drag.disconnect();
      assert.equal(drag.toNdc(event, ndc), false);
    });
  });
});
