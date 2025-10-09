// Import Node.js Dependencies
import { mock } from "node:test";

// Import Internal Dependencies
import { EventTargetAdapter } from "./eventTarget.js";

export class CanvasAdapter extends EventTargetAdapter {
  requestFullscreen = mock.fn(() => Promise.resolve());
  requestPointerLock = mock.fn(() => Promise.resolve());
  focus = mock.fn();
}
