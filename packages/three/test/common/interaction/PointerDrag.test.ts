// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { PointerDrag } from "#src/common/interaction/PointerDrag.ts";
import { createPointerTarget } from "../../fixtures/pointer.ts";

interface Harness {
  drag: PointerDrag<string>;
  element: HTMLElement;
  calls: string[];
  state: { enabled: boolean; };
  send: (type: string, init?: PointerEventInit) => PointerEvent;
}

function createHarness(
  grabbable = false
): Harness {
  const calls: string[] = [];
  const state = { enabled: true };
  const element = createPointerTarget();
  const drag = new PointerDrag<string>({
    enabled: () => state.enabled,
    press: () => {
      calls.push("press");

      return false;
    },
    hover: () => {
      calls.push("hover");

      return grabbable;
    },
    drag: (session) => calls.push(`drag:${session}`),
    cancel: (session) => calls.push(`cancel:${session}`),
    release: (session, { event, cancelled }) => calls.push(
      `release:${session}:${event?.type ?? "none"}${cancelled ? ":cancelled" : ""}`
    )
  });
  drag.connect(element);

  return {
    drag,
    element,
    calls,
    state,
    send: (type, init = {}) => {
      const event = new window.PointerEvent(type, {
        pointerId: 1,
        clientX: 50,
        clientY: 150,
        bubbles: true,
        ...init
      });
      element.dispatchEvent(event);

      return event;
    }
  };
}

describe("PointerDrag", () => {
  test("offers idle primary presses without starting a drag on its own", () => {
    const { drag, calls, send } = createHarness();

    send("pointerdown");

    assert.deepEqual(calls, ["press"]);
    assert.equal(drag.active, false);
  });

  test("offers no press for another button, while disabled, or during a drag", () => {
    const { drag, calls, state, send } = createHarness();

    send("pointerdown", { button: 2 });
    state.enabled = false;
    send("pointerdown");
    state.enabled = true;
    drag.begin(new window.PointerEvent("pointerdown", { pointerId: 1 }), "move");
    send("pointerdown");

    assert.deepEqual(calls, []);
  });

  test("routes motion to hover until a drag begins, then hands the session over", () => {
    const { drag, calls, send } = createHarness();

    send("pointermove");
    drag.begin(send("pointerdown"), "move");
    send("pointermove");

    assert.deepEqual(calls, ["hover", "press", "drag:move"]);
    assert.equal(drag.session, "move");
  });

  test("ignores hover and drag motion while disabled", () => {
    const { drag, calls, state, send } = createHarness();
    state.enabled = false;

    send("pointermove");
    drag.begin(send("pointerdown"), "move");
    send("pointermove");

    assert.deepEqual(calls, []);
    assert.equal(drag.active, true);
  });

  test("ignores the motion and release of another pointer", () => {
    const { drag, calls, send } = createHarness();

    drag.begin(send("pointerdown"), "move");
    send("pointermove", { pointerId: 2 });
    send("pointerup", { pointerId: 2 });

    assert.deepEqual(calls, ["press"]);
    assert.equal(drag.active, true);
  });

  test("releases on pointerup with the event, then hovers where the pointer stopped", () => {
    const { drag, calls, send } = createHarness();

    drag.begin(send("pointerdown"), "move");
    send("pointerup");

    assert.deepEqual(calls, ["press", "release:move:pointerup", "hover"]);
    assert.equal(drag.active, false);
  });

  test("releases on pointercancel without an event", () => {
    const { drag, calls, send } = createHarness();

    drag.begin(send("pointerdown"), "move");
    send("pointercancel");

    assert.deepEqual(calls, ["press", "release:move:none"]);
  });

  test("releases once when ended by the owner", () => {
    const { drag, calls, send } = createHarness();

    drag.begin(send("pointerdown"), "move");
    drag.end();
    drag.end();

    assert.deepEqual(calls, ["press", "release:move:none"]);
  });

  test("cancels through the restore hook, from cancel() or Escape", () => {
    const { drag, element, calls, send } = createHarness();

    drag.begin(send("pointerdown"), "first");
    drag.cancel();
    drag.begin(send("pointerdown"), "second");
    element.ownerDocument.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
    element.ownerDocument.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));

    assert.deepEqual(calls, [
      "press",
      "cancel:first",
      "release:first:none:cancelled",
      "press",
      "cancel:second",
      "release:second:none:cancelled"
    ]);
  });

  test("releases a running drag on disconnect and stops listening", () => {
    const { drag, calls, send } = createHarness();

    drag.begin(send("pointerdown"), "move");
    drag.disconnect();
    send("pointerdown");
    send("pointermove");

    assert.deepEqual(calls, ["press", "release:move:none"]);
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
    assert.deepEqual(calls, []);

    next.dispatchEvent(
      new window.PointerEvent("pointerdown", { pointerId: 1 })
    );
    assert.deepEqual(calls, ["press"]);
    assert.equal(drag.element, next);
  });

  describe("cursor", () => {
    test("shows grab over a grabbable spot and grabbing while dragging", () => {
      const { drag, element, send } = createHarness(true);

      send("pointermove");
      assert.equal(element.style.cursor, "grab");

      drag.begin(send("pointerdown"), "move");
      assert.equal(element.style.cursor, "grabbing");

      send("pointerup");
      assert.equal(element.style.cursor, "grab");
    });

    test("leaves the host cursor alone away from a grabbable spot", () => {
      const { element, send } = createHarness();
      element.style.cursor = "crosshair";

      send("pointermove");

      assert.equal(element.style.cursor, "crosshair");
    });

    test("restores the host cursor on cancel and on disconnect", () => {
      const { drag, element, send } = createHarness(true);
      element.style.cursor = "crosshair";

      drag.begin(send("pointerdown"), "move");
      send("pointercancel");
      assert.equal(element.style.cursor, "crosshair");

      send("pointermove");
      drag.disconnect();
      assert.equal(element.style.cursor, "crosshair");
    });
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
