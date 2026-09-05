// Import Third-party Dependencies
import { Event } from "happy-dom";

// Import Internal Dependencies
import { Touchpad } from "../../../src/index.ts";
import * as mocks from "../../mocks/index.ts";

export class TouchpadCanvasAdapter extends mocks.CanvasAdapter {
  rect = {
    left: 0,
    top: 0
  };

  getBoundingClientRect() {
    return this.rect;
  }

  dispatchEvent(
    type: "touchstart" | "touchend" | "touchmove" | "touchcancel",
    touches: Touch[]
  ) {
    const listeners = this.listeners.get(type) ?? new Set();
    const event = {
      type,
      changedTouches: touches,
      target: this,
      preventDefault: () => {
        // DO NOTHING
      }
    } as unknown as Event;

    listeners.forEach((listener) => listener(event));
  }
}

export interface TouchpadFixture {
  touchpad: Touchpad;
  canvas: TouchpadCanvasAdapter;
}

export function createConnectedTouchpadFixture(): TouchpadFixture {
  const canvas = new TouchpadCanvasAdapter();
  const touchpad = new Touchpad({
    canvas
  });
  touchpad.connect();

  return {
    touchpad,
    canvas
  };
}

export function createTouch(
  identifier: number,
  clientX: number,
  clientY: number
): Touch {
  return {
    identifier,
    clientX,
    clientY,
    screenX: clientX,
    screenY: clientY,
    pageX: clientX,
    pageY: clientY,
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 1,
    target: null as any
  } as Touch;
}
