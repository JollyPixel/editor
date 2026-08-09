// Import Internal Dependencies
import type { InputActions } from "#src/input/InputActions.ts";

// Recorded arguments for every InputActions callback, keyed by callback name.
// Typing to `keyof InputActions` makes a mistyped key a compile error instead
// of a silently-undefined read.
export type InputActionCalls = Record<keyof InputActions, unknown[][]>;

// Return values for callbacks that control drag tracking or browser defaults.
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
    onCanvasHover: [],
    onTextureCursorMove: [],
    onMouseUp: [],
    onShiftDown: [],
    onShiftUp: [],
    onSpaceDown: [],
    onSpaceUp: [],
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
    onPrimaryDown: (position) => {
      calls.onPrimaryDown.push([position.x, position.y]);

      return options.onPrimaryDownReturns ?? true;
    },
    onPrimaryMove: (position) => {
      calls.onPrimaryMove.push([position.x, position.y]);
    },
    onPrimaryUp: () => {
      calls.onPrimaryUp.push([]);
    },
    onSecondaryDown: (position, ctrlKey) => {
      calls.onSecondaryDown.push([
        position.x,
        position.y,
        ctrlKey
      ]);

      return options.onSecondaryDownReturns ?? true;
    },
    onSecondaryMove: (position) => {
      calls.onSecondaryMove.push([position.x, position.y]);
    },
    onSecondaryUp: () => {
      calls.onSecondaryUp.push([]);
    },
    onPanStart: () => {
      calls.onPanStart.push([]);
    },
    onPanMove: (delta) => {
      calls.onPanMove.push([delta.x, delta.y]);
    },
    onPanEnd: () => {
      calls.onPanEnd.push([]);
    },
    onZoom: (delta, center) => {
      calls.onZoom.push([delta, center.x, center.y]);
    },
    onCanvasHover: (position) => {
      calls.onCanvasHover.push([position]);
    },
    onTextureCursorMove: (position) => {
      calls.onTextureCursorMove.push([position]);
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
    onSpaceDown: () => {
      calls.onSpaceDown.push([]);
    },
    onSpaceUp: () => {
      calls.onSpaceUp.push([]);
    },
    onBlur: () => {
      calls.onBlur.push([]);
    },
    onCopy: () => {
      calls.onCopy.push([]);

      return options.onCopyReturns ?? false;
    },
    onPaste: () => {
      calls.onPaste.push([]);

      return options.onPasteReturns ?? false;
    },
    onDelete: () => {
      calls.onDelete.push([]);

      return options.onDeleteReturns ?? false;
    },
    onUndo: () => {
      calls.onUndo.push([]);

      return options.onUndoReturns ?? false;
    },
    onRedo: () => {
      calls.onRedo.push([]);

      return options.onRedoReturns ?? false;
    },
    onRotate: () => {
      calls.onRotate.push([]);

      return options.onRotateReturns ?? false;
    },
    onFlipHorizontal: () => {
      calls.onFlipHorizontal.push([]);

      return options.onFlipHorizontalReturns ?? false;
    },
    onFlipVertical: () => {
      calls.onFlipVertical.push([]);

      return options.onFlipVerticalReturns ?? false;
    }
  };

  return {
    actions,
    calls
  };
}
