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
