// Import Internal Dependencies
import type { InputActions } from "#src/input/InputController.ts";

// Recorded arguments for every InputActions callback, keyed by callback name.
// Typing to `keyof InputActions` makes a mistyped key a compile error instead
// of a silently-undefined read.
export type InputActionCalls = Record<keyof InputActions, unknown[][]>;

// Return values for the callbacks typed `boolean | void` (the ones whose
// return decides whether the browser default is suppressed / the gesture
// tracked). Unset means the callback returns void.
export interface MakeActionsOptions {
  onPrimaryDownReturns?: boolean;
  onSecondaryDownReturns?: boolean;
  onCopyReturns?: boolean;
  onPasteReturns?: boolean;
  onDeleteReturns?: boolean;
  onUndoReturns?: boolean;
  onRedoReturns?: boolean;
  onRotateReturns?: boolean;
  onFlipHorizontalReturns?: boolean;
  onFlipVerticalReturns?: boolean;
}

/**
 * Builds a spying `InputActions` plus a `calls` recorder. Each callback pushes
 * its arguments onto `calls[name]`; the `*Returns` options drive the return
 * value of the callbacks that report back to the InputController.
 */
export function makeActions(
  options: MakeActionsOptions = {}
): {
  actions: InputActions;
  calls: InputActionCalls;
} {
  const calls: InputActionCalls = {
    onPrimaryDown: [],
    onPrimaryMove: [],
    onPrimaryUp: [],
    onSecondaryDown: [],
    onSecondaryMove: [],
    onSecondaryUp: [],
    onPanStart: [],
    onPanMove: [],
    onPanEnd: [],
    onZoom: [],
    onMouseMove: [],
    onCursorMove: [],
    onMouseUp: [],
    onShiftDown: [],
    onShiftUp: [],
    onBlur: [],
    onCopy: [],
    onPaste: [],
    onDelete: [],
    onUndo: [],
    onRedo: [],
    onRotate: [],
    onFlipHorizontal: [],
    onFlipVertical: []
  };

  const actions: InputActions = {
    onPrimaryDown: (tx, ty) => {
      calls.onPrimaryDown.push([tx, ty]);

      return options.onPrimaryDownReturns;
    },
    onPrimaryMove: (tx, ty) => {
      calls.onPrimaryMove.push([tx, ty]);
    },
    onPrimaryUp: () => {
      calls.onPrimaryUp.push([]);
    },
    onSecondaryDown: (tx, ty, ctrlKey) => {
      calls.onSecondaryDown.push([
        tx,
        ty,
        ctrlKey
      ]);

      return options.onSecondaryDownReturns;
    },
    onSecondaryMove: (tx, ty) => {
      calls.onSecondaryMove.push([tx, ty]);
    },
    onSecondaryUp: () => {
      calls.onSecondaryUp.push([]);
    },
    onPanStart: (mx, my) => {
      calls.onPanStart.push([mx, my]);
    },
    onPanMove: (dx, dy) => {
      calls.onPanMove.push([dx, dy]);
    },
    onPanEnd: () => {
      calls.onPanEnd.push([]);
    },
    onZoom: (delta, cx, cy) => {
      calls.onZoom.push([delta, cx, cy]);
    },
    onMouseMove: (cx, cy) => {
      calls.onMouseMove.push([cx, cy]);
    },
    onCursorMove: (pos) => {
      calls.onCursorMove.push([pos]);
    },
    onMouseUp: () => {
      calls.onMouseUp.push([]);
    },
    onShiftDown: () => {
      calls.onShiftDown.push([]);
    },
    onShiftUp: () => {
      calls.onShiftUp.push([]);
    },
    onBlur: () => {
      calls.onBlur.push([]);
    },
    onCopy: () => {
      calls.onCopy.push([]);

      return options.onCopyReturns;
    },
    onPaste: () => {
      calls.onPaste.push([]);

      return options.onPasteReturns;
    },
    onDelete: () => {
      calls.onDelete.push([]);

      return options.onDeleteReturns;
    },
    onUndo: () => {
      calls.onUndo.push([]);

      return options.onUndoReturns;
    },
    onRedo: () => {
      calls.onRedo.push([]);

      return options.onRedoReturns;
    },
    onRotate: () => {
      calls.onRotate.push([]);

      return options.onRotateReturns;
    },
    onFlipHorizontal: () => {
      calls.onFlipHorizontal.push([]);

      return options.onFlipHorizontalReturns;
    },
    onFlipVertical: () => {
      calls.onFlipVertical.push([]);

      return options.onFlipVerticalReturns;
    }
  };

  return {
    actions,
    calls
  };
}
