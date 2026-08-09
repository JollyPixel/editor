// Import Node.js Dependencies
import {
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { InputController } from "#src/input/InputController.ts";
import type { WindowLike } from "#src/input/WindowLike.ts";
import { Viewport } from "#src/rendering/Viewport.ts";
import { makeActions } from "../helpers/input-actions.ts";
import { makeCanvas } from "../helpers/dom.ts";

class FakeWindow implements WindowLike {
  #listeners = new Map<string, Set<(event: any) => void>>();

  addEventListener(
    type: string,
    listener: (event: any) => void
  ): void {
    let listeners = this.#listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(type, listeners);
    }
    listeners.add(listener);
  }

  removeEventListener(
    type: string,
    listener: (event: any) => void
  ): void {
    this.#listeners.get(type)?.delete(listener);
  }

  dispatch(
    type: string,
    event: unknown
  ): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe("InputController lifecycle", () => {
  let viewport: Viewport;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    viewport = new Viewport({
      textureSize: { x: 16, y: 16 },
      zoom: 4
    });
    viewport.updateCanvasSize(200, 200);
    viewport.centerTexture();
  });

  test("primary dragging continues while another mouse button is held", () => {
    const { actions, calls } = makeActions();
    const controller = new InputController({
      canvas,
      viewport,
      actions
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0,
      buttons: 1,
      clientX: 100,
      clientY: 100
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 3,
      clientX: 110,
      clientY: 100
    }));

    assert.strictEqual(calls.onPrimaryMove.length, 1);
    controller.destroy();
  });

  test("window blur ends active drags and clears their tracking state", () => {
    const { actions, calls } = makeActions();
    const controller = new InputController({
      canvas,
      viewport,
      actions
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0,
      buttons: 1,
      clientX: 100,
      clientY: 100
    }));
    window.dispatchEvent(new Event("blur"));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 110,
      clientY: 100
    }));
    window.dispatchEvent(new MouseEvent("mouseup"));

    assert.strictEqual(calls.onPrimaryUp.length, 1);
    assert.strictEqual(calls.onPrimaryMove.length, 0);
    controller.destroy();
  });

  test("does not report a bubbling canvas mouseup twice", () => {
    const { actions, calls } = makeActions();
    const fakeWindow = new FakeWindow();
    const controller = new InputController({
      canvas,
      viewport,
      actions,
      window: fakeWindow
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 1,
      clientX: 100,
      clientY: 100
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup"));
    fakeWindow.dispatch("mouseup", { target: canvas });

    assert.strictEqual(calls.onMouseUp.length, 1);
    assert.strictEqual(calls.onPanEnd.length, 1);
    controller.destroy();
  });
});
