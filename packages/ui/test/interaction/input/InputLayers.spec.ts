// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  beforeEach,
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  InputLayers,
  inputLayers
} from "../../../src/interaction/input/InputLayers.ts";

function keydown(
  target: EventTarget,
  key = "Escape"
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    composed: true,
    cancelable: true
  });
  target.dispatchEvent(event);

  return event;
}

describe("InputLayers", () => {
  let layers: InputLayers;
  let button: HTMLElement;

  beforeEach(() => {
    layers = new InputLayers();
    button = document.createElement("button");
    document.body.append(button);
  });

  afterEach(() => {
    button.remove();
  });

  test("blocks nothing while no layer is open", () => {
    const event = keydown(button);

    assert.equal(layers.open, false);
    assert.equal(layers.blocks(event), false);
  });

  test("blocks keydown and keypress events dispatched while a layer is open", () => {
    const release = layers.push();

    const down = keydown(button);
    const press = new KeyboardEvent("keypress", {
      key: "a",
      bubbles: true
    });
    button.dispatchEvent(press);

    assert.equal(layers.open, true);
    assert.equal(layers.blocks(down), true);
    assert.equal(layers.blocks(press), true);

    release();
  });

  test("does not claim keyup, so held keys can always be released", () => {
    const release = layers.push();
    const up = new KeyboardEvent("keyup", {
      key: "KeyW",
      bubbles: true
    });
    button.dispatchEvent(up);

    assert.equal(layers.blocks(up), false);

    release();
  });

  test("keeps an event blocked when a listener closes the layer during its dispatch", () => {
    const release = layers.push();
    let seenByLaterListener = false;

    document.addEventListener("keydown", release, true);
    function observe(
      dispatched: Event
    ): void {
      seenByLaterListener = layers.blocks(dispatched);
    }

    document.addEventListener("keydown", observe);
    const event = keydown(button);
    document.removeEventListener("keydown", release, true);
    document.removeEventListener("keydown", observe);

    assert.equal(layers.open, false);
    assert.equal(seenByLaterListener, true);
    assert.equal(layers.blocks(event), true);
  });

  test("stops blocking new events once every layer is released", () => {
    const releaseDialog = layers.push();
    const releasePopover = layers.push();

    releasePopover();
    assert.equal(layers.blocks(keydown(button)), true);

    releaseDialog();
    assert.equal(layers.open, false);
    assert.equal(layers.blocks(keydown(button)), false);
  });

  test("release is idempotent and cannot close another layer", () => {
    const releaseFirst = layers.push();
    const releaseSecond = layers.push();

    releaseFirst();
    releaseFirst();

    assert.equal(layers.open, true);

    releaseSecond();
    assert.equal(layers.open, false);
  });

  test("notifies engage listeners only when the first layer opens", () => {
    let engaged = 0;
    const unsubscribe = layers.onEngage(() => {
      engaged++;
    });

    const releaseFirst = layers.push();
    const releaseSecond = layers.push();
    releaseSecond();
    releaseFirst();
    layers.push()();

    assert.equal(engaged, 2);

    unsubscribe();
    layers.push()();
    assert.equal(engaged, 2);
  });

  test("listens on the configured target", () => {
    const host = document.createElement("div");
    const child = document.createElement("span");
    host.append(child);
    const scoped = new InputLayers({
      target: () => host
    });

    const release = scoped.push();

    assert.equal(scoped.blocks(keydown(child)), true);
    assert.equal(scoped.blocks(keydown(button)), false);

    release();
  });

  test("dismissAll succeeds when no layer is open", () => {
    assert.equal(layers.dismissAll(), true);
  });

  test("dismissAll closes every dismissible layer, newest first", () => {
    const order: string[] = [];
    function dismissible(
      name: string
    ): () => void {
      const release = layers.push({
        dismiss: () => {
          order.push(name);
          release();

          return true;
        }
      });

      return release;
    }
    dismissible("dialog");
    dismissible("popover");

    assert.equal(layers.dismissAll(), true);
    assert.deepEqual(order, ["popover", "dialog"]);
    assert.equal(layers.open, false);
  });

  test("dismissAll reports a refusing layer and still closes the others", () => {
    const releaseFirst = layers.push({
      dismiss: () => {
        releaseFirst();

        return true;
      }
    });
    const releaseLocked = layers.push({
      dismiss: () => false
    });
    const releaseLast = layers.push({
      dismiss: () => {
        releaseLast();

        return true;
      }
    });

    assert.equal(layers.dismissAll(), false);
    assert.equal(layers.open, true);

    releaseLocked();
    assert.equal(layers.open, false);
  });

  test("dismissAll treats a layer pushed without dismiss as refusing", () => {
    const release = layers.push();

    assert.equal(layers.dismissAll(), false);
    assert.equal(layers.open, true);

    release();
  });

  test("dismissAll skips a layer released by an earlier dismiss", () => {
    let innerDismissed = false;
    const releaseInner = layers.push({
      dismiss: () => {
        innerDismissed = true;

        return true;
      }
    });
    const releaseOuter = layers.push({
      dismiss: () => {
        releaseOuter();
        releaseInner();

        return true;
      }
    });

    assert.equal(layers.dismissAll(), true);
    assert.equal(innerDismissed, false);
  });

  test("exposes a shared instance", () => {
    assert.ok(inputLayers instanceof InputLayers);
  });
});
