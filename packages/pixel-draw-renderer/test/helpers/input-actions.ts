// Import Internal Dependencies
import type { InputActions } from "#src/input/InputActions.ts";

export type InputActionCalls = Record<keyof InputActions, unknown[][]>;

export interface MakeActionsOptions {
  onPrimaryDownReturns?: boolean;
  onSecondaryDownReturns?: boolean;
}

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
    onBlur: []
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
    onBlur: () => {
      calls.onBlur.push([]);
    }
  };

  return {
    actions,
    calls
  };
}
