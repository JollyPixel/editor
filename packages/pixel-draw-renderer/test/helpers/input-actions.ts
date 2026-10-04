// Import Internal Dependencies
import type {
  InputActions,
  PointerPosition
} from "#src/input/InputActions.ts";
import type { BrushColorSlot } from "#src/tools/Brush.ts";

export interface InputActionCalls {
  onPointerDown: [BrushColorSlot, number, number, boolean][];
  onPointerMove: [BrushColorSlot, number, number][];
  onPointerUp: BrushColorSlot[];
  onCtrlWheel: number[];
  onPanStart: number;
  onPanEnd: number;
  onHover: (PointerPosition | null)[];
  onMouseUp: number;
  onBlur: number;
}

export interface MakeActionsOptions {
  tracksDrags?: boolean;
  pansOnPrimary?: boolean;
  handlesCtrlWheel?: boolean;
}

export function makeActions(
  options: MakeActionsOptions = {}
): {
  actions: InputActions;
  calls: InputActionCalls;
} {
  const calls: InputActionCalls = {
    onPointerDown: [],
    onPointerMove: [],
    onPointerUp: [],
    onCtrlWheel: [],
    onPanStart: 0,
    onPanEnd: 0,
    onHover: [],
    onMouseUp: 0,
    onBlur: 0
  };

  const actions: InputActions = {
    pansOnPrimary: options.pansOnPrimary ?? false,
    onPointerDown: (slot, position, ctrlKey) => {
      calls.onPointerDown.push([
        slot,
        position.texture.x,
        position.texture.y,
        ctrlKey
      ]);

      return options.tracksDrags ?? true;
    },
    onPointerMove: (slot, position) => {
      calls.onPointerMove.push([
        slot,
        position.texture.x,
        position.texture.y
      ]);
    },
    onPointerUp: (slot) => {
      calls.onPointerUp.push(slot);
    },
    onCtrlWheel: (delta) => {
      calls.onCtrlWheel.push(delta);

      return options.handlesCtrlWheel ?? false;
    },
    onPanStart: () => {
      calls.onPanStart++;
    },
    onPanEnd: () => {
      calls.onPanEnd++;
    },
    onHover: (position) => {
      calls.onHover.push(position);
    },
    onMouseUp: () => {
      calls.onMouseUp++;
    },
    onBlur: () => {
      calls.onBlur++;
    }
  };

  return {
    actions,
    calls
  };
}
