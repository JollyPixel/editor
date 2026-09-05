// Import Node.js Dependencies
import { mock } from "node:test";

// Import Internal Dependencies
import { EventTargetAdapter } from "./eventTarget.ts";

export class CanvasAdapter extends EventTargetAdapter {
  clientWidth = 800;
  clientHeight = 600;
  style = {
    cursor: "auto"
  };

  requestFullscreen = mock.fn(() => Promise.resolve());
  requestPointerLock = mock.fn(() => Promise.resolve());
  focus = mock.fn();
}
