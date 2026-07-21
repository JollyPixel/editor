// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { InputController } from "#src/input/InputController.ts";
import { Viewport } from "#src/rendering/Viewport.ts";
import { makeActions } from "../helpers/input-actions.ts";
import { makeCanvas } from "../helpers/dom.ts";
import { hoverCanvas } from "../helpers/events.ts";

describe("InputController — shortcuts", () => {
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

  describe("copy / paste / delete shortcuts", () => {
    function ctrlKeyDown(key: string, repeat = false): KeyboardEvent {
      return new KeyboardEvent("keydown", {
        key,
        code: `Key${key.toUpperCase()}`,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        repeat
      });
    }

    test("Ctrl+C fires onCopy", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(ctrlKeyDown("c"));

      assert.strictEqual(calls.onCopy.length, 1);
      ctrl.destroy();
    });

    test("Cmd+C (metaKey) also fires onCopy", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "c",
        code: "KeyC",
        metaKey: true,
        bubbles: true,
        cancelable: true
      }));

      assert.strictEqual(calls.onCopy.length, 1);
      ctrl.destroy();
    });

    test("preventDefault is called when onCopy returns true", () => {
      const { actions } = makeActions({
        onCopyReturns: true
      });
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      const event = ctrlKeyDown("c");
      window.dispatchEvent(event);

      assert.ok(event.defaultPrevented);
      ctrl.destroy();
    });

    test("preventDefault is NOT called when onCopy returns false", () => {
      const { actions } = makeActions({
        onCopyReturns: false
      });
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      const event = ctrlKeyDown("c");
      window.dispatchEvent(event);

      assert.ok(!event.defaultPrevented);
      ctrl.destroy();
    });

    test("Ctrl+V fires onPaste", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(ctrlKeyDown("v"));

      assert.strictEqual(calls.onPaste.length, 1);
      ctrl.destroy();
    });

    test("Delete key fires onDelete", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Delete",
          code: "Delete",
          bubbles: true,
          cancelable: true
        })
      );

      assert.strictEqual(calls.onDelete.length, 1);
      ctrl.destroy();
    });

    test("OS key-repeat does not re-fire onCopy/onPaste/onDelete", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(ctrlKeyDown("c", true));
      window.dispatchEvent(ctrlKeyDown("v", true));
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Delete",
        code: "Delete",
        bubbles: true,
        cancelable: true,
        repeat: true
      }));

      assert.strictEqual(calls.onCopy.length, 0);
      assert.strictEqual(calls.onPaste.length, 0);
      assert.strictEqual(calls.onDelete.length, 0);
      ctrl.destroy();
    });

    test("keydown while a text input has focus does not fire onCopy/onPaste/onDelete", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      const input = document.createElement("input");
      document.body.appendChild(input);

      input.dispatchEvent(ctrlKeyDown("c"));
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Delete",
          code: "Delete",
          bubbles: true,
          cancelable: true
        })
      );

      assert.strictEqual(calls.onCopy.length, 0);
      assert.strictEqual(calls.onDelete.length, 0);
      ctrl.destroy();
    });
  });

  describe("undo / redo shortcuts", () => {
    function ctrlKeyDown(
      key: string,
      parameters: { shiftKey?: boolean; repeat?: boolean; } = {}
    ): KeyboardEvent {
      return new KeyboardEvent("keydown", {
        key,
        code: `Key${key.toUpperCase()}`,
        ctrlKey: true,
        shiftKey: parameters.shiftKey ?? false,
        repeat: parameters.repeat ?? false,
        bubbles: true,
        cancelable: true
      });
    }

    test("Ctrl+Z fires onUndo", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(ctrlKeyDown("z"));

      assert.strictEqual(calls.onUndo.length, 1);
      assert.strictEqual(calls.onRedo.length, 0);
      ctrl.destroy();
    });

    test("Cmd+Z (metaKey) also fires onUndo", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "z",
        code: "KeyZ",
        metaKey: true,
        bubbles: true,
        cancelable: true
      }));

      assert.strictEqual(calls.onUndo.length, 1);
      ctrl.destroy();
    });

    test("Ctrl+Y fires onRedo", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(ctrlKeyDown("y"));

      assert.strictEqual(calls.onRedo.length, 1);
      assert.strictEqual(calls.onUndo.length, 0);
      ctrl.destroy();
    });

    test("Ctrl+Shift+Z fires onRedo, not onUndo", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(
        ctrlKeyDown("z", { shiftKey: true })
      );

      assert.strictEqual(calls.onRedo.length, 1);
      assert.strictEqual(calls.onUndo.length, 0);
      ctrl.destroy();
    });

    test("preventDefault is called when onUndo returns true", () => {
      const { actions } = makeActions({
        onUndoReturns: true
      });
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      const event = ctrlKeyDown("z");
      window.dispatchEvent(event);

      assert.ok(event.defaultPrevented);
      ctrl.destroy();
    });

    test("preventDefault is NOT called when onUndo returns false", () => {
      const { actions } = makeActions({
        onUndoReturns: false
      });
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      const event = ctrlKeyDown("z");
      window.dispatchEvent(event);

      assert.ok(!event.defaultPrevented);
      ctrl.destroy();
    });

    test("preventDefault reflects onRedo's return value for Ctrl+Y", () => {
      const { actions } = makeActions({ onRedoReturns: true });
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      const event = ctrlKeyDown("y");
      window.dispatchEvent(event);

      assert.ok(event.defaultPrevented);
      ctrl.destroy();
    });

    test("OS key-repeat does not re-fire onUndo/onRedo", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(
        ctrlKeyDown("z", { repeat: true })
      );
      window.dispatchEvent(
        ctrlKeyDown("y", { repeat: true })
      );

      assert.strictEqual(calls.onUndo.length, 0);
      assert.strictEqual(calls.onRedo.length, 0);
      ctrl.destroy();
    });

    test("keydown while a text input has focus does not fire onUndo/onRedo", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      const input = document.createElement("input");
      document.body.appendChild(input);

      input.dispatchEvent(ctrlKeyDown("z"));

      assert.strictEqual(calls.onUndo.length, 0);
      ctrl.destroy();
    });

    test("Ctrl+Z before any mouseenter does not fire onUndo", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      window.dispatchEvent(ctrlKeyDown("z"));

      assert.strictEqual(calls.onUndo.length, 0);
      ctrl.destroy();
    });
  });
});
