// Import Node.js Dependencies
import { mock } from "node:test";

// Import Internal Dependencies
import { EventTargetAdapter } from "./eventTarget.ts";

export type TouchEventType =
  | "touchstart"
  | "touchend"
  | "touchmove"
  | "touchcancel";

export class CanvasAdapter extends EventTargetAdapter {
  clientWidth = 800;
  clientHeight = 600;
  style = {
    cursor: "auto"
  };

  requestFullscreen = mock.fn(() => Promise.resolve());
  requestPointerLock = mock.fn(() => Promise.resolve());
  focus = mock.fn();

  dispatchTouchEvent(
    type: TouchEventType,
    touches: Touch[]
  ) {
    this.dispatch(type, {
      type,
      changedTouches: touches,
      target: this,
      preventDefault: () => void 0
    });
  }
}
